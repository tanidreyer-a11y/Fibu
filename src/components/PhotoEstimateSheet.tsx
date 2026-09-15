import { useRef, useState } from 'react';
import type { FoodEntry } from '../lib/db';
import { estimateMealFromPhoto } from '../lib/coach';
import { Button } from './ui/Button';

type Stage = 'pick' | 'estimating' | 'result' | 'error';

interface PhotoEstimateSheetProps {
  onClose: () => void;
  onSave: (entry: Pick<FoodEntry, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'>) => void;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(',')[1] ?? '', mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-11 rounded-xl border border-border bg-bg-raised-2 px-3 text-[15px] font-semibold text-text outline-none focus:border-accent"
      />
    </label>
  );
}

export function PhotoEstimateSheet({ onClose, onSave }: PhotoEstimateSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState(0);
  const [proteinG, setProteinG] = useState(0);
  const [carbsG, setCarbsG] = useState(0);
  const [fatG, setFatG] = useState(0);

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setStage('estimating');
    const { base64, mimeType } = await fileToBase64(file);
    const result = await estimateMealFromPhoto(base64, mimeType);
    if (!result.ok) {
      setError(result.error);
      setStage('error');
      return;
    }
    setName(result.data.name);
    setCalories(result.data.calories);
    setProteinG(result.data.proteinG);
    setCarbsG(result.data.carbsG);
    setFatG(result.data.fatG);
    setStage('result');
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-border-soft bg-bg-raised p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="font-display text-lg font-semibold text-text">Estimate from photo</h2>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {stage === 'pick' && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-text-muted transition-colors duration-150 hover:border-text-faint"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="3.5" />
              <path d="M8 6l1.5-2h5L16 6" strokeLinecap="round" />
            </svg>
            <span className="text-sm">Take or choose a photo</span>
          </button>
        )}

        {preview && stage !== 'pick' && <img src={preview} alt="" className="h-40 w-full rounded-xl object-cover" />}

        {stage === 'estimating' && <p className="py-4 text-center text-sm text-text-muted">Estimating…</p>}

        {stage === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => setStage('pick')}>
              Try again
            </Button>
          </div>
        )}

        {stage === 'result' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-accent-dim px-3 py-2 text-xs font-medium text-accent">
              Estimate only — edit anything that looks off before saving.
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Meal</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl border border-border bg-bg-raised-2 px-4 text-[15px] text-text outline-none focus:border-accent"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories" value={calories} onChange={setCalories} />
              <Field label="Protein (g)" value={proteinG} onChange={setProteinG} />
              <Field label="Carbs (g)" value={carbsG} onChange={setCarbsG} />
              <Field label="Fat (g)" value={fatG} onChange={setFatG} />
            </div>
            <Button size="lg" disabled={!name.trim() || calories <= 0} onClick={() => onSave({ name: name.trim(), calories, proteinG, carbsG, fatG })}>
              Add to today
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
