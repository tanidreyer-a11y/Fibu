import { Minus, Plus } from '@phosphor-icons/react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  suffix?: string;
}

const stepButton =
  'press-3d press-3d-sm grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-border bg-bg-raised text-text-muted [--ledge-color:var(--color-border)] [@media(hover:hover)]:hover:text-text';

export function NumberStepper({ value, onChange, step = 1, min = 0, max = 999, label, suffix }: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-sm font-bold text-text-muted">{label}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease${label ? ' ' + label : ''}`}
          className={stepButton}
          onClick={() => onChange(clamp(Math.round((value - step) * 100) / 100))}
        >
          <Minus size={18} weight="bold" />
        </button>
        <div className="flex min-w-[6.5rem] items-baseline justify-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            aria-label={label}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) onChange(clamp(v));
            }}
            className="font-display w-20 bg-transparent text-center text-[28px] font-black text-text outline-none"
          />
          {suffix && <span className="text-sm font-bold text-text-faint">{suffix}</span>}
        </div>
        <button
          type="button"
          aria-label={`Increase${label ? ' ' + label : ''}`}
          className={stepButton}
          onClick={() => onChange(clamp(Math.round((value + step) * 100) / 100))}
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
