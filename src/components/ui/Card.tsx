import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/** A chunky bordered panel: 2px edge with a 4px bottom so it sits on the page like a tile. */
export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`rounded-2xl border-2 border-b-4 border-border bg-bg-raised p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

/** A card you can tap: it sinks into its ledge on press, like the buttons. */
export function PressCard({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`press-3d w-full rounded-2xl border-2 border-border bg-bg-raised p-4 text-left [--ledge-color:var(--color-border)] [@media(hover:hover)]:hover:bg-bg-raised-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
