import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import type { FoodEntry } from '../lib/db';
import { lookupBarcode, scaleToGrams, type OffProduct } from '../lib/openFoodFacts';
import { Button } from './ui/Button';

type Stage = 'scanning' | 'looking-up' | 'result' | 'not-found' | 'added' | 'error';

interface BarcodeScanSheetProps {
  onClose: () => void;
  onSave: (entry: Pick<FoodEntry, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'>) => void;
}

// Restricting to the formats retail food packaging actually uses (rather than
// every format zxing knows, including 2D ones like QR/PDF417/Aztec) cuts down
// both decode time and false-positive misreads on a noisy phone-camera frame.
const RETAIL_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
  [DecodeHintType.TRY_HARDER, true],
]);

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder="0"
        className="h-11 rounded-xl border border-border bg-bg-raised-2 px-3 text-[15px] font-semibold text-text outline-none focus:border-accent"
      />
    </label>
  );
}

export function BarcodeScanSheet({ onClose, onSave }: BarcodeScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [stage, setStage] = useState<Stage>('scanning');
  const [error, setError] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [manualCode, setManualCode] = useState('');

  // manual-entry fallback fields, used both from the camera-error state and the not-found state
  const [name, setName] = useState('');
  const [calories, setCalories] = useState(0);
  const [proteinG, setProteinG] = useState(0);
  const [carbsG, setCarbsG] = useState(0);
  const [fatG, setFatG] = useState(0);

  // Re-runs every time we return to "scanning" — this is what makes batch
  // scanning (item after item without closing the camera) actually work.
  useEffect(() => {
    if (stage !== 'scanning' || !videoRef.current) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader(RETAIL_HINTS, { delayBetweenScanAttempts: 100 });

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
        videoRef.current,
        (result, _err, controls) => {
          controlsRef.current = controls;
          if (result && !cancelled) {
            controls.stop();
            handleCode(result.getText());
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setError('Camera access was denied or unavailable.');
          setStage('error');
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function handleCode(code: string) {
    setScannedCode(code);
    setStage('looking-up');
    const result = await lookupBarcode(code);
    if (!result.ok) {
      // A failed lookup is not the same problem as a failed scan — the code
      // WAS read correctly, it just isn't in the database. Show that plainly
      // instead of a dead-end error, and let manual entry pick up from here.
      setName('');
      setCalories(0);
      setProteinG(0);
      setCarbsG(0);
      setFatG(0);
      setStage('not-found');
      return;
    }
    setProduct(result.data);
    setGrams(100);
    setStage('result');
  }

  function save() {
    if (!product || !scaled) return;
    onSave({ name: product.name, calories: scaled.calories, proteinG: scaled.proteinG, carbsG: scaled.carbsG, fatG: scaled.fatG });
    setStage('added');
  }

  function saveManual() {
    onSave({ name: name.trim(), calories, proteinG, carbsG, fatG });
    setStage('added');
  }

  const scaled = product ? scaleToGrams(product, grams) : null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-border-soft bg-bg-raised p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="font-display text-lg font-semibold text-text">Scan barcode</h2>

        {(stage === 'scanning' || stage === 'looking-up') && (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
              {stage === 'scanning' && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="h-20 w-[80%] rounded-lg border-2 border-white/70" style={{ boxShadow: '0 0 0 999px rgba(0,0,0,0.35)' }} />
                </div>
              )}
              {stage === 'looking-up' && (
                <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">Looking it up…</div>
              )}
            </div>
            <p className="text-center text-xs text-text-faint">Line the barcode up inside the box, steady and well-lit.</p>
            <button onClick={() => setStage('not-found')} className="text-center text-xs font-medium text-text-faint underline">
              Enter it manually instead
            </button>
          </div>
        )}

        {stage === 'error' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger">{error}</p>
            <div className="flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode number"
                inputMode="numeric"
                className="h-11 flex-1 rounded-xl border border-border bg-bg-raised-2 px-4 text-sm text-text outline-none focus:border-accent"
              />
              <Button disabled={!manualCode.trim()} onClick={() => handleCode(manualCode.trim())}>
                Look up
              </Button>
            </div>
            <button onClick={() => setStage('not-found')} className="text-center text-xs font-medium text-text-faint underline">
              Or just log it manually
            </button>
          </div>
        )}

        {stage === 'result' && product && scaled && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-medium text-text">{product.name}</p>
              <p className="text-xs text-text-faint">
                Per 100g: {product.caloriesPer100g} kcal · {product.proteinPer100g}g protein
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Amount eaten (g)</span>
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(parseFloat(e.target.value) || 0)}
                className="h-11 rounded-xl border border-border bg-bg-raised-2 px-4 text-[15px] font-semibold text-text outline-none focus:border-accent"
              />
            </label>
            <div className="rounded-xl bg-bg-raised-2 p-4 text-sm text-text-muted">
              {scaled.calories} kcal · {scaled.proteinG}g protein · {scaled.carbsG}g carbs · {scaled.fatG}g fat
            </div>
            <Button size="lg" onClick={save}>
              Add to today
            </Button>
          </div>
        )}

        {stage === 'not-found' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-accent-dim px-3 py-2 text-xs font-medium text-accent">
              {scannedCode ? (
                <>
                  Scanned <span className="font-mono">{scannedCode}</span> fine — it just isn't in the free food database. Log it manually, takes ten
                  seconds.
                </>
              ) : (
                "No problem — log it manually."
              )}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">What was it</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Store-brand granola bar"
                className="h-11 rounded-xl border border-border bg-bg-raised-2 px-4 text-[15px] text-text placeholder:text-text-faint outline-none focus:border-accent"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories" value={calories} onChange={setCalories} />
              <Field label="Protein (g)" value={proteinG} onChange={setProteinG} />
              <Field label="Carbs (g)" value={carbsG} onChange={setCarbsG} />
              <Field label="Fat (g)" value={fatG} onChange={setFatG} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStage('scanning')}>
                Try scanning again
              </Button>
              <Button className="flex-1" disabled={!name.trim() || calories <= 0} onClick={saveManual}>
                Add to today
              </Button>
            </div>
          </div>
        )}

        {stage === 'added' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm font-medium text-accent">Added ✓</p>
            <div className="flex w-full gap-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Done
              </Button>
              <Button className="flex-1" onClick={() => setStage('scanning')}>
                Scan another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
