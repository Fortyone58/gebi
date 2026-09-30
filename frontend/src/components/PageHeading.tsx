import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</p>}
        <h1 className="text-[23px] font-bold leading-8 text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
