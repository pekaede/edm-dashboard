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
import { useExtendedEmails } from "../email-data";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

const WINDOW_START = CALENDAR_START_DATE;
const WINDOW_END = CALENDAR_END_DATE;
const ALL_BRANDS = "全部" as const;
const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const EMPTY_DAY_COLOR = "#f2eadf";
const HEAT_COLORS = ["#f8ddb2", "#f3bc7c", "#e99061", "#b65343", "#7d342f"] as const;
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
  const emailData = useExtendedEmails();
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
    () => built ? validateCalendarData(emails, built) : null,
    [built, emails],
  );

  const calendarWeeks = useMemo(() => createMonthWeeks(selectedMonth), [selectedMonth]);
  const activeMonth = MONTHS.find((month) => month.key === selectedMonth) ?? MONTHS[1];

  const filteredEmails = useMemo(
    () =>
      selectedBrand === ALL_BRANDS
        ? emails
        : emails.filter((email) => email.brand === selectedBrand),
    [emails, selectedBrand],
  );

  const dailyCounts = useMemo(
    () => (selectedBrand === ALL_BRANDS ? built?.dailyTotals : built?.dailyCountsByBrand[selectedBrand]) ?? {},
    [built, selectedBrand],
  );

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

      const key = `${email.date}\u0000${email.brand}`;
      const current = matches.get(key);
      if (current) {
        current.count += 1;
      } else {
        matches.set(key, { date: email.date, brand: email.brand, count: 1 });
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
        className={`dashboard-card mx-auto w-full max-w-3xl p-3! sm:p-4! ${className}`.trim()}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-[#1c1917] sm:text-xl">
          日历热力图与关键词搜索
        </h2>
        <p className="mb-4 mt-1 text-sm text-[#6f655e]">{meta.range} · {meta.market}</p>
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
      className={`dashboard-card mx-auto w-full max-w-3xl p-3! sm:p-4! ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-[#1c1917] sm:text-xl">
          日历热力图与关键词搜索
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#6f655e]">
          2026年7月16日至10月15日 · 6 个品牌 · 共 {total} 封邮件
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
                className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5674e] focus-visible:ring-offset-2 ${
                  isSelected
                    ? "border-[#1c1917] bg-[#1c1917] text-[#fffaf1]"
                    : "border-[#dfd2c2] bg-[#fffaf1] text-[#514943] hover:border-[#d98262] hover:bg-[#fff3e4] hover:text-[#1c1917]"
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-1 rounded-xl border border-[#e7dccd] bg-[#f7eee2] p-1"
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
                className={`min-h-11 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5674e] focus-visible:ring-offset-1 focus-visible:ring-offset-[#f7eee2] ${
                  isSelected
                    ? "bg-[#1c1917] text-[#fffaf1] shadow-sm"
                    : "text-[#6f655e] hover:bg-[#fffaf1] hover:text-[#1c1917]"
                }`}
              >
                {month.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1c1917]">{activeMonth.fullLabel}每日发信量</h3>
            <p className="mt-0.5 text-sm text-[#6f655e]" aria-live="polite">
              当前范围：{selectedBrand}，共 {filteredEmails.length} 封
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5 text-xs text-[#6f655e]"
            aria-label={`热力图颜色图例，无邮件为米白，有邮件时从每日 ${heatRange.minimum} 封到 ${heatRange.maximum} 封由浅至深`}
          >
            <span>少</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="size-3 rounded-[3px] border border-[#e4d8c9]" style={{ backgroundColor: EMPTY_DAY_COLOR }} />
              {HEAT_COLORS.map((color) => (
                <span
                  key={color}
                  className="size-3 rounded-[3px] border border-black/5"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span>多</span>
            <span className="ml-1 text-[#7f7167]">
              全窗口非零范围 {heatRange.minimum}–{heatRange.maximum} 封
            </span>
          </div>
        </div>

        <div
          id={monthPanelId}
          role="tabpanel"
          aria-labelledby={`${monthPanelId}-${selectedMonth}-tab`}
          className="mt-2 rounded-xl border border-[#e7dccd] bg-[#fffaf1] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-2"
        >
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
                    className="h-5 text-[11px] font-semibold text-[#7f7167]"
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
                            className="h-12 rounded-md border border-[#eee5da] bg-[#f7f1e9] p-1 text-left text-[11px] font-medium leading-4 text-[#776b63]"
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
                          aria-label={`${formatDate(day.date, true)}，${selectedBrand} ${count} 封邮件`}
                          aria-expanded={isSelected}
                          aria-controls={detailId}
                          title={`${formatDate(day.date, true)} · ${count} 封邮件`}
                          className={`group relative flex h-12 w-full flex-col items-start justify-center gap-0.5 rounded-md border border-black/[0.06] px-0.5 py-1 text-left transition duration-150 hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] focus-visible:ring-offset-1 focus-visible:ring-offset-[#fffaf1] sm:p-1 ${
                            usesWhiteText ? "text-white" : "text-[#1c1917]"
                          } ${
                            isSelected ? "ring-2 ring-[#1c1917] ring-offset-1 ring-offset-[#fffaf1]" : ""
                          }`}
                          style={{ backgroundColor: heatColor }}
                        >
                          <span className="text-[11px] font-semibold leading-4">
                            {dayNumber}
                          </span>
                          <span className="whitespace-nowrap text-[11px] font-bold leading-4">
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
        </div>

        <div id={detailId} className={selectedDate ? "mt-3" : ""} aria-live="polite">
          {selectedDate ? (
            <div className="rounded-2xl border border-[#e3d4c2] bg-[#fff6e9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[#1c1917]">
                  {formatDate(selectedDate, true)} · {selectedEmails.length} 封
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[#6f655e] transition hover:bg-white/70 hover:text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5674e]"
                >
                  收起详情
                </button>
              </div>
              {selectedEmails.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedEmails.map((email, index) => (
                    <li
                      key={`${email.date}-${email.brand}-${email.theme}-${index}`}
                      className="rounded-xl border border-[#eadfd1] bg-[#fffdf8] p-3 text-sm"
                    >
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                        <dt className="font-semibold text-[#7f7167]">日期</dt>
                        <dd className="text-[#29231f]">{email.date}</dd>
                        <dt className="font-semibold text-[#7f7167]">品牌</dt>
                        <dd className="font-semibold text-[#29231f]">{email.brand}</dd>
                        <dt className="font-semibold text-[#7f7167]">主题</dt>
                        <dd className="text-[#29231f]">{getThemeLabel(email.theme)}</dd>
                        <dt className="font-semibold text-[#7f7167]">关键词</dt>
                        <dd className="break-words text-[#29231f]">
                          {email.keywords.length > 0 ? email.keywords.join("、") : "无关键词"}
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#6f655e]">当日无邮件。</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[#e7dccd] pt-3">
          <label htmlFor={`${searchHelpId}-input`} className="text-base font-bold text-[#1c1917]">
            关键词搜索
          </label>
          <p id={searchHelpId} className="mt-1 text-sm text-[#6f655e]">
            搜索范围跟随品牌筛选；支持完整词或部分词，例如 dress、sale、new。
          </p>
          <input
            id={`${searchHelpId}-input`}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-describedby={searchHelpId}
            placeholder="输入关键词"
            className="mt-2 min-h-11 w-full rounded-xl border border-[#d9cbbb] bg-[#fffdf8] px-3 py-2 text-base text-[#1c1917] outline-none transition placeholder:text-[#7f7167] focus:border-[#d5674e] focus:ring-2 focus:ring-[#f3c5b5]"
          />

          {normalizedSearchTerm ? (
            <div className="mt-4" aria-live="polite" aria-atomic="true">
              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-[#514943]">
                    找到 {searchResults.length} 个日期与品牌组合
                  </p>
                  <ul className="mt-2 divide-y divide-[#eee3d6] rounded-xl border border-[#e7dccd] bg-[#fffdf8]">
                    {searchResults.map((result) => (
                      <li
                        key={`${result.date}-${result.brand}`}
                        className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-3"
                      >
                        <time dateTime={result.date} className="font-medium text-[#6f655e]">
                          {result.date}
                        </time>
                        <span className="font-semibold text-[#1c1917]">{result.brand}</span>
                        <span className="text-[#6f655e]">{result.count} 封</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-[#d9cbbb] bg-[#fff6e9] px-4 py-5 text-sm text-[#6f655e]">
                  无匹配
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
