import { DATA } from "../data";
import { DAYS, TOTAL } from "./dashboard";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12.5 12 4h7.5v7.5L11 20z" />
      <circle cx="16.5" cy="7.5" r="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5h14v14H5zM8 3v5M16 3v5M5 9h14" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 19v-6M12 19V8M18 19V4" />
    </svg>
  );
}

export function KpiGrid() {
  const kpis = [
    { num: String(TOTAL), label: "邮件总数", icon: <MailIcon />, color: "#e85d75", tint: "#fdecef" },
    { num: String(DATA.meta.brandCount), label: "品牌", icon: <TagIcon />, color: "#f2a93b", tint: "#fff4d9" },
    { num: String(DATA.meta.weekCount), label: "周", icon: <CalendarIcon />, color: "#39a96b", tint: "#e8f7ee" },
    { num: (TOTAL / DAYS).toFixed(1), label: "日均邮件", icon: <ChartIcon />, color: "#55a6e8", tint: "#e8f4fc" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="关键指标">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="group flex min-h-28 items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_8px_28px_rgb(58_76_110/0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgb(58_76_110/0.09)] sm:gap-5 sm:px-6"
        >
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105 [&_svg]:h-8 [&_svg]:w-8 [&_svg]:fill-none [&_svg]:stroke-[1.9] [&_svg]:stroke-current [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round"
            style={{ color: k.color, background: k.tint }}
          >
            {k.icon}
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-[-0.04em] text-[#0d1836] tabular-nums sm:text-4xl">
              {k.num}
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-500 sm:text-base">{k.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
