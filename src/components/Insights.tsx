import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

const INSIGHT_THEMES = ["price", "behavior", "new", "lifestyle"];

export function Insights() {
  return (
    <Card title="关键洞察">
      <ul className="grid h-full gap-3 text-sm leading-6 sm:grid-cols-2">
        {DATA.insights.map((s, i) => (
          <li
            key={i}
            className="group flex min-h-24 gap-4 rounded-lg border border-slate-200/80 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_20px_rgb(58_76_110/0.07)]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[5px] text-base font-bold text-white shadow-sm"
              style={{
                background: THEME_COLORS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
                borderColor: THEME_TINTS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
              }}
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-slate-600">{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
