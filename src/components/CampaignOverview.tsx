import { useMemo } from "react";
import type { Brand } from "../data";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
  formatWindowRange,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

// 周定义（标签 / 日期范围）由窗口起止推导；数字（每周计数、合计）来自 emails 表实时聚合。
// 品牌明细弹窗的周标签用聚合 weeks（经 buildAggregatedBrand 传入），不再用静态 DATA.weeks。
function getHeatmapStyle(count: number, maxWeekly: number, minWeekly: number) {
  if (count >= 15) {
    const ratio = (count - 15) / Math.max(1, maxWeekly - 15);
    const lightness = 44 - ratio * 12;
    return {
      background: `hsl(var(--heatmap-high-hue) var(--heatmap-high-saturation) ${lightness.toFixed(1)}%)`,
      color: "var(--text-inverse)",
    };
  }

  const ratio = (count - minWeekly) / Math.max(1, 14 - minWeekly);
  const lightness = 96 - ratio * 26;
  return {
    background: `hsl(${(32 - ratio * 18).toFixed(1)} var(--heatmap-low-saturation) ${lightness.toFixed(1)}%)`,
    color: "var(--text-primary)",
  };
}

interface CampaignOverviewProps {
  onSelectBrand: (brand: Brand) => void;
}

export function CampaignOverview({ onSelectBrand }: CampaignOverviewProps) {
  const { status, emails, total, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `${meta.market} · 实时聚合（窗口 ${formatWindowRange(data.window)}，共 ${data.total} 封），与 3 个月 ${meta.total} 封为不同口径。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。`
    : `${meta.market} · 实时聚合（窗口 ${formatWindowRange(THREE_WEEK_WINDOW)}）。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。`;

  if (status !== "ready" || !data) {
    return (
      <Card title="品牌 × 周 × 发送频次" hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card title="品牌 × 周 × 发送频次" hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title="三周窗口暂无发送记录"
            description="该站点在三周窗口内暂无邮件（0 封），不生成品牌周发送频次。可切换市场或重新拉取数据。"
            actionLabel={market === null ? "重新拉取" : "切换至全部市场"}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
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
                  <div className="text-xs font-normal text-slate-600">{w.range}</div>
                </th>
              ))}
              <th className="border-l border-slate-200/80 px-2 py-2 text-center font-semibold text-slate-800">
                合计
              </th>
            </tr>
          </thead>
          <tbody>
            {data.brands.map((b) => (
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

                  return (
                    <td key={colIndex} className="p-1 text-center">
                      <Tooltip
                        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md transition-all hover:ring-2 hover:ring-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                        label={`${b.name} ${week.label}: ${n} 封邮件，占总数 ${pct}%`}
                        content={<>
                          <div className="font-semibold">{b.name} · {week.label}（{week.range}）</div>
                          <div className="mt-1 font-mono text-[var(--calendar-heat-1)]">{n} 封邮件</div>
                          <div className="mt-0.5 text-slate-200">占全期总量 {pct}%（{n}/{grandTotal}）</div>
                        </>}
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

                      </Tooltip>
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
