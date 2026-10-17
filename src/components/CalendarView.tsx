import { useId, useMemo, useState, type KeyboardEvent } from "react";
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
import { useSiteEmails, useSiteSelection } from "../site-data";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

const WINDOW_START = CALENDAR_START_DATE;
const WINDOW_END = CALENDAR_END_DATE;
const ALL_BRANDS = "全部" as const;
const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const EMPTY_DAY_COLOR = "var(--calendar-heat-empty)";
const HEAT_COLORS = ["var(--calendar-heat-1)", "var(--calendar-heat-2)", "var(--calendar-heat-3)", "var(--calendar-heat-4)", "var(--calendar-heat-5)"] as const;
const MONTHS = [
  { key: "2026-07", label: "7 月", fullLabel: "2026年7月" },
  { key: "2026-08", label: "8 月", fullLabel: "2026年8月" },
  { key: "2026-09", label: "9 月", fullLabel: "2026年9月" },
  { key: "2026-10", label: "10 月", fullLabel: "2026年10月" },
] as const;

type MonthKey = (typeof MONTHS)[number]["key"];

const THEME_LABELS: Record<string, string> = {
  price: "价格促销",
  behavior: "行为触发",
  new: "上新",
  lifestyle: "生活方式",
  category: "品类聚焦",
  other: "其他",
};

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
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return includeYear ? `${parsed.getUTCFullYear()}年${month}月${day}日` : `${month}/${day}`;
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
  return THEME_LABELS[theme] ?? theme;
}

