import { aiChat, type AiContentPart, type AiMessage } from './ai';
import { AGENT_TOOLS, runTool, type ActionCard, type ToolContext } from './agentTools';
import { localDate } from './dates';
import { db } from './db';
import { sumFood } from './food';
import { nextPlanDay } from './plan';

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** small preview of a photo the user sent (kept only in memory) */
  image?: string;
  hadImage?: boolean;
  cards?: ActionCard[];
  ask?: { question: string; options: string[] };
  error?: boolean;
}

const SYSTEM = `You are Fibu, the friendly robot coach inside the Fibu fitness app. You can see the user's data and you can act in the app with tools.

How you work:
- You can only change the user's data by calling a tool. Never say you logged, added, saved or updated anything unless you called the tool for it in this turn.
- When the user reports eating, drinking, training or weighing in ("just had", "did 3x10", "drank a bottle", "I'm 82 kg"), log it with the right tool. Don't ask permission for that.
- Food photos: identify each item and estimate portions from the plate. If something that changes the total a lot is unclear (portion, cooking oil or butter, sauce, a drink, what the dish actually is), ask ONE short question with ask_user and 2-4 tap options before logging. If the user already gave details or says "just log it", log right away with your best estimate (estimate: true). If the photo is a nutrition label, read it and ask how many servings they had.
- Workouts: log what they say with log_workout. Convert lb to kg. "3 sets of 10 push-ups" means sets 3, reps 10, weightKg 0.
- Never invent the user's numbers. Use get_today or get_history before answering questions about their progress, food or past workouts.
- Only call update_goal after the user clearly agrees to the exact change.
- Use start_workout or navigate when they want to train now or see a screen.
- After a tool runs, reply in one or two short sentences saying what you did and one useful next step (e.g. protein left for the day). Use the user's units.
- Keep every reply short, warm and direct. Plain words, no markdown, no hype, at most one emoji. No medical diagnoses; for pain or injury suggest seeing a physio or doctor.`;

async function snapshot(): Promise<string> {
  const today = localDate();
  const [profile, settings, food, water, plan, recent] = await Promise.all([
    db.profile.get('me'),
    db.settings.get('app'),
    db.foodLog.where('date').equals(today).toArray(),
    db.waterLog.where('date').equals(today).toArray(),
    db.plan.get('active'),
    db.sessions.orderBy('date').reverse().limit(3).toArray(),
  ]);
  const t = sumFood(food);
  const now = new Date();
  const lines = [
    `Now: ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${now.toTimeString().slice(0, 5)}.`,
    profile
      ? `User: ${profile.name ?? 'unnamed'}, goal ${profile.goal.replace('_', ' ')}, ${profile.experience}, ${profile.weightKg} kg${profile.goalWeightKg ? ` (goal ${profile.goalWeightKg} kg)` : ''}, trains ${profile.daysPerWeek}x/week${profile.equipment ? ` (${profile.equipment})` : ''}${profile.injuries?.length ? `, careful with ${profile.injuries.join(', ')}` : ''}. Units: ${settings?.units ?? 'kg'}.`
      : 'No profile yet.',
    `Targets: ${settings?.calorieTarget ?? '?'} kcal, ${settings?.proteinTargetG ?? '?'} g protein, ${settings?.waterTargetMl ?? '?'} ml water.`,
    `Today so far: ${Math.round(t.calories)} kcal, ${Math.round(t.proteinG)} g protein, ${water.reduce((s, w) => s + w.ml, 0)} ml water, ${food.length} food entries.`,
  ];
  if (plan) lines.push(`Plan: ${plan.splitName ?? 'custom'}. Next workout: ${nextPlanDay(plan.days, recent[0]?.dayLabel)?.label ?? 'none'}.`);
  if (recent.length) lines.push(`Recent workouts: ${recent.map((s) => `${s.date} ${s.dayLabel}`).join('; ')}.`);
  return lines.join('\n');
}

