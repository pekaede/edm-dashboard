import { useId, type ReactNode } from "react";

interface CardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function Card({ title, hint, children }: CardProps) {
  const titleId = useId();

  return (
    <section className="dashboard-card h-full gap-[var(--card-padding)] sm:gap-[var(--card-padding-sm)]" aria-labelledby={titleId}>
      <header className="min-w-0 space-y-[calc(var(--card-padding)/2)]">
        <h2 id={titleId} className="card-title text-[var(--text-heading)]">
          {title}
        </h2>
        {hint ? <p className="text-[length:var(--type-body-size)] leading-[var(--type-body-leading)] text-[var(--text-secondary)]">{hint}</p> : null}
      </header>
      <div className="min-w-0 flex-1 text-[length:var(--type-body-size)] leading-[var(--type-body-leading)] text-[var(--text-body)]">{children}</div>
    </section>
  );
}
