import { useMemo } from "react";
import { useExtendedEmails } from "../email-data";
import { aggregateThreeWeek } from "../three-week-aggregation";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

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
  // KPI 取 3 周实时聚合（B2），不再用冻结快照 DATA.meta.total = 196：
  // 邮件总数 = 聚合 total（默认窗口全市场 211），日均 = total / 窗口天数（211 / 22 = 9.6）。
  // 未就绪时显示 "—"，不回落到冻结值，避免与 3 周表矛盾。
  const { status, emails, meta } = useExtendedEmails();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const total = data ? String(data.total) : "—";
  const perDay = data ? (data.total / data.windowDays).toFixed(1) : "—";
  const kpis = [
    { num: total, label: "3 周邮件总数", icon: <MailIcon />, theme: "price" },
    { num: String(meta.brandCount), label: "品牌", icon: <TagIcon />, theme: "behavior" },
    { num: String(meta.weekCount), label: "周", icon: <CalendarIcon />, theme: "new" },
    { num: perDay, label: "日均邮件", icon: <ChartIcon />, theme: "category" },
  ];

  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="sr-only">
        关键指标
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card group">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 sm:size-14 [&_svg]:size-5 [&_svg]:fill-none [&_svg]:stroke-[1.9] [&_svg]:stroke-current [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round sm:[&_svg]:size-7"
              style={{
                color: THEME_COLORS[k.theme],
                background: THEME_TINTS[k.theme],
              }}
            >
              {k.icon}
            </div>
            <div className="flex min-w-0 flex-col">
              <dt className="order-2 mt-1 text-xs font-semibold text-slate-600 sm:text-sm">{k.label}</dt>
              <dd className="order-1 text-2xl font-extrabold tracking-tight text-slate-950 tabular-nums sm:text-4xl">
                {k.num}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
