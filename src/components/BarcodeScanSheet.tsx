import { BrowserMultiFormatReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import type { FoodEntry } from '../lib/db';
import { lookupBarcode, scaleToGrams, type OffProduct } from '../lib/openFoodFacts';
import { Button } from './ui/Button';

type Stage = 'scanning' | 'looking-up' | 'result' | 'added' | 'error';

interface BarcodeScanSheetProps {
  onClose: () => void;
  onSave: (entry: Pick<FoodEntry, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'>) => void;
}

export function BarcodeScanSheet({ onClose, onSave }: BarcodeScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [stage, setStage] = useState<Stage>('scanning');
  const [error, setError] = useState('');
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [manualCode, setManualCode] = useState('');

  // Re-runs every time we return to "scanning" — this is what makes batch
  // scanning (item after item without closing the camera) actually work.
  useEffect(() => {
    if (stage !== 'scanning' || !videoRef.current) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result, _err, controls) => {
        controlsRef.current = controls;
        if (result && !cancelled) {
          controls.stop();
          handleCode(result.getText());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Camera access was denied or unavailable — enter the barcode manually below.');
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
    setStage('looking-up');
    const result = await lookupBarcode(code);
    if (!result.ok) {
      setError(result.error);
      setStage('error');
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

  const scaled = product ? scaleToGrams(product, grams) : null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex max-h-[85vh] flex-col gap-4 rounded-t-3xl border-t border-border-soft bg-bg-raised p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="font-display text-lg font-semibold text-text">Scan barcode</h2>

        {(stage === 'scanning' || stage === 'looking-up') && (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
              {stage === 'looking-up' && (
                <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">Looking it up…</div>
              )}
            </div>
            <p className="text-center text-xs text-text-faint">Point the camera at the barcode.</p>
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
