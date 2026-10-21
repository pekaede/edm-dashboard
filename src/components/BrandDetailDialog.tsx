import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { Brand } from "../data";
import { DATA } from "../data";
import { useLocale } from "../i18n";
import { themeColor, themeTint } from "../three-week-aggregation";
import { THEME_LABEL_KEYS } from "./dashboard";

interface BrandDetailDialogProps {
  brand: Brand;
  onClose: () => void;
}

export function BrandDetailDialog({ brand, onClose }: BrandDetailDialogProps) {
  const { t } = useLocale();
  const themeName = (theme: { key: string; labelZh: string }) =>
    THEME_LABEL_KEYS[theme.key] ? t(THEME_LABEL_KEYS[theme.key]) : theme.labelZh;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const maxWeekly = Math.max(...brand.weekly, 1);
  // 周标签（m1）：优先用实时聚合 weeks（buildAggregatedBrand 传入），缺失时回落静态 DATA.weeks。
  const weeks = brand.weeks ?? DATA.weeks;
  // 主题列表（m1）：静态主题 + 窗口内出现的未知主题（如 other），不要丢计数；
  // 未知主题标签回落为 "其他"（other）或原 key，颜色用 themeColor 的中性回落。
  const themeEntries = [
    ...DATA.themes.map((theme) => ({
      key: theme.key,
      labelZh: theme.labelZh,
      count: brand.themes[theme.key] ?? 0,
    })),
    ...Object.keys(brand.themes)
      .filter((key) => !DATA.themes.some((theme) => theme.key === key))
      .map((key) => ({
        key,
        labelZh: key === "other" ? "其他" : key,
        count: brand.themes[key] ?? 0,
      })),
  ];
  const closeDialog = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="brand-dialog m-auto overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-0 text-[var(--text-body)] shadow-2xl backdrop:bg-[var(--surface-overlay)] backdrop:backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={onClose}
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--surface-card)] px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            {t("bddEyebrow")}
          </p>
          <h2 id={titleId} className="mt-1 break-words text-2xl font-extrabold tracking-tight text-[var(--text-heading)] sm:text-3xl">
            {brand.name}
          </h2>
          <p id={descriptionId} className="mt-1 text-sm text-[var(--text-secondary)]">
            {t("bddDesc")}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("bddCloseAria")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] transition duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-heading)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
          onClick={closeDialog}
          autoFocus
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="space-y-7 px-5 py-6 sm:px-6 sm:py-7">
        <section aria-labelledby="brand-overview-title">
          <h3 id="brand-overview-title" className="dialog-section-title">
            {t("bddOverview")}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 sm:p-5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t("bddTotalLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--text-heading)]">
                {brand.total}
                <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">{t("marketUnitEmails", { count: brand.total })}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 sm:p-5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t("bddPerDayLabel")}</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--text-heading)]">
                {brand.perDay.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">{t("bddPerDayUnit")}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 sm:col-span-2 sm:p-5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t("bddStrategyLabel")}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[var(--text-primary)]">
                {brand.strategy}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-weekly-title">
          <h3 id="brand-weekly-title" className="dialog-section-title">
            {t("bddWeeklyTitle")}
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t("bddWeeklyNote", { max: maxWeekly })}</p>
          <div className="mt-4 space-y-4">
            {brand.weekly.map((count, index) => (
              <div key={weeks[index].id} className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)_4rem] items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-body)]">{weeks[index].label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{weeks[index].range}</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]" aria-hidden="true">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${(count / maxWeekly) * 100}%`,
                      backgroundColor: "var(--control-active-bg)",
                    }}
                  />
                </div>
                <span className="text-right font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  {count} {t("marketUnitEmails", { count })}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="brand-themes-title">
          <h3 id="brand-themes-title" className="dialog-section-title">
            {t("bddThemesTitle")}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {themeEntries.map((theme) => {
              const count = theme.count;
              const percentage = brand.total > 0 ? Math.round((count / brand.total) * 100) : 0;
              const color = themeColor(theme.key);
              const tint = themeTint(theme.key);

              return (
                <div
                  key={theme.key}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: color,
                    backgroundColor: tint,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-body)]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      {themeName(theme)}
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-[var(--text-heading)]">
                      {count} {t("marketUnitEmails", { count })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-card)]" aria-hidden="true">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="brand-campaigns-title">
          <h3 id="brand-campaigns-title" className="dialog-section-title">
            {t("bddCampaignsTitle")}
          </h3>
          <ol className="mt-4 space-y-3">
            {brand.campaigns.slice(0, 3).map((campaign, index) => (
              <li key={weeks[index].id} className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)]/70 p-4 sm:gap-4">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                  style={{
                    color: "var(--theme-category-text)",
                    backgroundColor: themeTint("category"),
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-[var(--text-primary)]">
                    {weeks[index].label}
                    <span className="text-xs font-normal text-[var(--text-secondary)]">
                      {weeks[index].range}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{campaign}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </dialog>
  );
}
