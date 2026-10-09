import { CheckCircle, Flashlight, Keyboard, MagnifyingGlass, Camera, PencilSimpleLine, X } from '@phosphor-icons/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import type { MealType } from '../../lib/db';
import { diag } from '../../lib/diag';
import type { FoodDraft } from '../../lib/food';
import { lookupBarcode, scaleToGrams, type OffProduct } from '../../lib/openFoodFacts';
import { MascotSays } from '../Mascot';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Sheet } from '../ui/Sheet';
import { FoodResultCard } from './FoodResultCard';

type Stage = 'scanning' | 'looking-up' | 'result' | 'not-found' | 'camera-error' | 'typing' | 'added';

// Only the formats food packaging uses: faster decodes and fewer misreads than "everything".
const RETAIL_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
  [DecodeHintType.TRY_HARDER, true],
]);

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector;
  }
}

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (!window.isSecureContext) return 'The camera only works over a secure (https) link.';
  if (!navigator.mediaDevices?.getUserMedia) return "This browser can't open the camera here. Type the barcode number instead.";
  switch (name) {
    case 'NotAllowedError':
      return 'Camera access is off for Fibu. On iPhone: Settings → Safari → Camera → Allow (or tap “aA” in the address bar → Website Settings), then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "Couldn't find a back camera on this device.";
    case 'NotReadableError':
      return 'Another app is using the camera. Close it and try again.';
    default:
      return `The camera didn't start (${name || 'unknown error'}). Type the number or try again.`;
  }
}

interface BarcodeScanSheetProps {
  defaultMeal: MealType;
  onClose: () => void;
  onSave: (draft: FoodDraft, mealType: MealType, barcode: string) => void;
  onSearchInstead: () => void;
  onPhotoInstead: () => void;
  onManualInstead: () => void;
}

