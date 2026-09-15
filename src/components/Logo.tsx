/** The F+bolt mark alone, no background tile — for in-app chrome (unlike public/icon.svg, the app-icon version). */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect x="152" y="120" width="64" height="272" fill="currentColor" />
      <rect x="152" y="120" width="208" height="64" fill="currentColor" />
      <rect x="152" y="232" width="160" height="64" fill="currentColor" />
      <polygon points="268.5,131 143.5,281 256,281 243.5,381 368.5,231 256,231" fill="var(--color-accent)" />
    </svg>
  );
}

/** Mark + wordmark, with the brand tagline. Used once at the top of onboarding, not sprinkled throughout the app. */
export function LogoLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={40} className="text-text shrink-0" />
      <div>
        <div className="font-display text-[22px] font-bold leading-none tracking-tight text-text">FIBU</div>
        {tagline && <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">Move &middot; Progress &middot; Achieve</div>}
      </div>
    </div>
  );
}
