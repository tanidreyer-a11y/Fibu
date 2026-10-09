import { X } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** pinned under the scroll area, e.g. the main action */
  footer?: ReactNode;
  /** content-height sheet (default) or a fixed tall sheet for long lists */
  tall?: boolean;
  /** optional element left of the title, e.g. a back button */
  leading?: ReactNode;
}

/** Bottom sheet: slides up on the drawer curve, closes on backdrop tap or Escape. */
export function Sheet({ title, onClose, children, footer, tall = false, leading }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 animate-[fade-in_200ms_ease-out_both] bg-black/50" onClick={onClose} />
      <div
        className={`relative mx-auto flex w-full max-w-md animate-[sheet-up_300ms_var(--ease-drawer)_both] flex-col rounded-t-3xl border-2 border-b-0 border-border bg-bg-raised ${
          tall ? 'h-[88dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-3">
          {leading}
          <h2 className="font-display min-w-0 flex-1 truncate text-lg font-extrabold text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-text-faint transition-colors duration-150 [@media(hover:hover)]:hover:bg-bg-raised-2 [@media(hover:hover)]:hover:text-text"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t-2 border-border-soft px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>
  );
}
