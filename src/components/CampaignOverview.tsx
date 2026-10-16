import type { Brand } from "../data";
import { DATA } from "../data";
import { Card } from "./Card";
import { TOTAL } from "./dashboard";

const maxWeekly = Math.max(...DATA.brands.flatMap((b) => b.weekly));
const minWeekly = Math.min(...DATA.brands.flatMap((b) => b.weekly));

function getHeatmapStyle(count: number) {
  // Sequential blue scale (hue 218)
  const ratio = (count - minWeekly) / (maxWeekly - minWeekly);
  const lightness = 93 - ratio * 46; // from 93% down to 47%
  const isDark = lightness <= 64;

  return {
    background: `hsl(218 86% ${lightness.toFixed(1)}%)`,
    color: isDark ? "#ffffff" : "#1e293b",
  };
}

interface CampaignOverviewProps {
  onSelectBrand: (brand: Brand) => void;
}

export function CampaignOverview({ onSelectBrand }: CampaignOverviewProps) {
  const weekTotals = DATA.weeks.map((_, i) =>
    DATA.brands.reduce((s, b) => s + b.weekly[i], 0),
  );

  return (
    <Card
      title="品牌 × 周 × Campaign 主题"
      hint="单元格数字为该品牌当周邮件封数，颜色越深封数越多。"
    >
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
                  <button
                    type="button"
                    className="rounded-sm text-left font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-600 hover:decoration-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    onClick={() => onSelectBrand(b)}
                  >
                    {b.name}
                  </button>
                </td>
                {b.weekly.map((n, i) => {
                  const style = getHeatmapStyle(n);
                  const weekLabel = DATA.weeks[i].label;
                  const pct = ((n / TOTAL) * 100).toFixed(1);

                  return (
                    <td key={i} className="p-0.5 text-center">
                      <div
                        className="group/cell relative flex h-10 w-full items-center justify-center rounded transition-all hover:z-20 hover:ring-2 hover:ring-blue-600 hover:ring-inset"
                        tabIndex={0}
                      >
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
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover/cell:flex group-focus-within/cell:flex">
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

    </Card>
  );
}
