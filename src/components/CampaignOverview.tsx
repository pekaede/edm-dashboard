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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2.5 font-semibold">Brand</th>
              {DATA.weeks.map((w) => (
                <th key={w.id} className="px-3 py-2.5 text-center font-semibold">
                  {w.label}
                  <span className="block text-xs font-normal text-slate-500">{w.range}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold">合计</th>
              <th className="px-3 py-2.5 text-center font-semibold">日均</th>
              <th className="px-3 py-2.5 font-semibold">主要策略</th>
            </tr>
          </thead>
          <tbody>
            {DATA.brands.map((b) => (
              <tr key={b.name} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-semibold">{b.name}</td>
                {b.weekly.map((n, i) => {
                  const alpha = 0.08 + 0.72 * (n / maxWeekly);
                  return (
                    <td
                      key={i}
                      className="px-3 py-2.5 text-center font-bold"
                      style={{
                        background: `rgba(37, 99, 235, ${alpha.toFixed(2)})`,
                      }}
                    >
                      {n}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center font-bold">{b.total}</td>
                <td className="px-3 py-2.5 text-center">{b.perDay.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-slate-600">{b.strategy}</td>
              </tr>
            ))}
            <tr className="border-b border-slate-100 font-semibold">
              <td className="px-3 py-2.5">合计</td>
              {weekTotals.map((n, i) => (
                <td key={i} className="bg-slate-900/5 px-3 py-2.5 text-center">
                  {n}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center">{TOTAL}</td>
              <td className="px-3 py-2.5 text-center">{(TOTAL / DAYS).toFixed(1)}</td>
              <td className="px-3 py-2.5 text-slate-400">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-900">
          各品牌每周主要 Campaign 主题
        </summary>
        <div className="mt-3 space-y-3">
          {DATA.brands.map((b) => (
            <div key={b.name}>
              <b className="mr-2 inline-block min-w-28">{b.name}</b>
              {b.campaigns.map((c, i) => (
                <div key={i} className="text-slate-600">
                  <b className="font-medium text-slate-800">{DATA.weeks[i].label}：</b>
                  {c}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
