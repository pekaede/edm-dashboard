import { DATA } from "../data";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

export function DashboardHeader() {
  const tags = [
    { label: DATA.meta.market, theme: "price" },
    { label: DATA.meta.source, theme: "behavior" },
    { label: `${DATA.meta.total} 封样本`, theme: "new" },
    {
      label: `${DATA.meta.brandCount} 品牌 × ${DATA.meta.weekCount} 周`,
      theme: "lifestyle",
    },
  ];

  return (
    <header className="dashboard-container py-5 sm:py-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Email Marketing Intelligence</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            {DATA.meta.title}
          </h1>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="数据范围摘要">
            {tags.map(({ label, theme }) => (
              <li
                key={label}
                className="rounded-full border px-3 py-1.5 text-sm font-semibold text-slate-800"
                style={{
                  borderColor: THEME_COLORS[theme],
                  background: THEME_TINTS[theme],
                }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 border-l-2 border-[var(--theme-category)] pl-3 lg:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">研究周期</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{DATA.meta.range}</p>
        </div>
      </div>
    </header>
  );
}
