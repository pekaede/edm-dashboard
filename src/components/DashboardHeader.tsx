import { useMemo } from "react";
import { DATA } from "../data";
import { countEmailsByMarket, useExtendedEmails } from "../email-data";
import { useLocale } from "../i18n";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useSiteThreeWeekData, useSiteSelection } from "../site-data";
import { MarketFilter } from "./MarketFilter";
import { formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

export function DashboardHeader() {
  const { t } = useLocale();
  const { status, meta, data } = useSiteThreeWeekData();
  const allEmails = useExtendedEmails();
  const { market, setMarket } = useSiteSelection();
  const marketCounts = useMemo(() => countEmailsByMarket(allEmails.emails), [allEmails.emails]);
  const tags = [
    { label: meta.market, theme: "price" },
    { label: meta.source, theme: "behavior" },
    { label: `${data ? data.total : "—"} ${t("headerSamplesThreeWeeks")}`, theme: "new" },
    {
      label: `${t("headerThreeMonthBrands")} ${data ? meta.brandCount : "—"} · ${t("headerStudyPeriod")} ${meta.weekCount} ${t("headerWeeks")}`,
      theme: "lifestyle",
    },
  ];

  return (
    <header className="dashboard-header dashboard-container flex flex-col gap-[var(--card-padding)] py-[var(--card-padding)] sm:gap-[var(--card-padding-sm)] sm:py-[var(--card-padding-sm)]">
      <div className="flex flex-col gap-[var(--card-padding)] lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="dashboard-title text-[var(--text-heading)]">
            {DATA.meta.title}
          </h1>
          <p className="mt-[calc(var(--card-padding)/2)] text-[length:var(--type-body-size)] leading-[var(--type-body-leading)] text-[var(--text-secondary)]">
            Email Marketing Intelligence
          </p>
        </div>
        <div className="flex flex-col items-start gap-[calc(var(--card-padding)/2)] lg:items-end">
          <LanguageToggle />
          <div className="min-w-0 max-w-full border-l-2 border-[var(--accent-ink)] pl-[var(--card-padding)] lg:text-right">
            <p className="text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)]">{t("headerStudyPeriod")}</p>
            <p className="mt-[calc(var(--card-padding)/4)] text-[length:var(--type-body-size)] font-[number:var(--type-h3-weight)] leading-[var(--type-body-leading)] text-[var(--text-body)] tabular-nums">{formatWindowRange(THREE_WEEK_WINDOW)}</p>
          </div>
        </div>
      </div>
      <section
        aria-labelledby="global-site-title"
        className="space-y-[var(--card-padding)] rounded-[var(--card-radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-[var(--card-padding)] shadow-[var(--card-shadow)] sm:p-[var(--card-padding-sm)]"
      >
        <div className="flex flex-col gap-[var(--card-padding)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 id="global-site-title" className="text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-secondary)]">{t("globalSite")}</h2>
            <p className="mt-[calc(var(--card-padding)/4)] text-[length:var(--type-h2-size)] font-[number:var(--type-h2-weight)] leading-[var(--type-h2-leading)] text-[var(--text-heading)] sm:text-[length:var(--type-h2-size-sm)]">
              {meta.market}
            </p>
          </div>
          <div className="dashboard-site-filter min-w-0">
            <MarketFilter value={market} onChange={setMarket} counts={marketCounts} total={allEmails.total} label={t("globalSiteThreeMonths")} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-[calc(var(--card-padding)/2)]" aria-label={t("headerDataScopeSummary")}>
          {tags.map(({ label, theme }) => (
            <li
              key={label}
              className="min-w-0 max-w-full rounded-[var(--card-radius)] border px-[calc(var(--card-padding)/2)] py-[calc(var(--card-padding)/4)] text-[length:var(--type-helper-size)] leading-[var(--type-helper-leading)] text-[var(--text-body)]"
              style={{
                borderColor: `color-mix(in srgb, ${THEME_COLORS[theme]} 35%, var(--border-default))`,
                background: THEME_TINTS[theme],
              }}
            >
              {label}
            </li>
          ))}
        </ul>
        <p className="text-[length:var(--type-helper-size)] leading-[var(--type-body-leading)] text-[var(--text-secondary)]">
          {meta.source} · {t("headerQueryFixedTo")} {meta.windowEnd}{t("headerSiteLinkedDescription")}
          {status === "loading" ? t("headerCountLoading") : null}
        </p>
      </section>
    </header>
  );
}
