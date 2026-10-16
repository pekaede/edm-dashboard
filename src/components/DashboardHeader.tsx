import { DATA } from "../data";

export function DashboardHeader() {
  return (
    <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {DATA.meta.title}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          {DATA.meta.range} · {DATA.meta.rangeLabel} · {DATA.meta.market} · 数据来源{" "}
          {DATA.meta.source}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["美国市场", "Milled", "196 封样本", "6 品牌 × 3 周"].map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 ring-1 ring-white/15"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
