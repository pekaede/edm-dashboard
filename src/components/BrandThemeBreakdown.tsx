import { useMemo, useState } from "react";
import type { Brand } from "../data";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

interface BrandThemeBreakdownProps {
  onSelectBrand: (brand: Brand) => void;
}

export function BrandThemeBreakdown({ onSelectBrand }: BrandThemeBreakdownProps) {
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [pinnedTheme, setPinnedTheme] = useState<string | null>(null);
  const highlightedTheme = previewTheme ?? pinnedTheme;
  const { status, emails, total, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `${meta.market} · 各品牌 3 周实时聚合（窗口 ${formatWindowRange(data.window)}，共 ${data.total} 封）邮件主题占比与封数分布，与 3 个月 ${meta.total} 封为不同口径。`
    : `${meta.market} · 各品牌 3 周实时聚合（窗口 ${formatWindowRange(THREE_WEEK_WINDOW)}）邮件主题占比与封数分布。`;

  if (status !== "ready" || !data) {
    return (
      <Card title="各品牌内容结构" hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card title="各品牌内容结构" hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title="三周窗口暂无品牌主题记录"
            description="该站点在三周窗口内暂无邮件（0 封），不生成品牌主题占比与封数分布。可切换市场或重新拉取数据。"
            actionLabel={market === null ? "重新拉取" : "切换至全部市场"}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="各品牌内容结构"
      hint={hint}
    >
      <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">每条柱总长为该品牌的 100%，不代表邮件量。聚焦查看明细；点击图例锁定主题，再次点击或按 Esc 清除。</p>
      <div onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinnedTheme(null);
          setPreviewTheme(null);
        }
      }}>
      <div
        className="-mt-1 mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600"
        role="group"
        aria-label="主题高亮图例，不改变统计范围"
      >
        {data.themes
          .filter((t) => t.count > 0)
          .map((t) => {
          const isHighlighted = highlightedTheme === t.key;
          return (
            <button
              type="button"
              key={t.key}
              aria-pressed={pinnedTheme === t.key}
              onClick={() => {
                setPinnedTheme((previous) => previous === t.key ? null : t.key);
                setPreviewTheme(null);
              }}
              onMouseEnter={() => setPreviewTheme(t.key)}
              onMouseLeave={() => setPreviewTheme(null)}
              onFocus={() => setPreviewTheme(t.key)}
              onBlur={() => setPreviewTheme(null)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${
                isHighlighted
                  ? "border-[var(--control-focus)] bg-[var(--surface-subtle)] font-semibold text-[var(--text-heading)]"
                  : "border-[var(--border-default)] text-[var(--text-body)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: themeColor(t.key) }}
              />
              <span>{t.labelZh}</span>
              {pinnedTheme === t.key ? <span className="text-xs">已锁定</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex justify-between text-xs text-[var(--text-secondary)]" aria-hidden="true"><span>品牌 / 主题占比</span><span>100% · 总封数</span></div>
      <div className="space-y-3.5">
        {data.brands.map((b) => {
          // Sort brand's themes by count descending to match visual layout
          const segs = data.themes
            .filter((t) => (b.themes[t.key] || 0) > 0)
            .map((t) => ({
              ...t,
              themeCount: b.themes[t.key],
              pct: Math.round((b.themes[t.key] / b.total) * 100),
              widthPct: (b.themes[t.key] / b.total) * 100,
            }))
            .sort((a, b) => b.themeCount - a.themeCount);

          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 sm:flex sm:gap-3">
              {/* Brand button with keyboard navigation */}
              <button
                type="button"
                className="min-h-11 w-fit shrink-0 rounded-md px-1 py-0.5 text-left text-xs font-semibold text-[var(--text-body)] transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] sm:w-22 sm:text-sm"
                onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name))}
              >
                {b.name}
              </button>

              {/* Segmented Bar */}
              <div className="relative order-3 col-span-2 flex h-8 min-w-0 flex-1 rounded-lg bg-slate-100 sm:order-none">
                {segs.map((t, index) => {
                  const isSingle = segs.length === 1;
                  const isFirst = index === 0;
                  const isLast = index === segs.length - 1;

                  // Precise corner rounding on segments
                  const roundingClass = isSingle
                    ? "rounded-lg"
                    : isFirst
                      ? "rounded-l-lg"
                      : isLast
                        ? "rounded-r-lg"
                        : "rounded-none";

                  const isThemeDimmed =
                    highlightedTheme !== null && highlightedTheme !== t.key;
                  const textColor = isThemeDimmed ? "var(--theme-label-dark)" : themeLabelColor(t.key);

                  return (
                    <Tooltip
                      key={t.key}
                      className={`relative h-full hover:z-10 hover:ring-2 hover:ring-[var(--control-focus)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${roundingClass}`}
                      style={{ width: `${t.widthPct}%` }}
                      label={`${b.name} · ${t.labelZh}：${t.themeCount} 封，占该品牌 ${t.pct}%，分母 ${b.total} 封`}
                      content={<>
                        <div className="font-semibold">{b.name} · {t.labelZh}</div>
                        <div className="mt-1 font-mono font-bold">{t.themeCount} 封 · 品牌内占比 {t.pct}%</div>
                        <div className="mt-1">{meta.market} · {formatWindowRange(data.window)} · 分母 {b.total} 封</div>
                      </>}
                    >
                      <div
                        className={`flex h-full w-full items-center justify-center border-r border-[var(--surface-card)] transition-colors ${roundingClass} ${
                          isLast ? "border-r-0" : ""
                        }`}
                        style={{
                          backgroundColor: isThemeDimmed
                            ? `color-mix(in srgb, ${themeColor(t.key)} 25%, var(--surface-card))`
                            : themeColor(t.key),
                        }}
                      >
                        {/* Only show percentage when wide enough to prevent overlap/clipping */}
                        {t.widthPct >= 14 ? (
                          <span
                            className="select-none px-1 font-mono text-xs font-bold"
                            style={{ color: textColor }}
                          >
                            {t.pct}%
                          </span>
                        ) : null}
                      </div>

                    </Tooltip>
                  );
                })}
              </div>

              {/* Total volume label */}
              <div className="w-11 shrink-0 text-right font-mono text-xs font-semibold text-slate-600 tabular-nums sm:w-12">
                {b.total} 封
              </div>

              {b.total === 0 ? <p className="order-4 col-span-2 text-xs text-[var(--text-secondary)] sm:sr-only">该品牌三周窗口未收录邮件，不计算占比。</p> : null}
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
