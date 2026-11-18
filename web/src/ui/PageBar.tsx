import type { ReactNode } from 'react';

/** Header bar for the secondary pages (replay, how, cast). */
export function PageBar({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="replay-bar">
      <div className="brand">{title}{subtitle && <span className="muted"> · {subtitle}</span>}</div>
      {children}
    </div>
  );
}