export function BarcodeScanSheet({ defaultMeal, onClose, onSave, onSearchInstead, onPhotoInstead, onManualInstead }: BarcodeScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>('scanning');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [addedName, setAddedName] = useState('');

  // The camera runs only while scanning; each return to "scanning" restarts it (batch scanning).
  useEffect(() => {
    if (stage !== 'scanning' || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;
    let stopZxing: (() => void) | null = null;
    let timer: number | undefined;
    let stream: MediaStream | null = null;

    const found = (text: string) => {
      if (cancelled) return;
      cancelled = true;
      navigator.vibrate?.(60);
      diag('scan.code', text);
      void handleCode(text);
    };

    (async () => {
      try {
        if (window.BarcodeDetector) {
          // Fast native path (Android Chrome). iPhone Safari has no BarcodeDetector and uses zxing below.
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
          diag('scan.engine', 'native');
          const tick = async () => {
            if (cancelled) return;
            try {
              const hits = await detector.detect(video);
              if (hits[0]?.rawValue) return found(hits[0].rawValue);
            } catch {
              // a dropped frame; keep going
            }
            timer = window.setTimeout(tick, 120);
          };
          void tick();
        } else {
          diag('scan.engine', 'zxing');
          const reader = new BrowserMultiFormatReader(RETAIL_HINTS, { delayBetweenScanAttempts: 100 });
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
            video,
            (result) => {
              if (result) found(result.getText());
            },
          );
          stopZxing = () => controls.stop();
          if (cancelled) controls.stop();
          stream = video.srcObject as MediaStream | null;
        }
        const track = stream?.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: !!caps.torch, on: false });
        diag('scan.video', `${video.videoWidth}x${video.videoHeight} rs${video.readyState}`);
      } catch (err) {
        if (cancelled) return;
        diag('scan.error', `${(err as Error).name}: ${(err as Error).message}`);
        setError(cameraErrorMessage(err));
        setStage('camera-error');
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
    // handleCode is stable for this sheet's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function toggleTorch() {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  async function handleCode(raw: string) {
    const clean = raw.replace(/\D/g, '');
    setCode(clean || raw);
    setStage('looking-up');
    const result = await lookupBarcode(clean || raw);
    if (!result.ok) {
      diag('scan.lookup', result.error);
      setError(result.message);
      setStage('not-found');
      return;
    }
    const p = result.data;
    const startGrams = p.servingGrams ?? 100;
    setProduct(p);
    setGrams(startGrams);
    setDraft({ name: p.brand ? `${p.name} (${p.brand})` : p.name, ...scaleToGrams(p, startGrams), servingLabel: p.servingGrams ? p.servingSize : `${startGrams} g` });
    setStage('result');
  }

  function setAmount(g: number) {
    if (!product || !draft) return;
    const safe = Math.max(0, Math.min(5000, g));
    setGrams(safe);
    setDraft({ ...draft, ...scaleToGrams(product, safe), servingLabel: `${Math.round(safe)} g` });
  }

  if (stage === 'scanning' || stage === 'looking-up') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Scan a barcode">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
        <div className="relative flex items-center justify-between px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
          <button onClick={onClose} aria-label="Close scanner" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white">
            <X size={22} weight="bold" />
          </button>
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-extrabold text-white">Scan a barcode</span>
          {torch.supported ? (
            <button onClick={toggleTorch} aria-pressed={torch.on} aria-label="Torch" className={`grid h-11 w-11 place-items-center rounded-full ${torch.on ? 'bg-xp text-black' : 'bg-black/50 text-white'}`}>
              <Flashlight size={22} weight="fill" />
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative h-40 w-[82%] max-w-sm rounded-2xl border-4 border-white/90" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
            {stage === 'scanning' && <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse rounded-full bg-brand" />}
            {stage === 'looking-up' && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/60 text-[15px] font-extrabold text-white" aria-live="polite">
                Found {code}. Looking it up…
              </div>
            )}
          </div>
        </div>
        <div className="relative flex flex-col items-center gap-3 px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}>
          <p className="text-center text-sm font-bold text-white/85">Hold the barcode inside the box, about a hand's length away.</p>
          <div className="flex gap-2">
            <button onClick={() => setStage('typing')} className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-extrabold text-white">
              <Keyboard size={18} weight="bold" /> Type number
            </button>
            <button onClick={onSearchInstead} className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-extrabold text-white">
              <MagnifyingGlass size={18} weight="bold" /> Search by name
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'result' && product && draft) {
    const servingOptions = [
      ...(product.servingGrams ? [{ label: `1 serving (${product.servingGrams} g)`, grams: product.servingGrams }] : []),
      ...(product.servingGrams ? [{ label: `2 servings`, grams: product.servingGrams * 2 }] : []),
      { label: '100 g', grams: 100 },
    ];
    return (
      <Sheet
        title="Scanned"
        onClose={onClose}
        tall
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={grams <= 0}
            onClick={() => {
              onSave(draft, mealType, code);
              setAddedName(draft.name);
              setStage('added');
            }}
          >
            Add to {mealType === 'snack' ? 'snacks' : mealType}
          </Button>
        }
      >
        <FoodResultCard draft={draft} onChange={setDraft} mealType={mealType} onMealType={setMealType} badge={`From the package · per ${Math.round(grams)} g`}>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-text-muted">How much did you have?</span>
            <div className="flex flex-wrap gap-2">
              {servingOptions.map((o) => (
                <Chip key={o.label} active={Math.round(grams) === Math.round(o.grams)} onClick={() => setAmount(o.grams)}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-text-muted">Or exactly</span>
              <input
                type="text"
                inputMode="decimal"
                value={String(Math.round(grams))}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                aria-label="Grams eaten"
                className="tabular h-11 w-24 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-center text-[16px] font-black text-text outline-none focus:border-accent"
              />
              <span className="text-sm font-extrabold text-text-faint">g</span>
            </label>
          </div>
        </FoodResultCard>
      </Sheet>
    );
  }

  if (stage === 'added') {
    return (
      <Sheet title="Added" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle size={56} weight="fill" className="animate-pop-in text-success" />
          <p className="text-[16px] font-extrabold text-text">{addedName} is in your {mealType === 'snack' ? 'snacks' : mealType}.</p>
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Done
            </Button>
            <Button className="flex-1" onClick={() => setStage('scanning')}>
              Scan another
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  if (stage === 'typing') {
    return (
      <Sheet title="Type the barcode" onClose={onClose}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim().length >= 6) void handleCode(typed.trim());
          }}
        >
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="The numbers under the bars"
            aria-label="Barcode number"
            className="tabular h-14 rounded-2xl border-2 border-border-strong bg-bg-raised px-4 text-xl font-black tracking-wider text-text outline-none placeholder:text-base placeholder:font-bold placeholder:tracking-normal placeholder:text-text-faint focus:border-accent"
          />
          <Button size="lg" disabled={typed.trim().length < 6}>
            Look it up
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStage('scanning')}>
            Back to the camera
          </Button>
        </form>
      </Sheet>
    );
  }

  // not-found or camera-error: say exactly what happened and offer the next best way in.
  return (
    <Sheet title={stage === 'camera-error' ? "Camera didn't start" : 'Not in the database'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <MascotSays pose="head" size={44} bob={false}>
          {stage === 'not-found' && code ? (
            <>
              I read <span className="tabular font-black">{code}</span> fine. {error}
            </>
          ) : (
            error
          )}
        </MascotSays>
        <div className="flex flex-col gap-2.5">
          <Button onClick={onPhotoInstead}>
            <Camera size={18} weight="fill" /> Snap the nutrition label
          </Button>
          <Button variant="secondary" onClick={onSearchInstead}>
            <MagnifyingGlass size={18} weight="bold" /> Search by name
          </Button>
          <Button variant="secondary" onClick={onManualInstead}>
            <PencilSimpleLine size={18} weight="bold" /> Enter it myself
          </Button>
          <Button variant="ghost" onClick={() => setStage(stage === 'camera-error' ? 'typing' : 'scanning')}>
            {stage === 'camera-error' ? 'Type the number instead' : 'Scan again'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