export function CalendarView({ className = "" }: CalendarViewProps) {
  const emailData = useSiteEmails();
  const { market: selectedMarket, setMarket } = useSiteSelection();
  const { emails, status, total, meta } = emailData;
  const titleId = useId();
  const detailId = useId();
  const searchHelpId = useId();
  const monthPanelId = useId();
  const [selectedBrand, setSelectedBrand] = useState<BrandKey | typeof ALL_BRANDS>(ALL_BRANDS);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>("2026-08");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const built = useMemo(
    () => status === "ready" ? buildCalendarData(emails) : null,
    [emails, status],
  );
  const validation = useMemo(
    () => built && meta.total !== null ? validateCalendarData(emails, built, meta.total) : null,
    [built, emails, meta.total],
  );

  const calendarWeeks = useMemo(() => createMonthWeeks(selectedMonth), [selectedMonth]);
  const activeMonth = MONTHS.find((month) => month.key === selectedMonth) ?? MONTHS[1];

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

  function toggleDate(date: string) {
    setSelectedDate((currentDate) => (currentDate === date ? null : date));
  }

  if (status !== "ready" || (validation && !validation.isValid)) {
    return (
      <section
        className={`dashboard-card mx-auto w-full max-w-3xl p-[var(--card-calendar-padding)]! sm:p-[var(--card-calendar-padding-sm)]! ${className}`.trim()}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="card-title text-[var(--text-calendar-heading)]">
          日历热力图与关键词搜索
        </h2>
        <p className="mb-4 mt-1 text-sm text-[var(--text-calendar-secondary)]">{meta.range} · {meta.market}</p>
        <ExtendedEmailsState
          {...emailData}
          status={status === "ready" ? "error" : status}
          error={validation && !validation.isValid ? `日历数据校验失败：${validation.errors.join("；")}` : emailData.error}
        />
      </section>
    );
  }

  return (
    <section
      className={`dashboard-card mx-auto w-full max-w-3xl p-[var(--card-calendar-padding)]! sm:p-[var(--card-calendar-padding-sm)]! ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId} className="card-title text-[var(--text-calendar-heading)]">
          日历热力图与关键词搜索
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--text-calendar-secondary)]">
          {meta.range} · {meta.market} · {meta.brandCount} 个有记录品牌 · 共 {total} 封邮件
        </p>
      </div>

      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="按品牌筛选邮件">
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
                    ? "border-[var(--text-calendar-heading)] bg-[var(--text-calendar-heading)] text-[var(--surface-calendar)]"
                    : "border-[var(--border-calendar-control)] bg-[var(--surface-calendar)] text-[var(--text-calendar-label)] hover:border-[var(--border-calendar-hover)] hover:bg-[var(--surface-calendar-hover)] hover:text-[var(--text-calendar-heading)]"
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-1 rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar-tabs)] p-1"
          role="tablist"
          aria-label="选择月份"
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
                    ? "bg-[var(--text-calendar-heading)] text-[var(--surface-calendar)] shadow-sm"
                    : "text-[var(--text-calendar-secondary)] hover:bg-[var(--surface-calendar)] hover:text-[var(--text-calendar-heading)]"
                }`}
              >
                {month.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="section-title text-[var(--text-calendar-heading)]">{activeMonth.fullLabel}每日发信量</h3>
            <p className="mt-0.5 text-sm text-[var(--text-calendar-secondary)]" aria-live="polite">
              当前范围：{selectedBrand} · {getMarketLabel(selectedMarket)}，共 {filteredEmails.length} 封
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-calendar-secondary)]"
            aria-label={`热力图颜色图例，无邮件为米白，有邮件时从每日 ${heatRange.minimum} 封到 ${heatRange.maximum} 封由浅至深`}
          >
            <span>少</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="size-3 rounded-[3px] border border-[var(--border-calendar-legend)]" style={{ backgroundColor: EMPTY_DAY_COLOR }} />
              {HEAT_COLORS.map((color) => (
                <span
                  key={color}
                  className="size-3 rounded-[3px] border border-black/5"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span>多</span>
            <span className="ml-1 text-[var(--text-calendar-muted)]">
              全窗口非零范围 {heatRange.minimum}–{heatRange.maximum} 封
            </span>
          </div>
        </div>

        <div
          id={monthPanelId}
          role="tabpanel"
          aria-labelledby={`${monthPanelId}-${selectedMonth}-tab`}
          className="mt-2 rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar)] p-1.5 shadow-[var(--shadow-calendar-panel)] sm:p-2"
        >
          {filteredEmails.length === 0 ? (
            <div className={EMPTY_STATE_CLASS_NAME}>
              <EmptyState
                title="当前筛选暂无邮件"
                description={`${selectedBrand} · ${getMarketLabel(selectedMarket)}在统计窗口 ${meta.range} 内暂无邮件（0 封），请切换市场或清除筛选。日历按日期统计邮件收录数。`}
                actionLabel={selectedBrand === ALL_BRANDS && selectedMarket === null ? "重新拉取" : "重置品牌与市场筛选"}
                onAction={resetCalendarFilters}
              />
            </div>
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
              <caption className="sr-only">
                {activeMonth.fullLabel}邮件日历，颜色深浅使用2026年7月16日至10月15日的全局刻度
              </caption>
              <thead>
                <tr>
                  {DAY_LABELS.map((dayLabel) => (
                    <th
                      scope="col"
                      key={dayLabel}
                      className="h-5 text-xs font-semibold text-[var(--text-calendar-muted)]"
                    >
                      {dayLabel}
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
                              aria-label={`${formatDate(day.date, true)}，不在统计窗口内`}
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
                            onClick={() => toggleDate(day.date)}
                            aria-label={`${formatDate(day.date, true)}，${selectedBrand} · ${getMarketLabel(selectedMarket)} ${count} 封邮件`}
                            aria-expanded={isSelected}
                            aria-controls={detailId}
                            title={`${formatDate(day.date, true)} · ${selectedBrand} · ${getMarketLabel(selectedMarket)} ${count} 封邮件`}
                            className={`group relative flex h-12 w-full flex-col items-start justify-center gap-0.5 rounded-md border border-black/[0.06] px-0.5 py-1 text-left transition duration-150 hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-calendar-heading)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-calendar)] sm:p-1 ${
                              usesWhiteText ? "text-white" : "text-[var(--text-calendar-heading)]"
                            } ${
                              isSelected ? "ring-2 ring-[var(--text-calendar-heading)] ring-offset-1 ring-offset-[var(--surface-calendar)]" : ""
                            }`}
                            style={{ backgroundColor: heatColor }}
                          >
                            <span className="text-xs font-semibold leading-4">
                              {dayNumber}
                            </span>
                            <span className="whitespace-nowrap text-xs font-bold leading-4">
                              {count} 封
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
            <div className="rounded-2xl border border-[var(--border-calendar-detail)] bg-[var(--surface-calendar-detail)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[var(--text-calendar-heading)]">
                  {formatDate(selectedDate, true)} · {selectedEmails.length} 封
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--text-calendar-secondary)] transition hover:bg-white/70 hover:text-[var(--text-calendar-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-calendar-focus)]"
                >
                  收起详情
                </button>
              </div>
              {selectedEmails.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedEmails.map((email, index) => (
                    <li
                      key={`${email.date}-${email.brand}-${email.theme}-${index}`}
                      className="rounded-xl border border-[var(--border-calendar-item)] bg-[var(--surface-calendar-item)] p-3 text-sm"
                    >
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                        <dt className="font-semibold text-[var(--text-calendar-muted)]">日期</dt>
                        <dd className="text-[var(--text-primary)]">{email.date}</dd>
                        <dt className="font-semibold text-[var(--text-calendar-muted)]">品牌</dt>
                        <dd className="font-semibold text-[var(--text-primary)]">{email.brand}</dd>
                        <dt className="font-semibold text-[var(--text-calendar-muted)]">市场</dt>
                        <dd className="text-[var(--text-primary)]">{getMarketLabel(getEmailMarket(email))}</dd>
                        <dt className="font-semibold text-[var(--text-calendar-muted)]">主题</dt>
                        <dd className="text-[var(--text-primary)]">{getThemeLabel(email.theme)}</dd>
                        <dt className="font-semibold text-[var(--text-calendar-muted)]">关键词</dt>
                        <dd className="break-words text-[var(--text-primary)]">
                          {email.keywords.length > 0 ? email.keywords.join("、") : "无关键词"}
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={`mt-[var(--card-padding)] ${EMPTY_STATE_CLASS_NAME}`}>
                  <EmptyState
                    title="当日无邮件"
                    description={`${formatDate(selectedDate, true)} · ${selectedBrand} · ${getMarketLabel(selectedMarket)}暂无邮件记录，请返回日历选择其他日期。`}
                    actionLabel="返回日历"
                    onAction={() => setSelectedDate(null)}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[var(--border-calendar)] pt-3">
          <label htmlFor={`${searchHelpId}-input`} className="text-base font-bold text-[var(--text-calendar-heading)]">
            关键词搜索
          </label>
          <p id={searchHelpId} className="mt-1 text-sm text-[var(--text-calendar-secondary)]">
            搜索范围跟随品牌与市场筛选；支持完整词或部分词，例如 dress、sale、new。
          </p>
          <input
            id={`${searchHelpId}-input`}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-describedby={searchHelpId}
            placeholder="输入关键词"
            className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border-calendar-input)] bg-[var(--surface-calendar-item)] px-3 py-2 text-base text-[var(--text-calendar-heading)] outline-none transition placeholder:text-[var(--text-calendar-muted)] focus:border-[var(--control-calendar-focus)] focus:ring-2 focus:ring-[var(--selection-bg)]"
          />

          {normalizedSearchTerm ? (
            <div className="mt-4" aria-live="polite" aria-atomic="true">
              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-[var(--text-calendar-label)]">
                    找到 {searchResults.length} 个日期与品牌与市场组合
                  </p>
                  <ul className="mt-2 divide-y divide-[var(--divider-calendar)] rounded-xl border border-[var(--border-calendar)] bg-[var(--surface-calendar-item)]">
                    {searchResults.map((result) => (
                      <li
                        key={`${result.date}-${result.brand}-${result.market}`}
                        className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_5rem_auto] sm:items-center sm:gap-3"
                      >
                        <time dateTime={result.date} className="font-medium text-[var(--text-calendar-secondary)]">
                          {result.date}
                        </time>
                        <span className="font-semibold text-[var(--text-calendar-heading)]">{result.brand}</span>
                        <span className="text-[var(--text-calendar-secondary)]">{getMarketLabel(result.market)}</span>
                        <span className="text-[var(--text-calendar-secondary)]">{result.count} 封</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className={EMPTY_STATE_CLASS_NAME}>
                  <EmptyState
                    title="无匹配"
                    description={`当前品牌与市场筛选内，没有包含关键词“${searchTerm.trim()}”的邮件。支持完整词或部分词，可清除关键词后重新搜索。`}
                    actionLabel="清除关键词"
                    onAction={() => setSearchTerm("")}
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
