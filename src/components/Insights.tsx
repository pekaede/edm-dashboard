import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

const INSIGHT_THEMES = ["price", "behavior", "new", "lifestyle"];

export function Insights() {
  return (
    <Card title="关键洞察">
      <ol className="grid h-full auto-rows-fr gap-3 text-sm leading-6 sm:grid-cols-2 xl:grid-cols-1">
        {DATA.insights.map((s, i) => (
          <li
            key={i}
            className="group flex min-h-24 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm sm:gap-4 xl:items-center"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full border text-base font-bold text-slate-950 shadow-sm"
              style={{
                background: THEME_TINTS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
                borderColor: THEME_COLORS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
              }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="text-slate-700">{s}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
