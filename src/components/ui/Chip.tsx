import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Chip({
  active = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      aria-pressed={active}
      className={`press-3d press-3d-sm inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3.5 py-2 text-sm font-bold ${
        active
          ? 'border-accent bg-accent-tint text-accent-text [--ledge-color:var(--color-accent)]'
          : 'border-border bg-bg-raised text-text-muted [--ledge-color:var(--color-border)] [@media(hover:hover)]:hover:text-text'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
