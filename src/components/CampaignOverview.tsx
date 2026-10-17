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

const HEATMAP_LEVELS = [
  { label: "0", background: "var(--calendar-heat-empty)", color: "var(--theme-label-dark)" },
  { label: "1–4", background: "var(--calendar-heat-1)", color: "var(--theme-label-dark)" },
  { label: "5–9", background: "var(--calendar-heat-2)", color: "var(--theme-label-dark)" },
  { label: "10–14", background: "var(--calendar-heat-3)", color: "var(--theme-label-dark)" },
  { label: "15–19", background: "var(--calendar-heat-4)", color: "var(--text-inverse)" },
  { label: "20+", background: "var(--calendar-heat-5)", color: "var(--text-inverse)" },
];

function getHeatmapStyle(count: number) {
  const level = HEATMAP_LEVELS[Math.min(5, count === 0 ? 0 : Math.floor(count / 5) + 1)];
  return {
    background: level.background,
    color: level.color,
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

  const grandTotal = data.grandTotal;

  return (
    <Card
      title="品牌 × 周 × 发送频次"
      hint={hint}
    >
      <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">
        色阶固定，跨品牌使用同一尺度；描边表示当前查看，不代表效果优劣。聚焦单元格可查看明细，Esc 关闭提示。
      </p>
      <div
        className="overflow-x-auto rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
        role="region"
        aria-label="品牌每周发送频次，可横向滚动"
        tabIndex={0}
      >
        <table className="w-full min-w-[23rem] border-collapse text-xs sm:text-sm">
          <caption className="sr-only">{meta.market}，{formatWindowRange(data.window)}，品牌每周可见收录邮件数，单位：封</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700">
              <th scope="col" className="py-2.5 pl-3 pr-2 text-left font-semibold">品牌</th>
              {data.weeks.map((w) => (
                <th key={w.id} scope="col" className="px-2 py-2 text-center font-semibold">
                  <div>{w.label}</div>
                  <div className="text-xs font-normal text-slate-600">{w.range}</div>
                </th>
              ))}
              <th scope="col" className="border-l border-slate-200 px-2 py-2 text-center font-semibold text-slate-800">
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
                <th scope="row" className="py-2 pl-3 pr-2 font-medium">
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-md px-1.5 py-0.5 text-left font-semibold text-slate-800 transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                    onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name))}
                  >
                    {b.name}
                  </button>
                </th>

                {b.weekly.map((n, colIndex) => {
                  const style = getHeatmapStyle(n);
                  const week = data.weeks[colIndex];
                  // 空窗口（grandTotal = 0）时 0/0 为 NaN，守分母显 0.0%。
                  const pct = grandTotal > 0 ? ((n / grandTotal) * 100).toFixed(1) : "0.0";

                  return (
                    <td key={colIndex} className="p-1 text-center">
                      <Tooltip
                        className="flex h-11 w-full items-center justify-center rounded-md transition-shadow hover:ring-2 hover:ring-[var(--control-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
                        label={`${b.name}，${week.label}，${week.range}：${n} 封邮件，占三周样本 ${pct}%`}
                        content={<>
                          <div className="font-semibold">{b.name} · {week.label}（{week.range}）</div>
                          <div className="mt-1 font-mono font-bold">{n} 封 · 三周样本占比 {pct}%</div>
                          <div className="mt-1">{meta.market} · 分母 {grandTotal} 封 · 可见收录</div>
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
              <th scope="row" className="py-2.5 pl-3 pr-2 text-left font-bold">合计</th>
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

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-secondary)]" aria-label="固定邮件量色阶，单位：封">
        <span>邮件量（封）</span>
        {HEATMAP_LEVELS.map((level) => (
          <span key={level.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-4 rounded-sm" style={{ background: level.background }} />
            {level.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">各周桶覆盖天数可能不同；0 表示未收录，不代表实际未发送。</p>
    </Card>
  );
}
