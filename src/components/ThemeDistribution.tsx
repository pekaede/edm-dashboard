import { useMemo, useState } from "react";
import { useSiteEmails } from "../site-data";
import {
  aggregateThreeWeek,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

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

export function ThemeDistribution() {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const { status, emails, total: emailTotal, error, retry, meta } = useSiteEmails();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `${meta.market} · 实时聚合（窗口 ${formatWindowRange(data.window)}，全期 ${data.total} 封），与 3 个月 ${meta.total} 封为不同口径。每封严格归入唯一主题。`
    : `${meta.market} · 实时聚合（窗口 ${formatWindowRange(THREE_WEEK_WINDOW)}）。每封严格归入唯一主题。`;

  if (status !== "ready" || !data) {
    return (
      <Card title="内容结构分布" hint={hint}>
        <ExtendedEmailsState status={status} total={emailTotal} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  const total = data.total;

  // 空窗口（total = 0）时 0/0 会产生 NaN 弧度与无效 SVG 坐标，不画环图，改显空态。
  if (total === 0) {
    return (
      <Card title="内容结构分布" hint={hint}>
        <p className="py-6 text-center text-sm text-slate-500">该窗口内暂无邮件。</p>
      </Card>
    );
  }

  // 零计数主题（m2）：过滤 count === 0 的切片，不渲染零弧度切片与 0% 标签；
  // 图例随切片一起过滤（零主题在窗口内无邮件，不再单独占一行）。
  let currentDeg = 15;
  const sliceData = data.themes
    .filter((t) => t.count > 0)
    .map((t) => {
    const span = (t.count / total) * 360;
    const startDeg = currentDeg;
    const endDeg = currentDeg + span;
    currentDeg = endDeg;

    const midDeg = (startDeg + endDeg) / 2;
    const midRad = ((midDeg - 90) * Math.PI) / 180;
    const rMid = 84;
    const tx = 120 + rMid * Math.cos(midRad);
    const ty = 120 + rMid * Math.sin(midRad);
    const pct = t.pct;

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
      hint={hint}
    >
      <div className="flex flex-col items-center">
        {/* Donut Chart SVG */}
        <div className="relative my-1 w-full max-w-60">
          <svg
            viewBox="0 0 240 240"
            className="h-auto w-full drop-shadow-sm"
            role="img"
            aria-label="内容结构分布环形图"
          >
            {sliceData.map(({ theme, startDeg, endDeg, tx, ty, pct }) => {
              const isHovered = hoveredKey === theme.key;
              const rIn = isHovered ? 58 : 62;
              const rOut = isHovered ? 110 : 104;
              const d = describeArc(120, 120, rIn, rOut, startDeg, endDeg);
              const textColor = themeLabelColor(theme.key);

              return (
                <a
                  key={theme.key}
                  href={`#emails/${encodeURIComponent(theme.key)}`}
                  aria-label={`查看${theme.labelZh}主题邮件：${theme.count} 封，占 ${pct}%`}
                  className="group cursor-pointer focus:outline-none"
                  onMouseEnter={() => setHoveredKey(theme.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(theme.key)}
                  onBlur={() => setHoveredKey(null)}
                >
                  <path
                    d={d}
                    fill={themeColor(theme.key)}
                    stroke="var(--surface-card)"
                    strokeWidth={isHovered ? "3" : "2"}
                    className="transition-all duration-200 group-focus-visible:stroke-slate-900"
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
                </a>
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
                  style={{ fill: "var(--color-slate-900)" }}
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
                  {total}
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
          className="chart-legend mt-3 grid w-full gap-2 text-xs sm:text-[13px]"
          role="group"
          aria-label="主题图例"
        >
          {sliceData.map(({ theme, pct }) => {
            const isHovered = hoveredKey === theme.key;
            return (
              <a
                key={theme.key}
                href={`#emails/${encodeURIComponent(theme.key)}`}
                onMouseEnter={() => setHoveredKey(theme.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(theme.key)}
                onBlur={() => setHoveredKey(null)}
                className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left no-underline transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] ${
                  isHovered
                    ? "border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
                }`}
                aria-label={`查看${theme.labelZh}主题邮件：${theme.count} 封，占 ${pct}%`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: themeColor(theme.key) }}
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
                  <span className="ml-1 text-xs text-slate-600">({pct}%)</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
