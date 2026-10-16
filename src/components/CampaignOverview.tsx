import { DATA } from "../data";
import { Card } from "./Card";
import { DAYS, TOTAL } from "./dashboard";

export function CampaignOverview() {
  const maxWeekly = Math.max(...DATA.brands.flatMap((b) => b.weekly));
  const weekTotals = DATA.weeks.map((_, i) =>
    DATA.brands.reduce((s, b) => s + b.weekly[i], 0),
  );

  return (
    <Card
      title="品牌 × 周 × Campaign 主题"
      hint="单元格数字为该品牌当周邮件封数，颜色越深封数越多。"
    >
      <div className="overflow-x-auto rounded-xl border border-slate-200/80">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="px-4 py-3.5 font-semibold">Brand</th>
              {DATA.weeks.map((w) => (
                <th key={w.id} className="px-3 py-3.5 text-center font-semibold">
                  {w.label}
                  <span className="mt-0.5 block font-normal tracking-normal text-slate-400 normal-case">
                    {w.range}
                  </span>
                </th>
              ))}
              <th className="px-3 py-3.5 text-center font-semibold">合计</th>
              <th className="px-3 py-3.5 text-center font-semibold">日均</th>
              <th className="px-4 py-3.5 font-semibold">主要策略</th>
            </tr>
          </thead>
          <tbody>
            {DATA.brands.map((b) => (
              <tr
                key={b.name}
                className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3.5 font-semibold text-slate-900">{b.name}</td>
                {b.weekly.map((n, i) => {
                  const lightness = 95 - 38 * (n / maxWeekly);
                  return (
                    <td key={i} className="px-2 py-2.5 text-center">
                      <span
                        className={`mx-auto flex h-10 w-full min-w-14 items-center justify-center rounded-lg font-mono font-semibold tabular-nums ${
                          lightness <= 62 ? "text-white" : "text-indigo-950"
                        }`}
                        style={{ background: `hsl(243 75% ${lightness.toFixed(1)}%)` }}
                      >
                        {n}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-3.5 text-center font-mono font-semibold text-slate-900 tabular-nums">
                  {b.total}
                </td>
                <td className="px-3 py-3.5 text-center font-mono text-slate-600 tabular-nums">
                  {b.perDay.toFixed(1)}
                </td>
                <td className="max-w-56 px-4 py-3.5 leading-5 text-slate-600">{b.strategy}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 bg-slate-50/70 font-semibold text-slate-800">
              <td className="px-4 py-3.5">合计</td>
              {weekTotals.map((n, i) => (
                <td key={i} className="px-3 py-3.5 text-center font-mono tabular-nums">
                  {n}
                </td>
              ))}
              <td className="px-3 py-3.5 text-center font-mono tabular-nums">{TOTAL}</td>
              <td className="px-3 py-3.5 text-center font-mono tabular-nums">
                {(TOTAL / DAYS).toFixed(1)}
              </td>
              <td className="px-4 py-3.5 text-slate-400">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details className="group mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 text-sm open:bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-semibold text-slate-800 transition-colors hover:text-indigo-700 [&::-webkit-details-marker]:hidden">
          <span>各品牌每周主要 Campaign 主题</span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-normal text-slate-500 transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="space-y-5 border-t border-slate-200/80 px-4 py-5">
          {DATA.brands.map((b) => (
            <div key={b.name} className="grid gap-2 sm:grid-cols-[7rem_1fr]">
              <b className="text-slate-900">{b.name}</b>
              <div className="space-y-1.5">
                {b.campaigns.map((c, i) => (
                  <div key={i} className="leading-6 text-slate-600">
                    <b className="mr-1.5 font-medium text-slate-800">{DATA.weeks[i].label}：</b>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
