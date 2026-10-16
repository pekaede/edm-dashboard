import { useId, useMemo, useState } from "react";
import { EXTENDED_3MONTH } from "../data";

const WINDOW_START = "2026-07-16";
const WINDOW_END = "2026-10-15";
const ALL_BRANDS = "全部" as const;
const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

const THEME_LABELS: Record<string, string> = {
  price: "价格促销",
  behavior: "行为触发",
  new: "上新",
  lifestyle: "生活方式",
  category: "品类聚焦",
  other: "其他",
};

interface CalendarEmailRecord {
  date: string;
  theme: string;
  keywords: string[];
}

interface CalendarEmail extends CalendarEmailRecord {
  brand: string;
}

interface CalendarDay {
  date: string;
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

const BRANDS = EXTENDED_3MONTH.brands.map((brand) => brand.name);

const EMAILS: CalendarEmail[] = EXTENDED_3MONTH.brands.flatMap((brand) =>
  brand.emails.map((email) => ({
    brand: brand.name,
    date: email.date,
    theme: email.theme,
    keywords: [...email.keywords],
  })),
);

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

function createCalendarWeeks(): CalendarDay[][] {
  const start = parseDate(WINDOW_START);
  const end = parseDate(WINDOW_END);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  const gridStart = addDays(start, -daysSinceMonday);
  const daysUntilSunday = (7 - end.getUTCDay()) % 7;
  const gridEnd = addDays(end, daysUntilSunday);
  const weeks: CalendarDay[][] = [];

  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = addDays(weekStart, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = toDateString(addDays(weekStart, dayIndex));
        return {
          date,
          inWindow: date >= WINDOW_START && date <= WINDOW_END,
        };
      }),
    );
  }

  return weeks;
}

const CALENDAR_WEEKS = createCalendarWeeks();

function formatDate(date: string, includeYear = false): string {
  const parsed = parseDate(date);
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return includeYear ? `${parsed.getUTCFullYear()}年${month}月${day}日` : `${month}/${day}`;
}

function getCountClasses(count: number): string {
  if (count === 0) {
    return "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100";
  }
  if (count <= 2) {
    return "border-blue-200 bg-blue-100 text-blue-950 hover:bg-blue-200";
  }
  if (count <= 4) {
    return "border-blue-400 bg-blue-300 text-slate-950 hover:bg-blue-400";
  }
  return "border-blue-800 bg-blue-700 text-white hover:bg-blue-800";
}

function getThemeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