/** Earlier turns as plain text, with what Fibu did spelled out, so the model keeps context without replaying tool calls. */
function historyMessages(history: ChatItem[]): AiMessage[] {
  return history.slice(-12).map((item): AiMessage => {
    if (item.role === 'user') return { role: 'user', content: item.text + (item.hadImage ? ' [sent a photo]' : '') };
    const did = item.cards?.filter((c) => !c.undone).map((c) => `${c.title}${c.detail ? ` (${c.detail})` : ''}`);
    const undone = item.cards?.filter((c) => c.undone).map((c) => c.title);
    let text = item.text;
    // Described as the app's record, not as Fibu's words, so the model doesn't imitate "logging" in plain text.
    if (did?.length) text += `\n(App record: these tool actions were completed: ${did.join('; ')})`;
    if (undone?.length) text += `\n(App record: the user pressed Undo on: ${undone.join('; ')})`;
    if (item.ask) text += `\n[Asked: ${item.ask.question} Options: ${item.ask.options.join(' / ')}]`;
    return { role: 'assistant', content: text };
  });
}

const CLAIMS_ACTION = /\b(logged|i've added|i have added|added (it|that|your)|saved|recorded|updated your|tracked)\b/i;

/** Chat bubbles are plain text: drop markdown emphasis the model sometimes adds. */
function formatReply(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?\S)\*(?=\s|$)/g, '$1$2').replace(/^#+\s*/gm, '');
}

export interface TurnResult {
  reply: string;
  cards: ActionCard[];
  undos: Map<string, () => Promise<void>>;
  ask?: { question: string; options: string[] };
  error?: boolean;
}

export async function runAgentTurn(history: ChatItem[], userText: string, imageDataUrl: string | undefined, ctx: ToolContext): Promise<TurnResult> {
  const content: AiContentPart[] = [{ type: 'text', text: userText || 'Here is a photo of my food.' }];
  if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  const messages: AiMessage[] = [
    { role: 'system', content: `${SYSTEM}\n\nWhat you know right now:\n${await snapshot()}` },
    ...historyMessages(history),
    { role: 'user', content },
  ];

  const cards: ActionCard[] = [];
  const undos = new Map<string, () => Promise<void>>();
  let toolsRan = false;
  let nudged = false;
  for (let step = 0; step < 6; step++) {
    const res = await aiChat({ messages, tools: AGENT_TOOLS, temperature: 0.3, maxTokens: 800 });
    if (!res.ok) return { reply: res.error, cards, undos, error: true };
    const msg = res.data;
    if (!msg.tool_calls?.length) {
      const reply = (msg.content ?? '').trim();
      // Safety net: models sometimes *say* they logged something without calling the tool.
      // Nothing is saved in that case, so make it either call the tool or answer honestly.
      if (!toolsRan && !nudged && CLAIMS_ACTION.test(reply)) {
        nudged = true;
        messages.push({ role: 'assistant', content: reply });
        messages.push({
          role: 'user',
          content:
            '[App check] No tool was called in this turn, so nothing was saved. If I asked you to log or change something, call the correct tool now. Otherwise reply again without saying you logged anything.',
        });
        continue;
      }
      return { reply: formatReply(reply) || 'Done.', cards, undos };
    }
    toolsRan = true;

    // The assistant message goes back verbatim: Gemini needs its thought signatures returned untouched.
    messages.push(msg);
    let ask: TurnResult['ask'];
    for (const call of msg.tool_calls) {
      const outcome = await runTool(call.function.name, call.function.arguments, ctx);
      if (outcome.card) {
        cards.push(outcome.card);
        if (outcome.undo) undos.set(outcome.card.id, outcome.undo);
      }
      if (outcome.ask) ask = outcome.ask;
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) });
    }
    if (ask) return { reply: formatReply((msg.content ?? '').trim()) || ask.question, cards, undos, ask };
  }
  return { reply: cards.length ? 'Done.' : "I got a bit tangled there. Try asking again in one sentence?", cards, undos };
}
