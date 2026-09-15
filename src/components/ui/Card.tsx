import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-border-soft bg-bg-raised p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
