import { DATA } from "../data";
import { DAYS, THEME_COLORS, THEME_TINTS, TOTAL } from "./dashboard";

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
    { num: String(TOTAL), label: "邮件总数", icon: <MailIcon />, theme: "price" },
    { num: String(DATA.meta.brandCount), label: "品牌", icon: <TagIcon />, theme: "behavior" },
    { num: String(DATA.meta.weekCount), label: "周", icon: <CalendarIcon />, theme: "new" },
    { num: (TOTAL / DAYS).toFixed(1), label: "日均邮件", icon: <ChartIcon />, theme: "category" },
  ];

  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="sr-only">
        关键指标
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card group">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 sm:size-16 [&_svg]:size-7 [&_svg]:fill-none [&_svg]:stroke-[1.9] [&_svg]:stroke-current [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round sm:[&_svg]:size-8"
              style={{
                color: THEME_COLORS[k.theme],
                background: THEME_TINTS[k.theme],
              }}
            >
              {k.icon}
            </div>
            <div className="flex min-w-0 flex-col">
              <dt className="order-2 mt-1 text-sm font-semibold text-slate-600 sm:text-base">{k.label}</dt>
              <dd className="order-1 text-3xl font-extrabold tracking-tight text-slate-950 tabular-nums sm:text-4xl">
                {k.num}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
