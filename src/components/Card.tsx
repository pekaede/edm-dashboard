import type { ReactNode } from "react";

interface CardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ title, hint, children }: CardProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
