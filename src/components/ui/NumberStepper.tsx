interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  suffix?: string;
}

export function NumberStepper({ value, onChange, step = 1, min = 0, max = 999, label, suffix }: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && <span className="text-xs font-medium text-text-faint uppercase tracking-wide">{label}</span>}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-raised-2">
        <button
          type="button"
          aria-label={`Decrease${label ? ' ' + label : ''}`}
          className="grid h-11 w-11 shrink-0 place-items-center text-lg text-text-muted transition-colors duration-150 hover:text-text active:scale-[0.9]"
          onClick={() => onChange(clamp(Math.round((value - step) * 100) / 100))}
        >
          &minus;
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(clamp(v));
          }}
          className="font-display h-11 w-16 shrink-0 bg-transparent text-center text-lg font-semibold text-text outline-none"
        />
        {suffix && <span className="pr-1 text-xs text-text-faint">{suffix}</span>}
        <button
          type="button"
          aria-label={`Increase${label ? ' ' + label : ''}`}
          className="grid h-11 w-11 shrink-0 place-items-center text-lg text-text-muted transition-colors duration-150 hover:text-text active:scale-[0.9]"
          onClick={() => onChange(clamp(Math.round((value + step) * 100) / 100))}
        >
          +
        </button>
      </div>
    </div>
  );
}
