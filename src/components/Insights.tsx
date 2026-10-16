import { DATA } from "../data";
import { Card } from "./Card";

export function Insights() {
  return (
    <Card title="关键洞察">
      <ul className="space-y-3 text-sm leading-relaxed">
        {DATA.insights.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
