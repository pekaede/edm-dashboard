import { DATA } from "../data";
import { Card } from "./Card";
import { TOTAL } from "./dashboard";

function getHeatmapStyle(count: number) {
  // Sequential blue scale (hue 218)
  const min = 1;
  const max = 21;
  const ratio = (count - min) / (max - min);
  const lightness = 93 - ratio * 46; // from 93% down to 47%
  const isDark = count >= 14;

  return {
    background: `hsl(218 86% ${lightness.toFixed(1)}%)`,
    color: isDark ? "#ffffff" : "#1e293b",
  };
}

export function CampaignOverview() {
  const weekTotals = DATA.weeks.map((_, i) =>
    DATA.brands.reduce((s, b) => s + b.weekly[i], 0),
  );

  return (
    <Card title="品牌 × 周 × Campaign 主题">
      <div className="relative overflow-visible">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <th className="py-2.5 pl-3 pr-2 text-left font-semibold">品牌</th>
              {DATA.weeks.map((w) => (
                <th key={w.id} className="px-2 py-2.5 text-center font-semibold">
                  {w.label}
                </th>
              ))}
              <th className="px-2 py-2.5 text-center font-semibold">合计</th>
            </tr>
          </thead>
          <tbody>
            {DATA.brands.map((b) => (
              <tr key={b.name} className="border-b border-slate-100 transition-colors">
                <td className="py-2 pl-3 pr-2 font-medium text-slate-800">
                  {b.name}
                </td>
                {b.weekly.map((n, i) => {
                  const style = getHeatmapStyle(n);
                  const weekLabel = DATA.weeks[i].label;
                  const pct = ((n / TOTAL) * 100).toFixed(1);

                  return (
                    <td key={i} className="p-0.5 text-center">
                      <div className="group/cell relative flex h-10 w-full items-center justify-center rounded transition-all hover:z-20 hover:ring-2 hover:ring-blue-600 hover:ring-inset">
                        <span
                          className="flex h-full w-full items-center justify-center rounded font-mono font-medium tabular-nums"
                          style={{
                            backgroundColor: style.background,
                            color: style.color,
                          }}
                        >
                          {n}
                        </span>

                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover/cell:flex">
                          <div className="whitespace-nowrap rounded-lg bg-[#1e293b] px-3 py-2 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                            <div className="font-semibold text-white">
                              {b.name} · {weekLabel}
                            </div>
                            <div className="mt-0.5 font-medium text-slate-200">
                              {n} 封邮件
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              占总数 {pct}% ({n}/{TOTAL})
                            </div>
                          </div>
                          <div className="-mt-1 h-2 w-2 rotate-45 bg-[#1e293b]" />
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center font-mono font-semibold text-slate-800 tabular-nums">
                  {b.total}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold text-slate-800">
              <td className="py-2.5 pl-3 pr-2 text-left font-bold">合计</td>
              {weekTotals.map((n, i) => (
                <td key={i} className="px-2 py-2.5 text-center font-mono tabular-nums">
                  {n}
                </td>
              ))}
              <td className="px-2 py-2.5 text-center font-mono font-bold tabular-nums">
                {TOTAL}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="group mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs sm:text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 font-semibold text-slate-700 transition-colors hover:text-blue-600 [&::-webkit-details-marker]:hidden">
          <span>各品牌每周主要 Campaign 主题</span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-normal text-slate-500 transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="space-y-4 border-t border-slate-200/80 px-4 py-3.5">
          {DATA.brands.map((b) => (
            <div key={b.name} className="grid gap-1 sm:grid-cols-[6rem_1fr]">
              <span className="font-semibold text-slate-900">{b.name}</span>
              <div className="space-y-1">
                {b.campaigns.map((c, i) => (
                  <div key={i} className="leading-5 text-slate-600">
                    <span className="font-medium text-slate-800">
                      {DATA.weeks[i].label}：
                    </span>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
