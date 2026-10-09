import { ArrowCounterClockwise, Barbell, Camera, CheckCircle, Drop, ForkKnife, Microphone, PaperPlaneRight, Scales, Target, Trash, X, ArrowSquareOut, type Icon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MascotAvatar, MascotSays } from '../components/Mascot';
import { runAgentTurn, type ChatItem } from '../lib/agent';
import type { ActionCard } from '../lib/agentTools';
import { photoToDataUrl } from '../lib/image';
import { createSpeechRecognition, isSpeechRecognitionSupported } from '../lib/speech';

const STORE_KEY = 'fibu:chat:v2';
// Undo actions live for the app session; after a reload old cards just show what was done.
const undoRegistry = new Map<string, () => Promise<void>>();

const STARTERS = ['I just did 3 sets of 10 push-ups', 'Log 500 ml of water', 'How much protein do I have left today?', 'How is my bench press going?'];

const CARD_ICON: Record<ActionCard['kind'], Icon> = { meal: ForkKnife, workout: Barbell, weight: Scales, water: Drop, goal: Target, nav: ArrowSquareOut };

function loadChat(): ChatItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as ChatItem[];
  } catch {
    return [];
  }
}

function saveChat(items: ChatItem[]) {
  try {
    // Photos stay out of storage: they're large and only matter for the turn they were sent in.
    localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(-60).map(({ image: _img, ...rest }) => rest)));
  } catch {
    // storage full or blocked: the chat still works for this session
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

function Card({ card, onUndo }: { card: ActionCard; onUndo?: () => void }) {
  const IconC = CARD_ICON[card.kind];
  return (
    <div className={`animate-pop-in flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 ${card.undone ? 'border-border bg-bg-raised-2 opacity-70' : 'border-success/40 bg-protein-tint'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${card.undone ? 'bg-bg-raised text-text-faint' : 'bg-success text-accent-ink'}`}>
        {card.undone ? <ArrowCounterClockwise size={18} weight="bold" /> : <IconC size={18} weight="fill" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1 text-[14px] font-extrabold ${card.undone ? 'text-text-muted line-through' : 'text-text'}`}>
          {!card.undone && card.kind !== 'nav' && <CheckCircle size={15} weight="fill" className="text-success" />}
          {card.title}
        </span>
        {card.detail && <span className="block text-xs font-bold text-text-muted">{card.detail}</span>}
      </span>
      {onUndo && !card.undone && (
        <button onClick={onUndo} className="shrink-0 rounded-lg bg-bg-raised px-2.5 py-1.5 text-xs font-extrabold text-text-muted">
          Undo
        </button>
      )}
    </div>
  );
}

export function Chat() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChatItem[]>(loadChat);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);

  useEffect(() => saveChat(items), [items]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !image) || sending) return;
    const userItem: ChatItem = { id: uid(), role: 'user', text: trimmed, ...(image ? { image, hadImage: true } : {}) };
    const history = items;
    setItems([...history, userItem]);
    setInput('');
    const sentImage = image ?? undefined;
    setImage(null);
    setSending(true);
    const turn = await runAgentTurn(history, trimmed, sentImage, { navigate });
    for (const [id, fn] of turn.undos) undoRegistry.set(id, fn);
    setSending(false);
    setItems((prev) => [...prev, { id: uid(), role: 'assistant', text: turn.reply, cards: turn.cards, ...(turn.ask ? { ask: turn.ask } : {}), ...(turn.error ? { error: true } : {}) }]);
  }

  async function undo(itemId: string, card: ActionCard) {
    const fn = undoRegistry.get(card.id);
    if (!fn) return;
    await fn();
    undoRegistry.delete(card.id);
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, cards: it.cards?.map((c) => (c.id === card.id ? { ...c, undone: true } : c)) } : it)));
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await photoToDataUrl(file));
    } catch (err) {
      setItems((prev) => [...prev, { id: uid(), role: 'assistant', text: (err as Error).message, error: true }]);
    }
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    const before = input ? `${input.trim()} ` : '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(before + text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function clearChat() {
    if (!window.confirm('Clear this conversation? Anything Fibu logged stays logged.')) return;
    setItems([]);
    undoRegistry.clear();
  }

  const last = items[items.length - 1];

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="flex items-center gap-3 pr-12 pb-3">
        <MascotAvatar size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight font-black text-text">Fibu</h1>
          <p className="truncate text-xs font-bold text-text-faint">Your coach. Can log food, workouts, water and weight for you.</p>
        </div>
        {items.length > 0 && (
          <button onClick={clearChat} aria-label="Clear conversation" className="grid h-10 w-10 place-items-center rounded-xl text-text-faint">
            <Trash size={18} weight="bold" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 pb-4">
        {items.length === 0 && (
          <div className="flex flex-col gap-4 pt-2">
            <MascotSays pose="wave" size={110}>
              Send me a photo of your plate and I'll log it. Or just tell me what you did: "3 sets of 8 squats at 80 kg".
            </MascotSays>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="press-3d press-3d-sm rounded-2xl border-2 border-border bg-bg-raised px-4 py-3 text-left text-[15px] font-extrabold text-text [--ledge-color:var(--color-border)]"
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="press-3d press-3d-sm flex items-center gap-2 rounded-2xl border-2 border-accent bg-accent-tint px-4 py-3 text-left text-[15px] font-extrabold text-accent-text [--ledge-color:var(--color-accent)]"
              >
                <Camera size={20} weight="fill" /> Send a photo of my meal
              </button>
            </div>
          </div>
        )}

        {items.map((it) =>
          it.role === 'user' ? (
            <div key={it.id} className="animate-rise-in flex max-w-[85%] flex-col items-end gap-1.5 self-end">
              {it.image && <img src={it.image} alt="Your photo" className="max-h-48 rounded-2xl border-2 border-border object-cover" />}
              {!it.image && it.hadImage && <span className="text-xs font-bold text-text-faint">[photo]</span>}
              {it.text && <div className="rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug font-bold text-accent-ink">{it.text}</div>}
            </div>
          ) : (
            <div key={it.id} className="animate-rise-in flex max-w-[92%] gap-2 self-start">
              <MascotAvatar size={30} className="mt-1" />
              <div className="flex min-w-0 flex-col gap-2">
                {it.cards?.map((c) => (
                  <Card key={c.id} card={c} onUndo={undoRegistry.has(c.id) ? () => undo(it.id, c) : undefined} />
                ))}
                {it.text && (
                  <div
                    className={`rounded-2xl rounded-tl-md border-2 px-4 py-2.5 text-[15px] leading-snug font-semibold whitespace-pre-line ${
                      it.error ? 'border-danger/30 bg-danger-dim text-danger' : 'border-border bg-bg-raised text-text'
                    }`}
                  >
                    {it.text}
                  </div>
                )}
                {it.ask && it === last && !sending && (
                  <div className="flex flex-wrap gap-2">
                    {it.ask.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => send(o)}
                        className="press-3d press-3d-sm rounded-xl border-2 border-water bg-water-tint px-3 py-2 text-sm font-extrabold text-water-text [--ledge-color:var(--color-water)]"
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-center gap-2 self-start" aria-live="polite" aria-label="Fibu is thinking">
            <MascotAvatar size={30} />
            <div className="flex gap-1 rounded-2xl rounded-tl-md border-2 border-border bg-bg-raised px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-[dot-bounce_1s_var(--ease-in-out)_infinite] rounded-full bg-text-faint" style={{ animationDelay: `${i * 140}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky -mx-4 border-t-2 border-border-soft bg-bg px-4 pt-2.5 pb-2.5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 70px)' }}
      >
        {image && (
          <div className="relative mb-2 inline-block">
            <img src={image} alt="Photo to send" className="h-20 rounded-xl border-2 border-border object-cover" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove photo" className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-text text-bg">
              <X size={14} weight="bold" />
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Add a photo" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg-raised-2 text-text-muted">
            <Camera size={22} weight="fill" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? 'Listening…' : image ? 'Add details: name, portion, oil…' : 'Message Fibu'}
            aria-label="Message Fibu"
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-border-strong bg-bg-raised px-3.5 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
          />
          {isSpeechRecognitionSupported() && !input.trim() && !image ? (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Speak'}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${listening ? 'animate-glow-pulse bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-muted'}`}
            >
              <Microphone size={22} weight="fill" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sending || (!input.trim() && !image)}
              aria-label="Send"
              className="press-3d press-3d-sm grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:bg-bg-raised-2 disabled:text-text-faint [--ledge-color:var(--color-accent-ledge)]"
            >
              <PaperPlaneRight size={22} weight="fill" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
