import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 font-display font-medium rounded-xl transition-[transform,background-color,box-shadow,border-color] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'bg-bg-raised-2 text-text border border-border hover:border-text-faint',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-bg-raised',
  danger: 'bg-danger-dim text-danger border border-danger/30 hover:bg-danger/20',
};

const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-13 px-6 text-base',
  icon: 'h-11 w-11',
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
