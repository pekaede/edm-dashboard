import type { ReactNode } from "react";

interface CardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ title, hint, children }: CardProps) {
  return (
    <section className="group/card h-full rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03),0_12px_32px_rgb(15_23_42/0.045)] transition duration-300 hover:border-slate-300/80 hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_40px_rgb(15_23_42/0.065)] sm:p-6 lg:p-8">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-5 w-1 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-slate-950 sm:text-xl">
            {title}
          </h2>
          {hint ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{hint}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
