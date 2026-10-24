import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  buildCalendarData,
  CALENDAR_BRANDS,
  CALENDAR_DATES,
  CALENDAR_END_DATE,
  CALENDAR_START_DATE,
  validateCalendarData,
  type BrandKey,
} from "../data-calendar";
import { getEmailMarket } from "../email-data";
import { getCurrentLocale, translate, useLocale, type DictionaryKey } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { themeLabelKeyOf } from "./dashboard";
import { EMPTY_STATE_CLASS_NAME } from "./empty-state-class";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const WINDOW_START = CALENDAR_START_DATE;
const WINDOW_END = CALENDAR_END_DATE;
// 月份选项由当前窗口推导（不硬编码月份列表），窗口滑动后自动跟随。
interface MonthDef {
  key: string;
  year: number;
  month: number;
}

function deriveMonths(start: string, end: string): MonthDef[] {
  const months: MonthDef[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const endMonth = end.slice(0, 7);
  while (toDateString(cursor).slice(0, 7) <= endMonth) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push({ key, year, month });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function formatMonthLabel(month: MonthDef): string {
  const locale = getCurrentLocale() === "zh" ? "zh-CN" : "en-US";
  const date = new Date(Date.UTC(month.year, month.month - 1, 1));
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
}

function formatMonthFullLabel(month: MonthDef): string {
  const locale = getCurrentLocale() === "zh" ? "zh-CN" : "en-US";
  const date = new Date(Date.UTC(month.year, month.month - 1, 1));
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
const MONTHS = deriveMonths(WINDOW_START, WINDOW_END);
// 初始/回退选中月份：窗口第二个月（与此前默认 8 月一致），窗口不足两个月时取首月。
const DEFAULT_MONTH = MONTHS[1] ?? MONTHS[0];
const ALL_BRANDS = "全部" as const;
const DAY_LABEL_KEYS: DictionaryKey[] = ["calDay0", "calDay1", "calDay2", "calDay3", "calDay4", "calDay5", "calDay6"];
const EMPTY_DAY_COLOR = "var(--calendar-heat-empty)";
const HEAT_COLORS = ["var(--calendar-heat-1)", "var(--calendar-heat-2)", "var(--calendar-heat-3)", "var(--calendar-heat-4)", "var(--calendar-heat-5)"] as const;
type MonthKey = (typeof MONTHS)[number]["key"];

interface CalendarDay {
  date: string;
  inMonth: boolean;
  inWindow: boolean;
}

interface SearchResult {
  date: string;
  brand: string;
  market: string;
  count: number;
}

export interface CalendarViewProps {
  className?: string;
}

const BRANDS = CALENDAR_BRANDS;

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function createMonthWeeks(month: MonthKey): CalendarDay[][] {
  const monthStart = parseDate(`${month}-01`);
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const monthEnd = addDays(nextMonth, -1);
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getUTCDay());
  const weeks: CalendarDay[][] = [];

  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = addDays(weekStart, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = toDateString(addDays(weekStart, dayIndex));
        return {
          date,
          inMonth: date.startsWith(month),
          inWindow: date >= WINDOW_START && date <= WINDOW_END,
        };
      }),
    );
  }

  return weeks;
}

const WINDOW_DATES = CALENDAR_DATES;

function formatDate(date: string, includeYear = false): string {
  const parsed = parseDate(date);
  const locale = getCurrentLocale() === "zh" ? "zh-CN" : "en-US";
  const options: Intl.DateTimeFormatOptions = includeYear
    ? { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
    : { month: "numeric", day: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(parsed);
}

function getHeatColor(count: number, minimum: number, maximum: number): string {
  if (count === 0) {
    return EMPTY_DAY_COLOR;
  }

  if (minimum === maximum) {
    return HEAT_COLORS[2];
  }

  const normalized = (count - minimum) / (maximum - minimum);
  const colorIndex = Math.min(HEAT_COLORS.length - 1, Math.floor(normalized * HEAT_COLORS.length));
  return HEAT_COLORS[colorIndex];
}

function getThemeLabel(theme: string): string {
  const key = themeLabelKeyOf(theme);
  return key ? translate(key) : theme;
}

function getOriginalUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:" ? parsedUrl.href : null;
  } catch {
    return null;
  }
}

