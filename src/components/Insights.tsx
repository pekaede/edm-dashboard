import { DATA } from "../data";
import { Card } from "./Card";

export function Insights() {
  return (
    <Card title="关键洞察">
      <ul className="grid gap-3 text-sm leading-7 md:grid-cols-2">
        {DATA.insights.map((s, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 transition-colors hover:border-indigo-200/80 hover:bg-indigo-50/30 sm:p-5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-mono text-xs font-semibold text-white shadow-sm shadow-indigo-200 tabular-nums">
              0{i + 1}
            </span>
            <span className="text-slate-700">{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
