import { useMemo } from "react";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { aggregateThreeWeek, formatWindowRange } from "../three-week-aggregation";
import { THEME_TINTS } from "./dashboard";
import { EmptyState } from "./EmptyState";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

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
  const { status, emails, meta, retry } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const total = data && data.total > 0 ? String(data.total) : "—";
  const perDay = data && data.total > 0 ? (data.total / data.windowDays).toFixed(1) : "—";
  const kpis = [
    { num: total, label: "3 周邮件总数", icon: <MailIcon />, theme: "price" },
    { num: data && meta.brandCount > 0 ? String(meta.brandCount) : "—", label: "3 个月有记录品牌", icon: <TagIcon />, theme: "behavior" },
    { num: String(meta.weekCount), label: "研究周期（周）", icon: <CalendarIcon />, theme: "new" },
    { num: perDay, label: "日均邮件", icon: <ChartIcon />, theme: "category" },
  ];

  return (
    <section aria-labelledby="kpi-title" aria-busy={status === "loading"}>
      <h2 id="kpi-title" className="sr-only">
        关键指标
      </h2>
      <dl className="grid grid-cols-2 gap-[var(--card-padding)] sm:gap-[var(--card-padding-sm)] xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="dashboard-card h-full flex-row! items-center gap-[calc(var(--card-padding)/2)] sm:gap-[var(--card-padding)]">
            <div
              className="flex size-[calc(var(--card-padding)*2)] shrink-0 items-center justify-center rounded-[var(--card-radius)] sm:size-[calc(var(--card-padding)*3)] [&_svg]:size-[var(--card-padding-sm)] [&_svg]:fill-none [&_svg]:stroke-2 [&_svg]:stroke-current [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round sm:[&_svg]:size-[calc(var(--card-padding)*1.5)]"
              style={{
                color: `var(--theme-${kpi.theme}-text)`,
                background: THEME_TINTS[kpi.theme],
              }}
            >
              {kpi.icon}
            </div>
            <div className="flex min-w-0 flex-col">
              <dt className="order-2 mt-[calc(var(--card-padding)/4)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)] sm:text-[length:var(--type-body-size)] sm:leading-[var(--type-body-leading)]">{kpi.label}</dt>
              <dd className="order-1 text-[length:var(--type-h1-size)] font-[number:var(--type-h1-weight)] leading-[var(--type-h1-leading)] tracking-[var(--type-heading-tracking)] text-[var(--text-heading)] tabular-nums sm:text-[length:var(--type-h1-size-lg)]">
                {kpi.num}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {status === "ready" && data?.total === 0 ? (
        <div className={`mt-[var(--card-padding)] ${EMPTY_STATE_CLASS_NAME}`}>
          <EmptyState
            title="当前站点三周窗口暂无邮件"
            description={`${meta.market} · ${formatWindowRange(data.window)} 内暂无邮件，邮件总数与日均以 — 显示。品牌数按三个月（${meta.range}）统计，研究周期为 ${meta.weekCount} 周。`}
            actionLabel={market === null ? "重新拉取" : "切换至全部市场"}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      ) : status !== "ready" ? (
        <p role="status" className="mt-[calc(var(--card-padding)/2)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)]">
          {status === "loading"
            ? "指标加载中，邮件量与品牌数暂以 — 显示。"
            : "数据暂不可用，邮件量与品牌数以 — 显示；请查看下方数据状态。"}
        </p>
      ) : null}
    </section>
  );
}
