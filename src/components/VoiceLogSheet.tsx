import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db, type Exercise, type SetEntry, type Units } from '../lib/db';
import { parseVoiceLog, type VoiceParseResult } from '../lib/coach';
import { createSpeechRecognition, isSpeechRecognitionSupported } from '../lib/speech';
import { displayWeight } from '../lib/units';
import { Button } from './ui/Button';

type Stage = 'idle' | 'listening' | 'parsing' | 'review' | 'error';

interface VoiceLogSheetProps {
  units: Units;
  onClose: () => void;
  onConfirm: (exerciseId: string, sets: SetEntry[]) => void;
}

export function VoiceLogSheet({ units, onClose, onConfirm }: VoiceLogSheetProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<VoiceParseResult | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const supported = useMemo(() => isSpeechRecognitionSupported(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function startListening() {
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    setTranscript('');
    setStage('listening');

    recognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    recognition.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone access was denied.' : "Didn't catch that — try again.");
      setStage('error');
    };
    recognition.onend = () => {
      setStage((s) => (s === 'listening' ? 'idle' : s));
    };
    recognition.start();
  }

  function stopAndParse() {
    recognitionRef.current?.stop();
    const heard = transcript.trim();
    if (!heard) {
      setError('Nothing heard — try again.');
      setStage('error');
      return;
    }
    setStage('parsing');
    parseVoiceLog(heard).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setStage('error');
        return;
      }
      setParsed(result.data);
      setManualQuery(result.data.exerciseNameHeard);
      setStage('review');
    });
  }

  function confirmMatch(exerciseId: string) {
    if (!parsed) return;
    onConfirm(exerciseId, parsed.sets.length > 0 ? parsed.sets : [{ reps: 8, weightKg: 20 }]);
  }

  const filteredManual = (exercises ?? []).filter((e) => e.name.toLowerCase().includes(manualQuery.toLowerCase())).slice(0, 6);
  const matchedExercise: Exercise | undefined = parsed?.exerciseId ? exercises?.find((e) => e.id === parsed.exerciseId) : undefined;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex max-h-[85vh] flex-col gap-4 rounded-t-3xl border-t border-border-soft bg-bg-raised p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="font-display text-lg font-semibold text-text">Log by voice</h2>

        {!supported && (
          <p className="rounded-xl bg-bg-raised-2 p-4 text-sm text-text-muted">
            Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.
          </p>
        )}

        {supported && stage === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={startListening}
              className="grid h-20 w-20 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-150 active:scale-95"
              aria-label="Start listening"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" strokeLinecap="round" />
              </svg>
            </button>
            <p className="text-sm text-text-muted">Tap and say what you did — "bench press, three sets of eight at eighty kilos"</p>
          </div>
        )}

        {stage === 'listening' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={stopAndParse}
              className="grid h-20 w-20 place-items-center rounded-full bg-danger text-accent-ink animate-pulse"
              aria-label="Stop listening"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <p className="min-h-10 text-center text-sm text-text">{transcript || 'Listening…'}</p>
          </div>
        )}

        {stage === 'parsing' && <p className="py-10 text-center text-sm text-text-muted">Making sense of that…</p>}

        {stage === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => setStage('idle')}>
              Try again
            </Button>
          </div>
        )}

        {stage === 'review' && parsed && (
          <div className="flex flex-col gap-4">
            {matchedExercise ? (
              <div className="rounded-xl bg-bg-raised-2 p-4">
                <p className="font-medium text-text">{matchedExercise.name}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {parsed.sets.map((s) => `${displayWeight(s.weightKg, units)}${units}×${s.reps}`).join('  ·  ')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-text-muted">
                  Heard "{parsed.exerciseNameHeard}" but couldn't match it exactly — pick the exercise:
                </p>
                <input
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="h-11 rounded-xl border border-border bg-bg-raised-2 px-4 text-sm text-text outline-none focus:border-accent"
                />
                <div className="flex flex-col gap-1">
                  {filteredManual.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => confirmMatch(e.id)}
                      className="rounded-lg px-3 py-2 text-left text-sm text-text transition-colors duration-150 hover:bg-bg-raised-2"
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchedExercise && (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStage('idle')}>
                  Redo
                </Button>
                <Button className="flex-1" onClick={() => confirmMatch(matchedExercise.id)}>
                  Add to workout
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
