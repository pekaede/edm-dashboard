import { DATA } from "../data";
import { Card } from "./Card";
import { pct, THEME_COLORS, TOTAL } from "./dashboard";

function Donut() {
  const C = 2 * Math.PI * 80;
  let acc = 0;
  const segments = DATA.themes.map((t) => {
    const len = (t.count / TOTAL) * C;
    const el = (
      <circle
        key={t.key}
        cx="120"
        cy="120"
        r="80"
        fill="none"
        stroke={THEME_COLORS[t.key]}
        strokeWidth="38"
        strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`}
        strokeDashoffset={(-acc).toFixed(1)}
        transform="rotate(-90 120 120)"
      />
    );
    acc += len;
    return el;
  });

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-52 w-52 shrink-0 drop-shadow-[0_10px_20px_rgb(79_70_229/0.08)] sm:h-56 sm:w-56"
      role="img"
      aria-label="内容结构分布"
    >
      <circle cx="120" cy="120" r="80" fill="none" stroke="#eef2f7" strokeWidth="38" />
      {segments}
      <text
        x="120"
        y="113"
        textAnchor="middle"
        className="fill-slate-950 font-mono text-3xl font-semibold tracking-tight tabular-nums"
      >
        {TOTAL}
      </text>
      <text x="120" y="139" textAnchor="middle" className="fill-slate-400 text-xs font-medium">
        封邮件
      </text>
    </svg>
  );
}

export function ThemeDistribution() {
  return (
    <Card title="内容结构分布" hint="196 封邮件，每封只归一类。">
      <div className="flex flex-col items-center justify-center gap-7 sm:flex-row sm:justify-start lg:gap-8">
        <Donut />
        <ul className="w-full space-y-1.5 text-sm">
          {DATA.themes.map((t) => (
            <li
              key={t.key}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: THEME_COLORS[t.key] }} />
              <span className="min-w-0">
                <span className="font-medium text-slate-800">{t.labelZh}</span>
                <span className="ml-1.5 text-xs text-slate-400">{t.label}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-xs text-slate-500 tabular-nums">
                {t.count} 封 · {pct(t.count)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
