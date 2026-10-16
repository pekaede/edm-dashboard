import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, THEME_TINTS, TOTAL } from "./dashboard";

interface CloudWord {
  text: string;
  count: number;
  theme: "price" | "behavior" | "new" | "lifestyle" | "category";
  tier: 1 | 2 | 3 | 4;
}

// 10 high-frequency words matching the prototype specification
const WORDS: CloudWord[] = [
  { text: "New", count: 31, theme: "new", tier: 1 },
  { text: "Off", count: 21, theme: "price", tier: 2 },
  { text: "Up to", count: 19, theme: "price", tier: 2 },
  { text: "Down", count: 13, theme: "price", tier: 3 },
  { text: "Credit", count: 12, theme: "behavior", tier: 3 },
  { text: "Deal", count: 12, theme: "price", tier: 3 },
  { text: "Buy", count: 11, theme: "category", tier: 4 },
  { text: "Fall", count: 11, theme: "lifestyle", tier: 4 },
  { text: "Style", count: 11, theme: "lifestyle", tier: 4 },
  { text: "Sale", count: 10, theme: "price", tier: 4 },
];

/**
 * Text contrast helper adhering to WCAG AA (>= 4.5:1).
 */
function getBadgeTextColor(themeKey: string): string {
  if (themeKey === "behavior" || themeKey === "category") {
    return "#0f172a";
  }
  return "#ffffff";
}

export function WordCloud() {
  return (
    <Card
      title="主题行高频词云"
      hint="统计口径：含该词的邮件数（同一主题词重复出现计 1 次）；字号与字重反映高频层级。"
    >
      <div className="flex flex-col justify-between">
        {/* Word cloud cluster with zero overlap and responsive wrapping */}
        <div className="flex min-h-[220px] flex-wrap items-center justify-center gap-2.5 px-1 py-4 sm:gap-3.5 sm:px-3">
          {WORDS.map((w, index) => {
            const themeColor = THEME_COLORS[w.theme];
            const tintBg = THEME_TINTS[w.theme];
            const badgeTextColor = getBadgeTextColor(w.theme);
            const pct = ((w.count / TOTAL) * 100).toFixed(1);
            const themeObj = DATA.themes.find((t) => t.key === w.theme);
            const themeLabel = themeObj ? themeObj.labelZh : w.theme;

            // Clear visual hierarchy tiers
            const sizeClasses =
              w.tier === 1
                ? "text-2xl sm:text-3xl font-extrabold px-4 py-2 sm:px-5 sm:py-2.5 shadow-sm"
                : w.tier === 2
                  ? "text-lg sm:text-xl font-bold px-3.5 py-1.5 sm:px-4 sm:py-2"
                  : w.tier === 3
                    ? "text-sm sm:text-base font-bold px-3 py-1.5"
                    : "text-xs sm:text-sm font-semibold px-2.5 py-1 sm:px-3 sm:py-1";

            // Safe horizontal positioning for edge items
            const isLeftEdge = index === 1 || index === 3;
            const isRightEdge = index === 2 || index === 4;
            const tooltipHoriz = isLeftEdge
              ? "left-0 translate-x-0"
              : isRightEdge
                ? "right-0 translate-x-0"
                : "left-1/2 -translate-x-1/2";
            const arrowHoriz = isLeftEdge
              ? "left-4"
              : isRightEdge
                ? "right-4"
                : "left-1/2 -translate-x-1/2";

            return (
              <div
                key={w.text}
                tabIndex={0}
                role="button"
                aria-label={`${w.text}: 出现 ${w.count} 次，占 ${pct}%，归类为 ${themeLabel}`}
                className={`group/word relative inline-flex cursor-pointer items-center gap-2 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:z-20 ${sizeClasses}`}
                style={{
                  backgroundColor: tintBg,
                  borderColor: themeColor,
                }}
              >
                {/* Word Text: slate-900 on tint background provides > 11:1 contrast (WCAG AAA) */}
                <span className="font-sans tracking-tight text-slate-900 select-none">
                  {w.text}
                </span>

                {/* Frequency Badge: Tabular numerals with accessible contrast */}
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums shadow-xs select-none"
                  style={{
                    backgroundColor: themeColor,
                    color: badgeTextColor,
                  }}
                >
                  {w.count}
                </span>

                {/* Accessible Tooltip */}
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden flex-col ${tooltipHoriz} group-hover/word:flex group-focus-within/word:flex`}
                >
                  <div className="whitespace-nowrap rounded-lg bg-[#0f172a] px-3 py-2 text-center text-xs text-white shadow-xl ring-1 ring-white/10">
                    <div className="flex items-center justify-center gap-1.5 font-semibold text-white">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: themeColor }}
                      />
                      <span>
                        "{w.text}" · {themeLabel}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-blue-200">
                      出现 {w.count} 封邮件
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      占总数 {pct}% ({w.count}/{TOTAL})
                    </div>
                  </div>
                  <div
                    className={`absolute -bottom-1 h-2 w-2 rotate-45 border-b border-r border-slate-800 bg-[#0f172a] ${arrowHoriz}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Legend for Theme Colors */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          {DATA.themes.map((t) => (
            <div key={t.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: THEME_COLORS[t.key] }}
              />
              <span className="text-slate-600">{t.labelZh}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
