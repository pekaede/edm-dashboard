import { useState } from "react";
import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, TOTAL } from "./dashboard";

// SVG arc helper
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
    const rMid = 78;
    const tx = 110 + rMid * Math.cos(midRad);
    const ty = 110 + rMid * Math.sin(midRad);
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

  return (
    <Card title="内容结构分布" hint={`${TOTAL} 封邮件，每封只归一类。`}>
      <div className="flex flex-col items-center">
        {/* Donut Chart */}
        <div className="relative my-2">
          <svg
            viewBox="0 0 220 220"
            className="h-56 w-56 drop-shadow-sm sm:h-60 sm:w-60"
            role="img"
            aria-label="内容结构分布环形图"
          >
            {sliceData.map(({ theme, startDeg, endDeg, tx, ty, pct }) => {
              const isHovered = hoveredKey === theme.key;
              const rIn = isHovered ? 53 : 56;
              const rOut = isHovered ? 103 : 100;
              const d = describeArc(110, 110, rIn, rOut, startDeg, endDeg);

              return (
                <g
                  key={theme.key}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredKey(theme.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <path
                    d={d}
                    fill={THEME_COLORS[theme.key]}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="transition-all duration-200"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="600"
                    className="pointer-events-none select-none font-sans"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Center Label */}
            <text
              x="110"
              y="102"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-900 font-mono text-3xl font-bold tracking-tight select-none"
            >
              {TOTAL}
            </text>
            <text
              x="110"
              y="126"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-500 text-xs font-medium select-none"
            >
              封邮件
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 grid w-full grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-[13px]">
          {sliceData.map(({ theme, pct }) => {
            const isHovered = hoveredKey === theme.key;
            return (
              <div
                key={theme.key}
                onMouseEnter={() => setHoveredKey(theme.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                  isHovered ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: THEME_COLORS[theme.key] }}
                />
                <span className="truncate text-slate-700">
                  {theme.labelZh}{" "}
                  <span className="font-mono text-slate-500 tabular-nums">
                    {theme.count} ({pct}%)
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