export function CalendarView({ className = "" }: CalendarViewProps) {
  const { t, locale } = useLocale();
  const emailData = useSiteEmails();
  const { market: selectedMarket, setMarket } = useSiteSelection();
  const { emails, status, total, meta } = emailData;
  const titleId = useId();
  const detailId = useId();
  const searchHelpId = useId();
  const monthPanelId = useId();
  const monthPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusDetailRef = useRef(false);
  const [selectedBrand, setSelectedBrand] = useState<BrandKey | typeof ALL_BRANDS>(ALL_BRANDS);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(DEFAULT_MONTH.key);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (selectedDate && focusDetailRef.current) {
      focusDetailRef.current = false;
      detailHeadingRef.current?.focus();
    }
  }, [selectedDate]);

  const built = useMemo(
    () => status === "ready" ? buildCalendarData(emails) : null,
    [emails, status],
  );
  const validation = useMemo(
    () => built && meta.total !== null ? validateCalendarData(emails, built, meta.total) : null,
    [built, emails, meta.total],
  );

  const calendarWeeks = useMemo(() => createMonthWeeks(selectedMonth), [selectedMonth]);
  const activeMonth = MONTHS.find((month) => month.key === selectedMonth) ?? DEFAULT_MONTH;

  const filteredEmails = useMemo(
    () =>
      emails.filter(
        (email) =>
          selectedBrand === ALL_BRANDS || email.brand === selectedBrand,
      ),
    [emails, selectedBrand],
  );

  const dailyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const date of WINDOW_DATES) {
      counts[date] = 0;
    }
    for (const email of filteredEmails) {
      counts[email.date] = (counts[email.date] ?? 0) + 1;
    }
    return counts;
  }, [filteredEmails]);

  const heatRange = useMemo(() => {
    const positiveCounts = WINDOW_DATES.map((date) => dailyCounts[date] ?? 0)
      .filter((count) => count > 0);

    return {
      minimum: positiveCounts.length > 0 ? Math.min(...positiveCounts) : 0,
      maximum: positiveCounts.length > 0 ? Math.max(...positiveCounts) : 0,
    };
  }, [dailyCounts]);

  const selectedEmails = useMemo(
    () =>
      selectedDate === null
        ? []
        : filteredEmails.filter((email) => email.date === selectedDate),
    [filteredEmails, selectedDate],
  );

  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!normalizedSearchTerm) {
      return [];
    }

    const matches = new Map<string, SearchResult>();
    for (const email of filteredEmails) {
      const isMatch = email.keywords.some((keyword) =>
        keyword.toLocaleLowerCase().includes(normalizedSearchTerm),
      );
      if (!isMatch) {
        continue;
      }

      // 搜索 key 含市场（m3）：US/UK 同日同品牌不再合并为一行，避免市场混淆。
      const key = `${email.date}\u0000${email.brand}\u0000${getEmailMarket(email)}`;
      const current = matches.get(key);
      if (current) {
        current.count += 1;
      } else {
        matches.set(key, { date: email.date, brand: email.brand, market: getEmailMarket(email), count: 1 });
      }
    }

    return [...matches.values()].sort(
      (left, right) => right.date.localeCompare(left.date) || left.brand.localeCompare(right.brand),
    );
  }, [filteredEmails, normalizedSearchTerm]);

  function handleClearCalendarSearch() {
    setSearchTerm("");
    searchInputRef.current?.focus();
  }

  function selectBrand(brand: BrandKey | typeof ALL_BRANDS) {
    setSelectedBrand(brand);
    setSelectedDate(null);
  }

  function resetCalendarFilters() {
    selectBrand(ALL_BRANDS);
    setSearchTerm("");
    if (selectedMarket !== null) {
      setMarket(null);
    } else if (selectedBrand === ALL_BRANDS) {
      emailData.retry();
    }
  }

  function selectMonth(month: MonthKey) {
    setSelectedMonth(month);
    setSelectedDate(null);
  }

  function handleMonthKeyDown(event: KeyboardEvent<HTMLButtonElement>, monthIndex: number) {
    let nextIndex = monthIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (monthIndex + 1) % MONTHS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (monthIndex - 1 + MONTHS.length) % MONTHS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = MONTHS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectMonth(MONTHS[nextIndex].key);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }

  function toggleDate(date: string, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    focusDetailRef.current = selectedDate !== date;
    setSelectedDate((currentDate) => (currentDate === date ? null : date));
  }

  function openSearchResult(date: string, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setSelectedMonth(date.slice(0, 7) as MonthKey);
    if (selectedDate === date) {
      detailHeadingRef.current?.focus();
    } else {
      focusDetailRef.current = true;
      setSelectedDate(date);
    }
  }

  function closeDetails() {
    focusDetailRef.current = false;
    setSelectedDate(null);
    if (detailTriggerRef.current?.isConnected) {
      detailTriggerRef.current.focus();
    } else {
      monthPanelRef.current?.focus();
    }
  }

  const displayBrand = selectedBrand === ALL_BRANDS ? t("calAllBrands") : selectedBrand;

  if (status !== "ready" || (validation && !validation.isValid)) {
    return (
      <section
        className={`calendar-view dashboard-card mx-auto w-full ${className}`.trim()}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="card-title text-[var(--text-calendar-heading)]">
          {t("calTitle")}
        </h2>
        <p className="mb-4 mt-1 text-sm text-[var(--text-calendar-secondary)]">{meta.range} · {meta.market}</p>
        <ExtendedEmailsState
          {...emailData}
          status={status === "ready" ? "error" : status}
          error={validation && !validation.isValid ? `${t("calValidationFailed")}${validation.errors.join("；")}` : emailData.error}
        />
      </section>
    );
  }

  return (
    <section
      className={`calendar-view dashboard-card mx-auto w-full ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId} className="card-title text-[var(--text-calendar-heading)]">
          {t("calTitle")}
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--text-calendar-secondary)]">
          {t("calSubtitle", { range: meta.range, market: meta.market, brands: meta.brandCount, total: total })}
        </p>
      </div>

      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("calBrandFilterAria")}>
          {[ALL_BRANDS, ...BRANDS].map((brand) => {
            const isSelected = selectedBrand === brand;
            return (
              <button
                type="button"
                key={brand}
                aria-pressed={isSelected}
                onClick={() => selectBrand(brand)}
                className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-calendar-focus)] focus-visible:ring-offset-2 ${
                  isSelected
                    ? "border-[var(--control-active-bg)] bg-[var(--control-active-bg)] text-[var(--control-active-text)]"
                    : "border-[var(--border-calendar-control)] bg-[var(--surface-calendar)] text-[var(--text-calendar-label)] hover:border-[var(--border-calendar-hover)] hover:bg-[var(--surface-calendar-hover)] hover:text-[var(--text-calendar-heading)]"
                }`}
              >
                {brand === ALL_BRANDS ? t("calAllBrands") : brand}
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-1 rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar-tabs)] p-1"
          role="tablist"
          aria-label={t("calMonthTablistAria")}
        >
          {MONTHS.map((month, monthIndex) => {
            const isSelected = selectedMonth === month.key;
            return (
              <button
                type="button"
                role="tab"
                id={`${monthPanelId}-${month.key}-tab`}
                key={month.key}
                aria-selected={isSelected}
                aria-controls={monthPanelId}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectMonth(month.key)}
                onKeyDown={(event) => handleMonthKeyDown(event, monthIndex)}
                className={`min-h-11 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-calendar-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-calendar-tabs)] ${
                  isSelected
                    ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
                    : "text-[var(--text-calendar-secondary)] hover:bg-[var(--surface-calendar)] hover:text-[var(--text-calendar-heading)]"
                }`}
              >
                {formatMonthLabel(month)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="section-title text-[var(--text-calendar-heading)]">{t("calDailyTitle", { month: formatMonthFullLabel(activeMonth) })}</h3>
            <p className="mt-0.5 text-sm text-[var(--text-calendar-secondary)]" aria-live="polite">
              {t("calScopeLine", { brand: displayBrand, market: getMarketLabel(selectedMarket), count: filteredEmails.length })}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-calendar-secondary)]"
            aria-label={t("calLegendAria", { min: heatRange.minimum, max: heatRange.maximum })}
          >
            <span>{t("calLegendLow")}</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="size-3 rounded-[3px] border border-[var(--border-calendar-legend)]" style={{ backgroundColor: EMPTY_DAY_COLOR }} />
              {HEAT_COLORS.map((color) => (
                <span
                  key={color}
                  className="size-3 rounded-[3px] border border-[var(--border-calendar-legend)]"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span>{t("calLegendHigh")}</span>
            <span className="ml-1 text-[var(--text-calendar-muted)]">
              {t("calLegendRange", { min: heatRange.minimum, max: heatRange.maximum })}
            </span>
          </div>
        </div>

        <div
          id={monthPanelId}
          ref={monthPanelRef}
          role="tabpanel"
          aria-labelledby={`${monthPanelId}-${selectedMonth}-tab`}
          tabIndex={0}
          className="calendar-month-panel mt-2 rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar)] shadow-[var(--shadow-calendar-panel)]"
        >
          {filteredEmails.length === 0 ? (
            <div className={EMPTY_STATE_CLASS_NAME}>
              <EmptyState
                title={t("calEmptyTitle")}
                description={t("calEmptyDesc", { brand: displayBrand, market: getMarketLabel(selectedMarket), range: meta.range })}
                actionLabel={selectedBrand === ALL_BRANDS && selectedMarket === null ? t("calRetry") : t("calResetFilters")}
                onAction={resetCalendarFilters}
              />
            </div>
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
              <caption className="sr-only">
                {t("calCaption", { month: formatMonthFullLabel(activeMonth), start: formatDate(WINDOW_START, true), end: formatDate(WINDOW_END, true) })}
              </caption>
              <thead>
                <tr>
                  {DAY_LABEL_KEYS.map((dayKey) => (
                    <th
                      scope="col"
                      key={dayKey}
                      className="h-5 text-xs font-semibold text-[var(--text-calendar-muted)]"
                    >
                      {t(dayKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarWeeks.map((week) => (
                  <tr key={week[0].date}>
                    {week.map((day) => {
                      if (!day.inMonth) {
                        return (
                          <td key={day.date} className="p-0" aria-hidden="true">
                            <span className="block h-12 rounded-md" />
                          </td>
                        );
                      }

                      const dayNumber = parseDate(day.date).getUTCDate();
                      if (!day.inWindow) {
                        return (
                          <td key={day.date} className="p-0">
                            <div
                              className="h-12 rounded-md border border-[var(--border-calendar-outside)] bg-[var(--surface-calendar-outside)] p-1 text-left text-xs font-medium leading-4 text-[var(--text-calendar-outside)]"
                              aria-label={t("calOutsideAria", { date: formatDate(day.date, true) })}
                            >
                              {dayNumber}
                            </div>
                          </td>
                        );
                      }

                      const count = dailyCounts[day.date] ?? 0;
                      const isSelected = selectedDate === day.date;
                      const heatColor = getHeatColor(count, heatRange.minimum, heatRange.maximum);
                      const usesWhiteText = heatColor === HEAT_COLORS[3] || heatColor === HEAT_COLORS[4];
                      return (
                        <td key={day.date} className="p-0">
                          <button
                            type="button"
                            onClick={(event) => toggleDate(day.date, event.currentTarget)}
                            aria-label={t("calDayAria", { date: formatDate(day.date, true), brand: displayBrand, market: getMarketLabel(selectedMarket), count: count })}
                            aria-expanded={isSelected}
                            aria-controls={detailId}
                            title={t("calDayTitle", { date: formatDate(day.date, true), brand: displayBrand, market: getMarketLabel(selectedMarket), count: count })}
                            className={`calendar-day-button group relative flex h-12 w-full flex-col items-start justify-center gap-0.5 rounded-md border border-[var(--border-calendar-legend)] px-0.5 py-1 text-left transition duration-150 hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-calendar-heading)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-calendar)] sm:p-1 ${
                              usesWhiteText ? "text-[var(--calendar-heat-strong-text)]" : count === 0 ? "text-[var(--calendar-heat-empty-text)]" : "text-[var(--calendar-heat-text)]"
                            } ${
                              isSelected ? "ring-2 ring-[var(--text-calendar-heading)] ring-offset-1 ring-offset-[var(--surface-calendar)]" : ""
                            }`}
                            style={{ backgroundColor: heatColor }}
                          >
                            <span className="text-xs font-semibold leading-4">
                              {dayNumber}
                            </span>
                            <span className="text-xs font-bold leading-4">
                              {count}<span className="hidden sm:inline"> {t("marketUnitEmails", { count })}</span>
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div id={detailId} className={selectedDate ? "mt-3" : ""} aria-live="polite">
          {selectedDate ? (
            <div
              className="calendar-detail rounded-2xl border border-[var(--border-calendar-detail)] bg-[var(--surface-calendar-detail)]"
              role="region"
              aria-labelledby={`${detailId}-title`}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeDetails();
                }
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${detailId}-title`} ref={detailHeadingRef} tabIndex={-1} className="rounded-md font-bold text-[var(--text-calendar-heading)]">
                  {formatDate(selectedDate, true)} · {selectedEmails.length} {t("marketUnitEmails", { count: selectedEmails.length })}
                </h3>
                <button
                  type="button"
                  onClick={closeDetails}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--text-calendar-secondary)] transition hover:bg-[var(--surface-calendar-item)] hover:text-[var(--text-calendar-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-calendar-focus)]"
                >
                  {t("calCloseDetail")}
                </button>
              </div>
              {selectedEmails.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedEmails.map((email, index) => {
                    const originalUrl = getOriginalUrl(email.url);

                    return (
                      <li
                        key={`${email.date}-${email.brand}-${email.theme}-${index}`}
                        className="rounded-xl border border-[var(--border-calendar-item)] bg-[var(--surface-calendar-item)] p-3 text-sm"
                      >
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldDate")}</dt>
                          <dd className="text-[var(--text-primary)]">{email.date}</dd>
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldBrand")}</dt>
                          <dd className="font-semibold text-[var(--text-primary)]">{email.brand}</dd>
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldMarket")}</dt>
                          <dd className="text-[var(--text-primary)]">{getMarketLabel(getEmailMarket(email))}</dd>
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldTheme")}</dt>
                          <dd className="text-[var(--text-primary)]">{getThemeLabel(email.theme)}</dd>
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldKeywords")}</dt>
                          <dd className="break-words text-[var(--text-primary)]">
                            {email.keywords.length > 0 ? email.keywords.join(locale === "zh" ? "、" : ", ") : t("calNoKeywords")}
                          </dd>
                          <dt className="font-semibold text-[var(--text-calendar-muted)]">{t("calFieldOriginal")}</dt>
                          <dd>
                            {originalUrl ? (
                              <a
                                href={originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t("calOpenOriginalAria", { brand: email.brand, date: email.date, market: getMarketLabel(getEmailMarket(email)), n: index + 1 })}
                                className="inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-[var(--accent-ink)] underline underline-offset-4"
                              >
                                {t("calOpenOriginal")} <span aria-hidden="true">↗</span>
                              </a>
                            ) : (
                              <span className="text-[var(--text-calendar-secondary)]">{t("calNoOriginal")}</span>
                            )}
                          </dd>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={`mt-[var(--card-padding)] ${EMPTY_STATE_CLASS_NAME}`}>
                  <EmptyState
                    title={t("calDayEmptyTitle")}
                    description={t("calDayEmptyDesc", { date: formatDate(selectedDate, true), brand: displayBrand, market: getMarketLabel(selectedMarket) })}
                    actionLabel={t("calBackToCalendar")}
                    onAction={closeDetails}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[var(--border-calendar)] pt-3">
          <label htmlFor={`${searchHelpId}-input`} className="text-base font-bold text-[var(--text-calendar-heading)]">
            {t("calSearchLabel")}
          </label>
          <p id={searchHelpId} className="mt-1 text-sm text-[var(--text-calendar-secondary)]">
            {t("calSearchHelp")}
          </p>
          <input
            id={`${searchHelpId}-input`}
            ref={searchInputRef}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-describedby={searchHelpId}
            placeholder={t("calSearchPlaceholder")}
            className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border-calendar-input)] bg-[var(--surface-calendar-item)] px-3 py-2 text-base text-[var(--text-calendar-heading)] outline-none transition placeholder:text-[var(--text-calendar-muted)] focus:border-[var(--control-calendar-focus)] focus:ring-2 focus:ring-[var(--selection-bg)]"
          />

          {normalizedSearchTerm ? (
            <div className="mt-4" aria-live="polite" aria-atomic="true">
              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-[var(--text-calendar-label)]">
                    {t("calSearchFound", { n: searchResults.length })}
                  </p>
                  <ul className="mt-2 divide-y divide-[var(--divider-calendar)] rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar-item)]">
                    {searchResults.map((result) => (
                      <li
                        key={`${result.date}-${result.brand}-${result.market}`}
                        className="calendar-search-result text-sm"
                      >
                        <time dateTime={result.date} className="font-medium text-[var(--text-calendar-secondary)]">
                          {result.date}
                        </time>
                        <span className="font-semibold text-[var(--text-calendar-heading)]">{result.brand}</span>
                        <span className="text-[var(--text-calendar-secondary)]">{getMarketLabel(result.market)}</span>
                        <span className="text-[var(--text-calendar-secondary)]">{result.count} {t("marketUnitEmails", { count: result.count })}</span>
                        <button
                          type="button"
                          onClick={(event) => openSearchResult(result.date, event.currentTarget)}
                          aria-label={t("calViewDayAria", { date: formatDate(result.date, true), brand: result.brand, market: getMarketLabel(result.market) })}
                          aria-controls={detailId}
                          aria-expanded={selectedDate === result.date}
                          className="min-h-11 rounded-lg border border-[var(--border-calendar-control)] bg-[var(--surface-calendar)] px-2 py-1 font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--surface-calendar-hover)]"
                        >
                          {t("calViewDay")}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className={EMPTY_STATE_CLASS_NAME}>
                  <EmptyState
                    title={t("calNoMatchTitle")}
                    description={t("calNoMatchDesc", { term: searchTerm.trim() })}
                    actionLabel={t("calClearSearch")}
                    onAction={handleClearCalendarSearch}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
