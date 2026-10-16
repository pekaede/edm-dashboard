import { DATA } from "../data";
import { Card } from "./Card";
import { pct, TOTAL } from "./dashboard";

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
        stroke={t.color}
        strokeWidth="44"
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
      className="h-52 w-52 shrink-0"
      role="img"
      aria-label="内容结构分布"
    >
      {segments}
      <text x="120" y="114" textAnchor="middle" className="fill-slate-900 text-2xl font-bold">
        {TOTAL}
      </text>
      <text x="120" y="138" textAnchor="middle" className="fill-slate-500 text-xs">
        封邮件
      </text>
    </svg>
  );
}

export function ThemeDistribution() {
  return (
    <Card title="内容结构分布" hint="196 封邮件，每封只归一类。">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <Donut />
        <ul className="space-y-2 text-sm">
          {DATA.themes.map((t) => (
            <li key={t.key} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-[4px]"
                style={{ background: t.color }}
              />
              {t.labelZh} {t.label} · {t.count} 封 · {pct(t.count)}%
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
