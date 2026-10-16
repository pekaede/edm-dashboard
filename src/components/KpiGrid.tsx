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
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" aria-label="关键指标">
      {kpis.map((k, index) => (
        <div
          key={k.label}
          className="group relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03),0_10px_28px_rgb(15_23_42/0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-[0_12px_32px_rgb(79_70_229/0.09)] sm:p-6"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
              0{index + 1}
            </span>
            <span className="h-2 w-2 rounded-full bg-indigo-100 ring-4 ring-indigo-50 transition-colors group-hover:bg-indigo-400" />
          </div>
          <div className="font-mono text-3xl font-semibold tracking-[-0.04em] text-slate-950 tabular-nums sm:text-4xl">
            {k.num}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">{k.label}</div>
        </div>
      ))}
    </section>
  );
}
