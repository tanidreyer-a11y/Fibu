import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { db } from '../lib/db';
import { buildChatContext } from '../lib/coach';
import { generateText } from '../lib/gemini';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const STARTERS = ['What did I bench last week?', 'Should I go heavier today?', "What's lagging behind this week?"];

export function Chat() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('app'));
  const profile = useLiveQuery(() => db.profile.get('me'));
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [], []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    const next = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(next);
    setSending(true);

    const context = buildChatContext(profile, sessions ?? []);
    const history = next.map((m) => `${m.role === 'user' ? 'User' : 'Fibu'}: ${m.text}`).join('\n');
    const prompt = `You are Fibu, a direct, encouraging training buddy embedded in a workout-logging app. Answer using only the data below — never invent numbers that aren't there. Keep replies short (2-4 sentences), no fitness clichés.\n\n${context}\n\nConversation so far:\n${history}\n\nFibu:`;

    const result = await generateText(prompt, 0.6);
    setSending(false);
    setMessages((prev) => [...prev, { role: 'assistant', text: result.ok ? result.data.trim() : result.error }]);
  }

  if (!settings?.geminiApiKey) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-text">Ask Fibu</h1>
        <p className="max-w-xs text-sm text-text-muted">
          The chat assistant needs a free Gemini key so it can actually reason over your logged history.
        </p>
        <Button onClick={() => navigate('/settings')}>Add a key in Settings</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-text">Ask Fibu</h1>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">Grounded in your own logged workouts. Try one:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-xl border border-border-soft bg-bg-raised px-4 py-3 text-left text-sm text-text transition-colors duration-150 hover:border-border active:scale-[0.99]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'self-end bg-accent text-accent-ink' : 'self-start bg-bg-raised-2 text-text'}`}>
            {m.text}
          </div>
        ))}
        {sending && <div className="self-start rounded-2xl bg-bg-raised-2 px-4 py-2.5 text-sm text-text-faint">Thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 pb-1"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your training…"
          className="h-11 flex-1 rounded-xl border border-border bg-bg-raised-2 px-4 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent"
        />
        <Button size="md" disabled={!input.trim() || sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
