import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-display font-extrabold select-none disabled:pointer-events-none';

// Disabled buttons go flat grey (not just faded) so "you can't tap this yet" reads at a glance.
const pressable =
  'press-3d disabled:bg-bg-raised-2 disabled:text-text-faint disabled:border-transparent disabled:[--ledge-color:var(--color-border)]';

const variants: Record<Variant, string> = {
  primary: `${pressable} bg-accent text-accent-ink [--ledge-color:var(--color-accent-ledge)] [@media(hover:hover)]:hover:brightness-105`,
  secondary: `${pressable} border-2 border-border bg-bg-raised text-text [--ledge-color:var(--color-border)] [@media(hover:hover)]:hover:bg-bg-raised-2`,
  danger: `${pressable} border-2 border-border bg-bg-raised text-danger [--ledge-color:var(--color-border)]`,
  success: `${pressable} bg-success text-accent-ink [--ledge-color:#22700c]`,
  ghost:
    'bg-transparent text-text-muted transition-colors duration-150 active:opacity-70 [@media(hover:hover)]:hover:text-text disabled:opacity-40',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm',
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-base uppercase tracking-[0.06em]',
  icon: 'h-12 w-12',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
