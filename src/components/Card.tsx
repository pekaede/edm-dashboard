import type { ReactNode } from "react";

interface CardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ title, hint, children }: CardProps) {
  return (
    <section className="dashboard-card group/card h-full overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_28px_rgb(58_76_110/0.055)] transition duration-300 hover:border-slate-300/90 hover:shadow-[0_12px_34px_rgb(58_76_110/0.075)] sm:p-5">
      <div>
        <h2 className="text-lg font-bold tracking-[-0.02em] text-slate-950 sm:text-xl">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
