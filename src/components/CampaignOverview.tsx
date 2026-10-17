import { useMemo } from "react";
import type { Brand } from "../data";
import { useExtendedEmails } from "../email-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
  formatWindowRange,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

// 周定义（标签 / 日期范围）由窗口起止推导；数字（每周计数、合计）来自 emails 表实时聚合。
// 品牌明细弹窗的周标签用聚合 weeks（经 buildAggregatedBrand 传入），不再用静态 DATA.weeks。
function getHeatmapStyle(count: number, maxWeekly: number, minWeekly: number) {
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
  const { status, emails, total, error, retry, meta } = useExtendedEmails();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `实时聚合（窗口 ${formatWindowRange(data.window)}，共 ${data.total} 封），与 3 个月 ${meta.total} 封为不同口径。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。`
    : `实时聚合（窗口 ${formatWindowRange(THREE_WEEK_WINDOW)}），与 3 个月 ${meta.total} 封为不同口径。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。`;

  if (status !== "ready" || !data) {
    return (
      <Card title="品牌 × 周 × 发送频次" hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} />
      </Card>
    );
  }

  const maxWeekly = Math.max(...data.brands.flatMap((b) => b.weekly));
  const minWeekly = Math.min(...data.brands.flatMap((b) => b.weekly));
  const grandTotal = data.grandTotal;

  return (
    <Card
      title="品牌 × 周 × 发送频次"
      hint={hint}
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
              {data.weeks.map((w) => (
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
            {data.brands.map((b, rowIndex) => (
              <tr
                key={b.name}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
              >
                <td className="py-2 pl-3 pr-2 font-medium">
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-md px-1.5 py-0.5 text-left font-semibold text-slate-800 transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                    onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name))}
                  >
                    {b.name}
                  </button>
                </td>

                {b.weekly.map((n, colIndex) => {
                  const style = getHeatmapStyle(n, maxWeekly, minWeekly);
                  const week = data.weeks[colIndex];
                  // 空窗口（grandTotal = 0）时 0/0 为 NaN，守分母显 0.0%。
                  const pct = grandTotal > 0 ? ((n / grandTotal) * 100).toFixed(1) : "0.0";

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
                      : colIndex === data.weeks.length - 1
                        ? "right-0 translate-x-0"
                        : "left-1/2 -translate-x-1/2";

                  const arrowHoriz =
                    colIndex === 0
                      ? "left-5"
                      : colIndex === data.weeks.length - 1
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
                              占全期总量 {pct}% ({n}/{grandTotal})
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
              {data.weekTotals.map((n, i) => (
                <td
                  key={i}
                  className="px-2 py-2.5 text-center font-mono font-bold tabular-nums"
                >
                  {n}
                </td>
              ))}
              <td className="border-l border-slate-200/80 px-2 py-2.5 text-center font-mono font-bold text-[var(--accent-ink)] tabular-nums">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Heatmap Legend */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: getHeatmapStyle(minWeekly, maxWeekly, minWeekly).background }} />
          <span>低 ({minWeekly} 封)</span>
        </span>
        <div
          className="mx-2 h-2 max-w-[140px] flex-1 rounded-full"
          style={{ background: `linear-gradient(to right, ${getHeatmapStyle(minWeekly, maxWeekly, minWeekly).background}, ${getHeatmapStyle(14, maxWeekly, minWeekly).background}, ${getHeatmapStyle(maxWeekly, maxWeekly, minWeekly).background})` }}
        />
        <span className="flex items-center gap-1.5">
          <span>高 ({maxWeekly} 封)</span>
          <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: getHeatmapStyle(maxWeekly, maxWeekly, minWeekly).background }} />
        </span>
      </div>
    </Card>
  );
}
