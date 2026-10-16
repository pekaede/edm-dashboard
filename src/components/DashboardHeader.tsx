import { DATA } from "../data";

export function DashboardHeader() {
  return (
    <header className="relative isolate overflow-hidden border-b border-white/10 bg-[linear-gradient(120deg,#111827_0%,#172033_48%,#18223a_100%)] text-slate-100">
      <div className="absolute -left-24 -top-40 h-80 w-80 rounded-full bg-indigo-500/12 blur-3xl" />
      <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-sky-400/8 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-indigo-300 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_12px_rgb(129_140_248/0.8)]" />
          {DATA.meta.market} · {DATA.meta.source}
        </div>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl lg:text-[42px] lg:leading-tight">
          {DATA.meta.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
          {DATA.meta.range} · {DATA.meta.rangeLabel} · {DATA.meta.market} · 数据来源{" "}
          {DATA.meta.source}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {["美国市场", "Milled", "196 封样本", "6 品牌 × 3 周"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
