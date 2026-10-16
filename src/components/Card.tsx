import { useId, type ReactNode } from "react";

interface CardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ title, hint, children }: CardProps) {
  const titleId = useId();

  return (
    <section className="dashboard-card h-full" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
          {title}
        </h2>
        {hint ? <p className="mt-1.5 text-sm leading-5 text-slate-600">{hint}</p> : null}
      </div>
      <div className="mt-4 min-w-0 flex-1 sm:mt-5">{children}</div>
    </section>
  );
}
