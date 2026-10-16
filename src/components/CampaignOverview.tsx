import type { Brand } from "../data";
import { DATA } from "../data";
import { Card } from "./Card";
import { TOTAL } from "./dashboard";

const maxWeekly = Math.max(...DATA.brands.flatMap((b) => b.weekly));
const minWeekly = Math.min(...DATA.brands.flatMap((b) => b.weekly));

function getHeatmapStyle(count: number) {
  if (count >= 15) {
    const ratio = (count - 15) / Math.max(1, maxWeekly - 15);
    const lightness = 44 - ratio * 12;
    return {
      background: `hsl(14 65% ${lightness.toFixed(1)}%)`,
      color: "#ffffff",
    };
  }

  const ratio = (count - minWeekly) / Math.max(1, 14 - minWeekly);
  const lightness = 96 - ratio * 26;
  return {
    background: `hsl(${(32 - ratio * 18).toFixed(1)} 80% ${lightness.toFixed(1)}%)`,
    color: "#29231f",
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
      title="品牌 × 周 × 发送频次"
      hint="单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。"
    >
      {/* Responsive table wrapper with smooth horizontal scroll on mobile */}
      <div
        className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-thin"
        role="region"
        aria-label="品牌每周发送频次，可横向滚动"
        tabIndex={0}
      >
        <table className="w-full min-w-[23rem] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700">
              <th className="py-2.5 pl-3 pr-2 text-left font-semibold">品牌</th>
              {DATA.weeks.map((w) => (
                <th key={w.id} className="px-2 py-2 text-center font-semibold">
                  <div>{w.label}</div>
                  <div className="text-[11px] font-normal text-slate-600">{w.range}</div>
                </th>
              ))}
              <th className="border-l border-slate-200/80 px-2 py-2 text-center font-semibold text-slate-800">
                合计
              </th>
            </tr>
          </thead>
          <tbody>
            {DATA.brands.map((b, rowIndex) => (
              <tr
                key={b.name}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
              >
                <td className="py-2 pl-3 pr-2 font-medium">
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-md px-1.5 py-0.5 text-left font-semibold text-slate-800 transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                    onClick={() => onSelectBrand(b)}
                  >
                    {b.name}
                  </button>
                </td>

                {b.weekly.map((n, colIndex) => {
                  const style = getHeatmapStyle(n);
                  const week = DATA.weeks[colIndex];
                  const pct = ((n / TOTAL) * 100).toFixed(1);

                  // Position tooltip safely so it never clips outside card edges:
                  // Top rows pop downwards, other rows pop upwards
                  const isTopRow = rowIndex <= 1;
                  const verticalPos = isTopRow
                    ? "top-full mt-2"
                    : "bottom-full mb-2";
                  const arrowPos = isTopRow
                    ? "-top-1 border-t border-l border-slate-800 bg-slate-950"
                    : "-bottom-1 border-b border-r border-slate-800 bg-slate-950";

                  // Horizontal alignment: col 0 left-anchored, col 2 right-anchored, col 1 centered
                  const horizPos =
                    colIndex === 0
                      ? "left-0 translate-x-0"
                      : colIndex === DATA.weeks.length - 1
                        ? "right-0 translate-x-0"
                        : "left-1/2 -translate-x-1/2";

                  const arrowHoriz =
                    colIndex === 0
                      ? "left-5"
                      : colIndex === DATA.weeks.length - 1
                        ? "right-5"
                        : "left-1/2 -translate-x-1/2";

                  return (
                    <td key={colIndex} className="p-1 text-center">
                      <div
                        className="group/cell relative flex h-10 w-full cursor-pointer items-center justify-center rounded-md transition-all hover:z-20 hover:ring-2 hover:ring-[var(--accent-ink)] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                        tabIndex={0}
                        role="cell"
                        aria-label={`${b.name} ${week.label}: ${n} 封邮件，占总数 ${pct}%`}
                      >
                        <span
                          className="flex h-full w-full items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums sm:text-sm"
                          style={{
                            backgroundColor: style.background,
                            color: style.color,
                          }}
                        >
                          {n}
                        </span>

                        {/* Interactive Tooltip with focus-within & hover */}
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute z-30 hidden flex-col ${verticalPos} ${horizPos} group-hover/cell:flex group-focus-within/cell:flex`}
                        >
                          <div className="whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                            <div className="font-semibold text-white">
                              {b.name} · {week.label} ({week.range})
                            </div>
                            <div className="mt-1 font-mono font-medium text-[#f8ddb2]">
                              {n} 封邮件
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-300">
                              占全期总量 {pct}% ({n}/{TOTAL})
                            </div>
                          </div>
                          <div
                            className={`absolute h-2 w-2 rotate-45 ${arrowPos} ${arrowHoriz}`}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}

                <td className="border-l border-slate-200/80 px-2 py-2 text-center font-mono font-bold text-slate-900 tabular-nums">
                  <span className="inline-block rounded px-1.5 py-0.5 bg-slate-100/80">
                    {b.total}
                  </span>
                </td>
              </tr>
            ))}

            {/* Bottom Total Row */}
            <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-900">
              <td className="py-2.5 pl-3 pr-2 text-left font-bold">合计</td>
              {weekTotals.map((n, i) => (
                <td
                  key={i}
                  className="px-2 py-2.5 text-center font-mono font-bold tabular-nums"
                >
                  {n}
                </td>
              ))}
              <td className="border-l border-slate-200/80 px-2 py-2.5 text-center font-mono font-bold text-[var(--accent-ink)] tabular-nums">
                {TOTAL}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Heatmap Legend */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: getHeatmapStyle(minWeekly).background }} />
          <span>低 ({minWeekly} 封)</span>
        </span>
        <div
          className="mx-2 h-2 max-w-[140px] flex-1 rounded-full"
          style={{ background: `linear-gradient(to right, ${getHeatmapStyle(minWeekly).background}, ${getHeatmapStyle(14).background}, ${getHeatmapStyle(maxWeekly).background})` }}
        />
        <span className="flex items-center gap-1.5">
          <span>高 ({maxWeekly} 封)</span>
          <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: getHeatmapStyle(maxWeekly).background }} />
        </span>
      </div>
    </Card>
  );
}
