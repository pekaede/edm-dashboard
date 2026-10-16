import { DATA } from "../data";
import { DAYS, TOTAL } from "./dashboard";

export function KpiGrid() {
  const kpis = [
    { num: String(TOTAL), label: "邮件总数（样本）" },
    { num: String(DATA.meta.brandCount), label: "品牌" },
    { num: String(DATA.meta.weekCount), label: "周" },
    { num: (TOTAL / DAYS).toFixed(1), label: "日均邮件（6 品牌合计）" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
        >
          <div className="text-3xl font-bold tracking-tight text-slate-900">{k.num}</div>
          <div className="mt-1 text-sm text-slate-500">{k.label}</div>
        </div>
      ))}
    </div>
  );
}
