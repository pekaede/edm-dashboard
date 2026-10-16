import { useState } from "react";
import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, TOTAL } from "./dashboard";

// SVG arc generator helper
function describeArc(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number,
) {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const a0 = toRad(startDeg);
  const a1 = toRad(endDeg);

  const x0_out = cx + rOut * Math.cos(a0);
  const y0_out = cy + rOut * Math.sin(a0);
  const x1_out = cx + rOut * Math.cos(a1);
  const y1_out = cy + rOut * Math.sin(a1);

  const x0_in = cx + rIn * Math.cos(a1);
  const y0_in = cy + rIn * Math.sin(a1);
  const x1_in = cx + rIn * Math.cos(a0);
  const y1_in = cy + rIn * Math.sin(a0);

  const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${x0_out.toFixed(2)} ${y0_out.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${x1_out.toFixed(2)} ${y1_out.toFixed(2)}`,
    `L ${x0_in.toFixed(2)} ${y0_in.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${x1_in.toFixed(2)} ${y1_in.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/**
 * Text contrast helper adhering to WCAG AA (>= 4.5:1).
 * Light theme colors (yellow behavior, light blue category) use dark text (#0f172a).
 * Dark theme colors (price, new, lifestyle) use white text (#ffffff).
 */
function getSliceTextColor(themeKey: string): string {
  if (themeKey === "behavior" || themeKey === "category") {
    return "#0f172a";
  }
  return "#ffffff";
}

export function ThemeDistribution() {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Exact angles matching the prototype visual layout
  // Start price at ~15° so category (last segment) centers around 0° (top)
  let currentDeg = 15;
  const sliceData = DATA.themes.map((t) => {
    const span = (t.count / TOTAL) * 360;
    const startDeg = currentDeg;
    const endDeg = currentDeg + span;
    currentDeg = endDeg;

    const midDeg = (startDeg + endDeg) / 2;
    const midRad = ((midDeg - 90) * Math.PI) / 180;
    const rMid = 84;
    const tx = 120 + rMid * Math.cos(midRad);
    const ty = 120 + rMid * Math.sin(midRad);
    const pct = Math.round((t.count / TOTAL) * 100);

    return {
      theme: t,
      startDeg,
      endDeg,
      tx,
      ty,
      pct,
    };
  });

  const activeSlice = sliceData.find((s) => s.theme.key === hoveredKey);

  return (
    <Card
      title="内容结构分布"
      hint={`全期 ${TOTAL} 封邮件，每封严格归入唯一主题。`}
    >
      <div className="flex flex-col items-center">
        {/* Donut Chart SVG */}
        <div className="relative my-1">
          <svg
            viewBox="0 0 240 240"
            className="h-56 w-56 drop-shadow-sm sm:h-60 sm:w-60"
            role="img"
            aria-label="内容结构分布环形图"
          >
            {sliceData.map(({ theme, startDeg, endDeg, tx, ty, pct }) => {
              const isHovered = hoveredKey === theme.key;
              const rIn = isHovered ? 58 : 62;
              const rOut = isHovered ? 110 : 104;
              const d = describeArc(120, 120, rIn, rOut, startDeg, endDeg);
              const textColor = getSliceTextColor(theme.key);

              return (
                <g
                  key={theme.key}
                  tabIndex={0}
                  role="button"
                  aria-label={`${theme.labelZh}: ${theme.count} 封 (${pct}%)`}
                  className="cursor-pointer transition-all duration-200 focus-visible:outline-none"
                  onMouseEnter={() => setHoveredKey(theme.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(theme.key)}
                  onBlur={() => setHoveredKey(null)}
                >
                  <path
                    d={d}
                    fill={THEME_COLORS[theme.key]}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? "3" : "2"}
                    className="transition-all duration-200"
                    style={{
                      filter: isHovered
                        ? "drop-shadow(0 4px 8px rgb(0 0 0 / 0.15))"
                        : "none",
                    }}
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={textColor}
                    fontSize="12"
                    fontWeight="700"
                    className="pointer-events-none select-none font-sans"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Dynamic Center Label */}
            {activeSlice ? (
              <>
                <text
                  x="120"
                  y="110"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-3xl font-bold tracking-tight select-none transition-all duration-200"
                  style={{ fill: THEME_COLORS[activeSlice.theme.key] }}
                >
                  {activeSlice.theme.count}
                </text>
                <text
                  x="120"
                  y="136"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-slate-700 text-xs font-semibold select-none transition-all duration-200"
                >
                  {activeSlice.theme.labelZh} ({activeSlice.pct}%)
                </text>
              </>
            ) : (
              <>
                <text
                  x="120"
                  y="110"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-slate-900 font-mono text-3xl font-bold tracking-tight select-none"
                >
                  {TOTAL}
                </text>
                <text
                  x="120"
                  y="136"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-slate-600 text-xs font-medium select-none"
                >
                  全部邮件
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Legend with interactive alignment and keyboard accessibility */}
        <div
          className="mt-3 grid w-full grid-cols-2 gap-2 text-xs sm:text-[13px]"
          role="group"
          aria-label="主题图例"
        >
          {sliceData.map(({ theme, pct }) => {
            const isHovered = hoveredKey === theme.key;
            return (
              <button
                type="button"
                key={theme.key}
                onMouseEnter={() => setHoveredKey(theme.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(theme.key)}
                onBlur={() => setHoveredKey(null)}
                className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isHovered
                    ? "border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
                }`}
                aria-pressed={isHovered}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: THEME_COLORS[theme.key] }}
                  />
                  <span
                    className={`truncate ${
                      isHovered
                        ? "font-semibold text-slate-900"
                        : "text-slate-700 font-medium"
                    }`}
                  >
                    {theme.labelZh}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-slate-900">
                  <span className="font-semibold">{theme.count}</span>
                  <span className="ml-1 text-slate-600 text-[11px]">({pct}%)</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
