import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Chip({
  active = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${
        active
          ? 'border-accent bg-accent-dim text-accent'
          : 'border-border bg-bg-raised-2 text-text-muted hover:text-text hover:border-text-faint'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
