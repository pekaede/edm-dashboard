import { useMemo } from "react";
import { useLocale } from "../i18n";
import { useSiteEmails } from "../site-data";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";

export function DashboardFooter() {
  const { t } = useLocale();
  const { status, emails, meta } = useSiteEmails();

  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const safeThreeWeekTotal = data ? `${data.total} ${t("footerUnitEmails")}` : status === "loading" ? t("loading") : "—";
  const safeSiteTotal = status === "ready" ? `${emails.length} ${t("footerUnitEmails")}` : status === "loading" ? t("loading") : "—";
  // 窗口天数由 meta 起止推导（live 93 天；JSON 历史快照 92 天），不硬编码。
  const windowDays = Math.round(
    (Date.parse(meta.windowEnd) - Date.parse(meta.windowStart)) / 86_400_000,
  ) + 1;

  return (
    <footer
      role="contentinfo"
      aria-label={t("footerAriaLabel")}
      className="mt-12 border-t border-[var(--border-default)] pt-8 pb-12 text-xs leading-relaxed text-[var(--text-secondary)]"
    >
      {/* 顶部数据范围与核心指标摘要 */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              {t("footerStatWindow")}{meta.range}{t("footerLocalMarketDate")}
            </span>
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              {t("footerFixedCutoff")}{meta.windowEnd}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--text-body)]">
            <span>{t("footerCurrentSiteSamples")}<strong className="text-[var(--text-heading)]">{safeSiteTotal}</strong></span>
            <span aria-hidden="true" className="text-[var(--border-strong)]">|</span>
            <span>{t("footerThreeWeekAgg")}<strong className="text-[var(--text-heading)]">{safeThreeWeekTotal}</strong>（{formatWindowRange(THREE_WEEK_WINDOW)}）</span>
          </div>
        </div>
      </div>

      {/* 核心口径三列分栏说明 */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 第一列：总数含义 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            {t("footerTotalMeaningTitle")}
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">{t("footerTotalMeaningLabel")}</strong>{t("footerTotalMeaningText1")}<strong className="font-semibold text-[var(--text-body)]">{t("footerTotalMeaningHighlight")}</strong>
          </p>
        </div>

        {/* 第二列：固定截止日与时间更新口径 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            {t("footerCutoffTimeTitle")}
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">{t("footerCutoffLabel")}</strong>{meta.dataSource === "json" ? (
              <>{t("footerJsonIntro")}<strong className="font-semibold text-[var(--text-body)]">{meta.windowEnd}</strong>{t("footerJsonCoverage")}<strong className="font-semibold text-[var(--text-body)]">{meta.range}</strong>{t("footerJsonWindowPart1")}{windowDays}{t("footerJsonWindowPart2")}</>
            ) : (
              <>{t("footerLiveIntro")}<strong className="font-semibold text-[var(--text-body)]">{meta.windowEnd}</strong>{t("footerLiveCoverage")}<strong className="font-semibold text-[var(--text-body)]">{meta.range}</strong>{t("footerLiveWindowPart1")}{windowDays}{t("footerLiveWindowPart2")}{windowDays}{t("footerLiveWindowPart3")}</>
            )}
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">{t("footerTimeStandardLabel")}</strong>{t("footerTimeStandardText1")}<strong className="font-semibold text-[var(--text-body)]">{t("footerTimeStandardHighlight")}</strong>{t("footerTimeStandardText2")}
          </p>
        </div>

        {/* 第三列：市场覆盖与分析规则 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            {t("footerMarketCoverageTitle")}
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">{t("footerMarketCoverageLabel")}</strong>{t("footerMarketCoverageText")}{meta.dataSource === "json" ? t("footerMarketJsonNote") : ""}
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">{t("footerBrandRulesLabel")}</strong>{t("footerBrandRulesText")}
          </p>
        </div>
      </div>
    </footer>
  );
}
