import { useMemo } from "react";
import { useLocale } from "../i18n";
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

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 19v-6M12 19V8M18 19V4" />
    </svg>
  );
}

export function KpiGrid() {
  const { t } = useLocale();
  const { status, emails, meta, retry } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const total = data && data.total > 0 ? String(data.total) : "—";
  const perDay = data && data.total > 0 ? (data.total / data.windowDays).toFixed(1) : "—";
  const kpis = [
    { num: total, label: t("kpiTotalEmails"), icon: <MailIcon />, theme: "price" },
    { num: perDay, label: t("kpiPerDay"), icon: <ChartIcon />, theme: "category" },
  ];

  return (
    <section className="min-w-0" aria-labelledby="kpi-title" aria-busy={status === "loading"}>
      <h2 id="kpi-title" className="sr-only">
        {t("kpiTitle")}
      </h2>
      <dl className="grid grid-cols-2 gap-[var(--card-padding)] sm:gap-[var(--card-padding-sm)]">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card h-full">
            <div
              aria-hidden="true"
              className="flex size-[calc(var(--card-padding)*2)] shrink-0 items-center justify-center rounded-[var(--card-radius)] sm:size-[calc(var(--card-padding)*3)] [&_svg]:size-[var(--card-padding-sm)] [&_svg]:fill-none [&_svg]:stroke-2 [&_svg]:stroke-current [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round sm:[&_svg]:size-[calc(var(--card-padding)*1.5)]"
              style={{
                color: `var(--theme-${kpi.theme}-text)`,
                background: THEME_TINTS[kpi.theme],
              }}
            >
              {kpi.icon}
            </div>
            <div className="flex min-w-0 max-w-full flex-col">
              <dt className="order-2 mt-[calc(var(--card-padding)/4)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)] sm:text-[length:var(--type-body-size)] sm:leading-[var(--type-body-leading)]">{kpi.label}</dt>
              <dd className="kpi-value order-1 text-[length:var(--type-h1-size)] font-[number:var(--type-h1-weight)] leading-[var(--type-h1-leading)] tracking-[var(--type-heading-tracking)] text-[var(--text-heading)] tabular-nums sm:text-[length:var(--type-h1-size-lg)]">
                {kpi.num}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {status === "ready" && data?.total === 0 ? (
        <div className={`mt-[var(--card-padding)] ${EMPTY_STATE_CLASS_NAME}`}>
          <EmptyState
            title={t("kpiEmptyTitle")}
            description={`${meta.market} · ${formatWindowRange(data.window)}${t("kpiEmptyDescPart1")}${meta.range}${t("kpiEmptyDescPart2")}${meta.weekCount}${t("kpiEmptyDescPart3")}`}
            actionLabel={market === null ? t("kpiRetry") : t("kpiSwitchAllMarkets")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      ) : status !== "ready" ? (
        <p role="status" className="mt-[calc(var(--card-padding)/2)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)]">
          {status === "loading" ? t("kpiLoadingStatus") : t("kpiErrorStatus")}
        </p>
      ) : null}
    </section>
  );
}
