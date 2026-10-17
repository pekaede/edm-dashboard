import { useMemo, useState } from "react";
import type { Brand } from "../data";
import { useExtendedEmails } from "../email-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

interface BrandThemeBreakdownProps {
  onSelectBrand: (brand: Brand) => void;
}

export function BrandThemeBreakdown({ onSelectBrand }: BrandThemeBreakdownProps) {
  const [highlightedTheme, setHighlightedTheme] = useState<string | null>(null);
  const { status, emails, total, error, retry, meta } = useExtendedEmails();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `各品牌 3 周实时聚合（窗口 ${formatWindowRange(data.window)}，共 ${data.total} 封）邮件主题占比与封数分布，与 3 个月 ${meta.total} 封为不同口径。`
    : `各品牌 3 周实时聚合（窗口 ${formatWindowRange(THREE_WEEK_WINDOW)}）邮件主题占比与封数分布，与 3 个月 ${meta.total} 封为不同口径。`;

  if (status !== "ready" || !data) {
    return (
      <Card title="各品牌内容结构" hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} />
      </Card>
    );
  }

  return (
    <Card
      title="各品牌内容结构"
      hint={hint}
    >
      {/* Top Legend with interactive focus & hover states */}
      <div
        className="-mt-1 mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600"
        role="group"
        aria-label="主题筛选图例"
      >
        {data.themes
          .filter((t) => t.count > 0)
          .map((t) => {
          const isHighlighted = highlightedTheme === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onMouseEnter={() => setHighlightedTheme(t.key)}
              onMouseLeave={() => setHighlightedTheme(null)}
              onFocus={() => setHighlightedTheme(t.key)}
              onBlur={() => setHighlightedTheme(null)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 py-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] ${
                isHighlighted
                  ? "bg-slate-200/90 font-semibold text-slate-900 ring-1 ring-slate-300"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: themeColor(t.key) }}
              />
              <span>{t.labelZh}</span>
            </button>
          );
        })}
      </div>

      {/* Brand rows */}
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

          // Track cumulative percentage to safely align tooltips within card bounds
          let cumPct = 0;

          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 sm:flex sm:gap-3">
              {/* Brand button with keyboard navigation */}
              <button
                type="button"
                className="min-h-8 w-fit shrink-0 rounded-md px-1 py-0.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] sm:w-22 sm:text-sm"
                onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name))}
              >
                {b.name}
              </button>

              {/* Segmented Bar */}
              <div className="relative order-3 col-span-2 flex h-8 min-w-0 flex-1 rounded-lg bg-slate-100 sm:order-none">
                {segs.map((t, index) => {
                  const startPct = cumPct;
                  cumPct += t.widthPct;
                  const midPct = startPct + t.widthPct / 2;

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

                  // Safe tooltip placement avoiding edge clipping:
                  // <22% -> left-anchored, >78% -> right-anchored, center otherwise
                  const tooltipHorizClass =
                    midPct < 22
                      ? "left-0 translate-x-0"
                      : midPct > 78
                        ? "right-0 translate-x-0"
                        : "left-1/2 -translate-x-1/2";

                  const arrowHorizClass =
                    midPct < 22
                      ? "left-4"
                      : midPct > 78
                        ? "right-4"
                        : "left-1/2 -translate-x-1/2";

                  const isThemeDimmed =
                    highlightedTheme !== null && highlightedTheme !== t.key;
                  const textColor = isThemeDimmed ? "#171411" : themeLabelColor(t.key);

                  return (
                    <div
                      key={t.key}
                      className={`group/seg relative h-full focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] ${roundingClass}`}
                      style={{ width: `${t.widthPct}%` }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${b.name} · ${t.labelZh}: ${t.themeCount} 封 (${t.pct}%)`}
                    >
                      <div
                        className={`flex h-full w-full items-center justify-center border-r border-white/60 transition-shadow hover:ring-1 hover:ring-inset hover:ring-slate-950/30 ${roundingClass} ${
                          isLast ? "border-r-0" : ""
                        }`}
                        style={{
                          backgroundColor: isThemeDimmed
                            ? `color-mix(in srgb, ${themeColor(t.key)} 30%, var(--surface-card))`
                            : themeColor(t.key),
                        }}
                      >
                        {/* Only show percentage when wide enough to prevent overlap/clipping */}
                        {t.widthPct >= 14 ? (
                          <span
                            className="select-none px-1 font-mono text-[11px] font-bold sm:text-xs"
                            style={{ color: textColor }}
                          >
                            {t.pct}%
                          </span>
                        ) : null}
                      </div>

                      {/* Tooltip with focus-within & hover support */}
                      <div
                        role="tooltip"
                        className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden flex-col ${tooltipHorizClass} group-hover/seg:flex group-focus-within/seg:flex`}
                      >
                        <div className="whitespace-nowrap rounded-lg bg-slate-950 px-3 py-1.5 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: themeColor(t.key) }}
                            />
                            <span>
                              {b.name} · {t.labelZh}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-300">
                            {t.themeCount} 封 · 占比 {t.pct}%
                          </div>
                        </div>
                        <div
                          className={`absolute -bottom-1 h-2 w-2 rotate-45 border-b border-r border-slate-800 bg-slate-950 ${arrowHorizClass}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total volume label */}
              <div className="w-11 shrink-0 text-right font-mono text-xs font-semibold text-slate-600 tabular-nums sm:w-12">
                {b.total} 封
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
