import { ArrowsClockwise, Camera, ImageSquare, Sparkle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import type { MealType } from '../../lib/db';
import { diag } from '../../lib/diag';
import { type FoodDraft } from '../../lib/food';
import { analyzeMealPhoto, estimateFoodText, refineMeal, totals, type MealAnalysis } from '../../lib/foodAi';
import { photoToDataUrl } from '../../lib/image';
import { MascotSays } from '../Mascot';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Sheet } from '../ui/Sheet';
import { FoodResultCard, MealChips } from './FoodResultCard';

const EXTRAS = ['Cooked in oil or butter', 'Has sauce or dressing', 'With a drink', 'I only ate half', 'It was a big portion'];

interface PhotoMealSheetProps {
  defaultMeal: MealType;
  onClose: () => void;
  onSave: (draft: FoodDraft, mealType: MealType, confidence: 'exact' | 'estimate') => void;
}

type Stage = 'pick' | 'analyzing' | 'result' | 'error';

export function PhotoMealSheet({ defaultMeal, onClose, onSave }: PhotoMealSheetProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [hint, setHint] = useState('');
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [hintAtAnalysis, setHintAtAnalysis] = useState('');
  const [refining, setRefining] = useState(false);
  const [showItems, setShowItems] = useState(false);

  function apply(a: MealAnalysis) {
    setAnalysis(a);
    setDraft(totals(a));
    setAnswers({});
    setExtras([]);
    setHintAtAnalysis(hint);
    setStage('result');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    diag('photo.file', `${file.type || 'unknown'} ${Math.round(file.size / 1024)}KB`);
    setStage('analyzing');
    let dataUrl: string;
    try {
      dataUrl = await photoToDataUrl(file);
    } catch (err) {
      diag('photo.decode', (err as Error).message);
      setError((err as Error).message);
      setStage('error');
      return;
    }
    setPreview(dataUrl);
    diag('photo.upload', `${Math.round(dataUrl.length / 1024)}KB`);
    const result = await analyzeMealPhoto(dataUrl, { mealType, hint });
    if (!result.ok) {
      diag('photo.ai', result.error);
      setError(result.error);
      setStage('error');
      return;
    }
    diag('photo.ai', `ok ${result.data.items.length} items, ${result.data.questions.length} q`);
    apply(result.data);
  }

  async function describeInstead() {
    if (!hint.trim()) return;
    setStage('analyzing');
    const result = await estimateFoodText(hint, mealType);
    if (!result.ok) {
      setError(result.error);
      setStage('error');
      return;
    }
    apply(result.data);
  }

  const changed = Object.keys(answers).length > 0 || extras.length > 0 || hint.trim() !== hintAtAnalysis.trim();

  async function refine() {
    if (!analysis) return;
    setRefining(true);
    const result = await refineMeal(analysis, {
      mealType,
      hint,
      extras,
      answers: analysis.questions.filter((q) => answers[q.id]).map((q) => ({ question: q.question, answer: answers[q.id] })),
    });
    setRefining(false);
    if (result.ok) {
      apply({ ...result.data, questions: [] });
    } else {
      diag('photo.refine', result.error);
      setError(result.error);
    }
  }

  const hiddenInputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </>
  );

  if (stage === 'result' && analysis && draft) {
    return (
      <Sheet
        title="Your meal"
        onClose={onClose}
        tall
        footer={
          <Button size="lg" className="w-full" onClick={() => onSave(draft, mealType, analysis.label ? 'exact' : 'estimate')}>
            Add to {mealType === 'snack' ? 'snacks' : mealType}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {preview && <img src={preview} alt="Your meal" className="h-40 w-full rounded-2xl border-2 border-border object-cover" />}
          <FoodResultCard
            draft={draft}
            onChange={setDraft}
            mealType={mealType}
            onMealType={setMealType}
            badge={analysis.label ? 'Read from the label' : `Estimate · ${analysis.confidence} confidence`}
          >
            <button onClick={() => setShowItems((s) => !s)} className="self-start text-sm font-extrabold text-water-text" aria-expanded={showItems}>
              {showItems ? 'Hide' : 'Show'} what Fibu sees ({analysis.items.length})
            </button>
            {showItems && (
              <ul className="flex flex-col divide-y-2 divide-border-soft rounded-2xl border-2 border-border px-3">
                {analysis.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-extrabold text-text">
                      {it.name} <span className="font-bold text-text-faint">· {it.grams} g</span>
                    </span>
                    <span className="tabular shrink-0 font-black text-text">{it.calories} kcal</span>
                  </li>
                ))}
              </ul>
            )}
          </FoodResultCard>

          {!analysis.label && (
            <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-border p-3.5">
              <MascotSays pose="head" size={40} bob={false}>
                {analysis.questions.length ? 'A couple of quick questions so I get this right:' : 'Anything the camera might have missed?'}
              </MascotSays>
              {analysis.questions.map((q) => (
                <div key={q.id} className="flex flex-col gap-2">
                  <span className="text-[15px] font-extrabold text-text">{q.question}</span>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <Chip key={o} active={answers[q.id] === o} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o }))}>
                        {o}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-2">
                <span className="text-[15px] font-extrabold text-text">Anything I can't see?</span>
                <div className="flex flex-wrap gap-2">
                  {EXTRAS.map((x) => (
                    <Chip key={x} active={extras.includes(x)} onClick={() => setExtras((prev) => (prev.includes(x) ? prev.filter((e) => e !== x) : [...prev, x]))}>
                      {x}
                    </Chip>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-[15px] font-extrabold text-text">What is it, exactly? (optional)</span>
                <input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="e.g. lamb curry with basmati rice"
                  className="h-12 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
                />
              </label>
              <Button variant="secondary" disabled={!changed || refining} onClick={refine}>
                <ArrowsClockwise size={18} weight="bold" className={refining ? 'animate-spin' : ''} />
                {refining ? 'Updating…' : 'Update estimate'}
              </Button>
              {error && <p className="text-sm font-bold text-danger">{error}</p>}
            </div>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Snap your meal" onClose={onClose}>
      {hiddenInputs}
      {stage === 'pick' && (
        <div className="flex flex-col gap-4">
          <MascotSays pose="head" size={44} bob={false}>
            Take a photo of your plate or a nutrition label. Tell me what it is for a sharper estimate.
          </MascotSays>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-text-muted">What is it? (optional)</span>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. chicken stir-fry with noodles"
              className="h-12 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-[15px] font-bold text-text outline-none placeholder:text-text-faint focus:border-accent"
            />
          </label>
          <MealChips value={mealType} onChange={setMealType} />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="press-3d flex flex-col items-center gap-2 rounded-2xl border-2 border-accent bg-accent py-5 font-extrabold text-accent-ink [--ledge-color:var(--color-accent-ledge)]"
            >
              <Camera size={30} weight="fill" /> Take photo
            </button>
            <button
              onClick={() => libraryRef.current?.click()}
              className="press-3d flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-bg-raised py-5 font-extrabold text-text [--ledge-color:var(--color-border)]"
            >
              <ImageSquare size={30} weight="fill" /> From photos
            </button>
          </div>
          {hint.trim().length > 2 && (
            <Button variant="secondary" onClick={describeInstead}>
              <Sparkle size={18} weight="fill" /> No photo, just estimate “{hint.trim()}”
            </Button>
          )}
        </div>
      )}

      {stage === 'analyzing' && (
        <div className="flex flex-col items-center gap-4 py-4">
          {preview ? (
            <div className="relative w-full overflow-hidden rounded-2xl border-2 border-border">
              <img src={preview} alt="" className="h-52 w-full object-cover" />
              <div className="absolute inset-x-0 top-0 h-1/3 animate-[scan_1.6s_var(--ease-in-out)_infinite] bg-gradient-to-b from-transparent via-white/40 to-transparent" />
            </div>
          ) : (
            <img src="/mascot/fibu-stand.webp" alt="" className="animate-idle-bob h-40 w-auto" />
          )}
          <p className="text-[15px] font-extrabold text-text-muted" aria-live="polite">
            Looking at your plate…
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col gap-4">
          <MascotSays pose="head" size={44} bob={false}>
            {error}
          </MascotSays>
          <Button onClick={() => setStage('pick')}>Try again</Button>
        </div>
      )}
    </Sheet>
  );
}
