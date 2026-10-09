import { BUILD_TAG, diagEnabled, useDiag } from '../lib/diag';

/** Fixed readout shown only with ?diag=1 (or localStorage fibu:diag=1). */
export function DiagPanel() {
  const entries = useDiag((s) => s.entries);
  if (!diagEnabled()) return null;
  const base: Record<string, string> = {
    build: BUILD_TAG,
    secure: String(window.isSecureContext),
    standalone: String(window.matchMedia('(display-mode: standalone)').matches),
    camera: String(!!navigator.mediaDevices?.getUserMedia),
    online: String(navigator.onLine),
    ua: navigator.userAgent.replace(/.*(iPhone OS [\d_]+|Android [\d.]+).*/, '$1'),
  };
  return (
    <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+4px)] left-1 z-50 max-w-[70vw] rounded-lg bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300">
      {Object.entries({ ...base, ...entries }).map(([k, v]) => (
        <div key={k} className="truncate">
          {k}: {v}
        </div>
      ))}
    </div>
  );
}