export function CalendarView({ className = "" }: CalendarViewProps) {
  const titleId = useId();
  const detailId = useId();
  const searchHelpId = useId();
  const [selectedBrand, setSelectedBrand] = useState<string>(ALL_BRANDS);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEmails = useMemo(
    () =>
      selectedBrand === ALL_BRANDS
        ? EMAILS
        : EMAILS.filter((email) => email.brand === selectedBrand),
    [selectedBrand],
  );

  const dailyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const email of filteredEmails) {
      counts.set(email.date, (counts.get(email.date) ?? 0) + 1);
    }
    return counts;
  }, [filteredEmails]);

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

  function selectBrand(brand: string) {
    setSelectedBrand(brand);
    setSelectedDate(null);
  }

  function toggleDate(date: string) {
    setSelectedDate((currentDate) => (currentDate === date ? null : date));
  }

  return (
    <section
      className={`dashboard-card ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
          日历热力图与关键词搜索
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          2026年7月16日至10月15日 · 6 个品牌 · 共 {EXTENDED_3MONTH.meta.total} 封邮件
        </p>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="按品牌筛选邮件">
          {[ALL_BRANDS, ...BRANDS].map((brand) => {
            const isSelected = selectedBrand === brand;
            return (
              <button
                type="button"
                key={brand}
                aria-pressed={isSelected}
                onClick={() => selectBrand(brand)}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  isSelected
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">每日发信量</h3>
            <p className="mt-1 text-sm text-slate-600" aria-live="polite">
              当前范围：{selectedBrand}，共 {filteredEmails.length} 封
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600" aria-label="热力图颜色图例">
            {[
              { label: "0 封", classes: "border-slate-200 bg-slate-50" },
              { label: "1–2 封", classes: "border-blue-200 bg-blue-100" },
              { label: "3–4 封", classes: "border-blue-400 bg-blue-300" },
              { label: "5+ 封", classes: "border-blue-800 bg-blue-700" },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span className={`size-3 rounded-sm border ${item.classes}`} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3"
          tabIndex={0}
          role="region"
          aria-label="按周排列的邮件日历，可横向滚动"
        >
          <table className="w-max min-w-full border-separate border-spacing-1.5 text-center">
            <thead>
              <tr>
                <th scope="col" className="w-12 px-1 text-left text-xs font-semibold text-slate-500">
                  星期
                </th>
                {CALENDAR_WEEKS.map((week) => (
                  <th
                    scope="col"
                    key={week[0].date}
                    className="min-w-12 px-1 text-xs font-semibold text-slate-500"
                    aria-label={`始于${formatDate(week[0].date, true)}的一周`}
                  >
                    {formatDate(week[0].date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((dayLabel, dayIndex) => (
                <tr key={dayLabel}>
                  <th scope="row" className="px-1 text-left text-xs font-semibold text-slate-500">
                    {dayLabel}
                  </th>
                  {CALENDAR_WEEKS.map((week) => {
                    const day = week[dayIndex];
                    if (!day.inWindow) {
                      return (
                        <td key={day.date} className="p-0.5" aria-hidden="true">
                          <span className="flex size-11 items-center justify-center rounded-md text-slate-300">—</span>
                        </td>
                      );
                    }

                    const count = dailyCounts.get(day.date) ?? 0;
                    const isSelected = selectedDate === day.date;
                    return (
                      <td key={day.date} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => toggleDate(day.date)}
                          aria-label={`${formatDate(day.date, true)}，${selectedBrand} ${count} 封邮件`}
                          aria-expanded={isSelected}
                          aria-controls={detailId}
                          className={`flex size-11 items-center justify-center rounded-md border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${getCountClasses(count)} ${
                            isSelected ? "ring-2 ring-amber-500 ring-offset-2" : ""
                          }`}
                        >
                          {count}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div id={detailId} className="mt-4" aria-live="polite">
          {selectedDate ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-950">
                  {formatDate(selectedDate, true)} · {selectedEmails.length} 封
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  收起详情
                </button>
              </div>
              {selectedEmails.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedEmails.map((email, index) => (
                    <li
                      key={`${email.date}-${email.brand}-${email.theme}-${index}`}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                    >
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                        <dt className="font-semibold text-slate-500">日期</dt>
                        <dd className="text-slate-900">{email.date}</dd>
                        <dt className="font-semibold text-slate-500">品牌</dt>
                        <dd className="font-semibold text-slate-900">{email.brand}</dd>
                        <dt className="font-semibold text-slate-500">主题</dt>
                        <dd className="text-slate-900">{getThemeLabel(email.theme)}</dd>
                        <dt className="font-semibold text-slate-500">关键词</dt>
                        <dd className="break-words text-slate-900">
                          {email.keywords.length > 0 ? email.keywords.join("、") : "无关键词"}
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">当日无邮件。</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-7 border-t border-slate-200 pt-6">
          <label htmlFor={`${searchHelpId}-input`} className="text-base font-bold text-slate-950">
            关键词搜索
          </label>
          <p id={searchHelpId} className="mt-1 text-sm text-slate-600">
            搜索范围跟随品牌筛选；支持完整词或部分词，例如 dress、sale、new。
          </p>
          <input
            id={`${searchHelpId}-input`}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-describedby={searchHelpId}
            placeholder="输入关键词"
            className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          />

          {normalizedSearchTerm ? (
            <div className="mt-4" aria-live="polite" aria-atomic="true">
              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-slate-700">
                    找到 {searchResults.length} 个日期与品牌组合
                  </p>
                  <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                    {searchResults.map((result) => (
                      <li
                        key={`${result.date}-${result.brand}`}
                        className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-3"
                      >
                        <time dateTime={result.date} className="font-medium text-slate-700">
                          {result.date}
                        </time>
                        <span className="font-semibold text-slate-950">{result.brand}</span>
                        <span className="text-slate-600">{result.count} 封</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
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
