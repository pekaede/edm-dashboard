import { useState } from "react";
import type { Brand } from "../data";
import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS } from "./dashboard";

interface BrandThemeBreakdownProps {
  onSelectBrand: (brand: Brand) => void;
}

/**
 * Text contrast helper adhering to WCAG AA (>= 4.5:1).
 */
function getSegmentTextColor(themeKey: string): string {
  if (themeKey === "behavior" || themeKey === "category") {
    return "#0f172a";
  }
  return "#ffffff";
}

export function BrandThemeBreakdown({ onSelectBrand }: BrandThemeBreakdownProps) {
  const [highlightedTheme, setHighlightedTheme] = useState<string | null>(null);

  return (
    <Card
      title="各品牌内容结构"
      hint={`各品牌近 ${DATA.meta.weekCount} 周邮件主题占比与封数分布。`}
    >
      {/* Top Legend with interactive focus & hover states */}
      <div
        className="-mt-1 mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600"
        role="group"
        aria-label="主题筛选图例"
      >
        {DATA.themes.map((t) => {
          const isHighlighted = highlightedTheme === t.key;
          return (
            <button
              type="button"
              key={t.key}
              onMouseEnter={() => setHighlightedTheme(t.key)}
              onMouseLeave={() => setHighlightedTheme(null)}
              onFocus={() => setHighlightedTheme(t.key)}
              onBlur={() => setHighlightedTheme(null)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isHighlighted
                  ? "bg-slate-200/90 font-semibold text-slate-900 ring-1 ring-slate-300"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: THEME_COLORS[t.key] }}
              />
              <span>{t.labelZh}</span>
            </button>
          );
        })}
      </div>

      {/* Brand rows */}
      <div className="space-y-3.5">
        {DATA.brands.map((b) => {
          // Sort brand's themes by count descending to match visual layout
          const segs = DATA.themes
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
            <div key={b.name} className="flex items-center gap-2.5 sm:gap-3">
              {/* Brand button with keyboard navigation */}
              <button
                type="button"
                className="w-20 shrink-0 truncate rounded-md px-1 py-0.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:w-22 sm:text-sm"
                onClick={() => onSelectBrand(b)}
              >
                {b.name}
              </button>

              {/* Segmented Bar */}
              <div className="relative flex h-7 flex-1 rounded-lg bg-slate-100 sm:h-8">
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
                  const textColor = getSegmentTextColor(t.key);

                  return (
                    <div
                      key={t.key}
                      className={`group/seg relative h-full transition-opacity duration-200 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        roundingClass
                      } ${isThemeDimmed ? "opacity-30" : "opacity-100"}`}
                      style={{ width: `${t.widthPct}%` }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${b.name} · ${t.labelZh}: ${t.themeCount} 封 (${t.pct}%)`}
                    >
                      <div
                        className={`flex h-full w-full items-center justify-center border-r border-white/60 transition-all hover:brightness-105 ${roundingClass} ${
                          isLast ? "border-r-0" : ""
                        }`}
                        style={{
                          backgroundColor: THEME_COLORS[t.key],
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
                        <div className="whitespace-nowrap rounded-lg bg-[#0f172a] px-3 py-1.5 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: THEME_COLORS[t.key] }}
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
                          className={`absolute -bottom-1 h-2 w-2 rotate-45 border-b border-r border-slate-800 bg-[#0f172a] ${arrowHorizClass}`}
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
