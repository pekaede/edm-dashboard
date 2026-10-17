import { useMemo, useState } from "react";
import type { EmailRecord } from "../email-data";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  MAX_WORDS_PER_CATEGORY,
  NOISE_WORDS,
  filterEmailsByWindow,
  type GroupedCategory,
  type Word,
  type WordCategory,
  type WordCategoryKey,
} from "../word-cloud-groups";
import { formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

type TimeRange = "threeWeeks" | "threeMonths";

// 3 周词云窗口（滑动 = 改 three-week-aggregation.ts 里的 THREE_WEEK_WINDOW）；实时聚合 emails 表，不读快照。
const THREE_WEEK_RANGE = formatWindowRange(THREE_WEEK_WINDOW);

const THREE_MONTH_CATEGORIES: WordCategory[] = [
  { key: "category", label: "品类类", color: "var(--word-category)" },
  { key: "promotion", label: "促销类", color: "var(--word-promotion)" },
  { key: "style", label: "风格上新类", color: "var(--word-style)" },
  { key: "audience", label: "人群类", color: "var(--word-audience)" },
  { key: "other", label: "其他", color: "var(--word-other)" },
];

const THREE_MONTH_CATEGORY_WORDS = new Set([
  "dress",
  "denim",
  "jacket",
  "pants",
  "top",
  "skirt",
  "shoes",
  "bag",
  "scarf",
  "swim",
  "capsule",
  "collection",
  "pre-owned",
  "studio",
  "origins",
]);
const THREE_MONTH_PROMOTION_WORDS = new Set(["sale"]);
const THREE_MONTH_STYLE_WORDS = new Set(["new", "arrivals", "drop"]);
const THREE_MONTH_AUDIENCE_WORDS = new Set(["kids", "man", "woman"]);

function getThreeMonthCategory(word: string): WordCategoryKey {
  if (THREE_MONTH_CATEGORY_WORDS.has(word)) return "category";
  if (THREE_MONTH_PROMOTION_WORDS.has(word)) return "promotion";
  if (THREE_MONTH_STYLE_WORDS.has(word)) return "style";
  if (THREE_MONTH_AUDIENCE_WORDS.has(word)) return "audience";
  return "other";
}

function formatWord(word: string): string {
  return word
    .split(/([ -])/)
    .map((part) => (/^[a-z]/.test(part) ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join("");
}

function buildThreeMonthWords(emails: EmailRecord[]): Word[] {
  const counts = new Map<string, number>();

  emails.forEach((email) => {
    const uniqueKeywords = new Set(email.keywords.map((keyword) => keyword.trim().toLowerCase()));

    uniqueKeywords.forEach((keyword) => {
      if (!keyword || NOISE_WORDS.has(keyword)) return;
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    });
  });

  return Array.from(counts, ([text, count]) => ({ text: formatWord(text), count }));
}

function groupWords(
  words: Word[],
  categories: WordCategory[],
  getCategory: (word: Word) => WordCategoryKey | undefined,
): GroupedCategory[] {
  return categories
    .map((category) => {
      const categoryWords = words
        .filter((word) => getCategory(word) === category.key)
        .sort((first, second) => second.count - first.count || first.text.localeCompare(second.text));

      return {
        ...category,
        words: categoryWords.slice(0, MAX_WORDS_PER_CATEGORY),
        total: categoryWords.length,
      };
    })
    .filter((category) => category.words.length > 0);
}

export function buildThreeMonthGroups(emails: EmailRecord[]): GroupedCategory[] {
  return groupWords(
    buildThreeMonthWords(emails),
    THREE_MONTH_CATEGORIES,
    (word) => getThreeMonthCategory(word.text.toLowerCase()),
  );
}

function getWordSize(count: number, words: Word[]): string {
  const counts = words.map((word) => word.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const range = Math.max(maxCount - minCount, 1);
  const scale = (count - minCount) / range;
  return `${0.95 + scale * 1.05}rem`;
}

export function WordCloud() {
  const emailData = useSiteEmails();
  const { emails, meta, status, retry } = emailData;
  const [timeRange, setTimeRange] = useState<TimeRange>("threeWeeks");
  const { market: selectedMarket, setMarket } = useSiteSelection();
  const isThreeWeeks = timeRange === "threeWeeks";
  const marketLabel = getMarketLabel(selectedMarket);
  const marketFilteredEmails = emails;
  const threeWeekEmails = useMemo(
    () => (status === "ready" ? filterEmailsByWindow(marketFilteredEmails) : []),
    [marketFilteredEmails, status],
  );
  // 3 周与三个月共享同一套 keywords 分组规则（见 buildThreeMonthGroups），3 周只多一道窗口过滤：
  // 旧静态版的标题词映射与 emails.keywords 词表几乎无重叠（仅 New/Sale/Denim/Arrivals 4 词），不可复用。
  const threeWeekGroups = useMemo(
    () => (isThreeWeeks && status === "ready" ? buildThreeMonthGroups(threeWeekEmails) : []),
    [threeWeekEmails, isThreeWeeks, status],
  );
  const threeMonthGroups = useMemo(
    () => !isThreeWeeks && status === "ready" ? buildThreeMonthGroups(marketFilteredEmails) : [],
    [marketFilteredEmails, isThreeWeeks, status],
  );
  const groupedWords = isThreeWeeks ? threeWeekGroups : threeMonthGroups;
  const displayedWords = groupedWords.flatMap((category) => category.words);
  const title = isThreeWeeks
    ? `分类高频词 Top 10 · 三周窗口${status === "ready" ? `（${marketLabel} · ${threeWeekEmails.length} 封 · 实时聚合）` : ""}`
    : `分类高频词 Top 10 · 三个月窗口${status === "ready" ? `（${marketLabel} · ${marketFilteredEmails.length} 封）` : ""}`;
  const hint = isThreeWeeks
    ? `${THREE_WEEK_RANGE}；市场：${marketLabel}；实时聚合窗口内邮件，与三个月词云同口径分组，逐封邮件内同词去重，每类按含该词的邮件数倒序展示前 10 个。`
    : `${meta.range}；市场：${marketLabel}；逐封邮件内同词去重，每类按含该词的邮件数倒序展示前 10 个。`;

  return (
    <Card title={title} hint={hint}>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-wordcloud)] bg-[var(--surface-raised)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-wordcloud)] bg-[var(--surface-page)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-sm font-bold text-[var(--text-control)]">时间范围</span>
          <div
            role="group"
            aria-label="选择词云统计时间范围"
            className="grid w-full grid-cols-2 rounded-full border border-[var(--border-wordcloud-control)] bg-[var(--surface-raised)] p-1 sm:w-auto"
          >
            {([
              ["threeWeeks", "三周"],
              ["threeMonths", "三个月"],
            ] as const).map(([value, label]) => {
              const isSelected = timeRange === value;

              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setTimeRange(value)}
                  className={`min-h-10 rounded-full px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-control)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                    isSelected
                      ? value === "threeWeeks"
                        ? "bg-[var(--text-control)] text-[var(--surface-raised)] shadow-sm"
                        : "bg-[var(--accent-wordcloud)] text-white shadow-sm"
                      : "text-[var(--text-label)] hover:bg-[var(--surface-wordcloud-hover)] hover:text-[var(--text-control)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {status !== "ready" ? (
          <div className="p-4 sm:p-5">
            <ExtendedEmailsState {...emailData} />
          </div>
        ) : marketFilteredEmails.length === 0 ? (
          <div className={`p-[var(--card-padding)] sm:p-[var(--card-padding-sm)] ${EMPTY_STATE_CLASS_NAME}`}>
            <EmptyState
              title="该市场暂无邮件"
              description={`${marketLabel}在统计窗口内暂无邮件，请切换市场或重新拉取数据。`}
              actionLabel={selectedMarket === null ? "重新拉取" : "切换至全部市场"}
              onAction={selectedMarket === null ? retry : () => setMarket(null)}
            />
          </div>
        ) : groupedWords.length === 0 ? (
          <div className={`p-[var(--card-padding)] sm:p-[var(--card-padding-sm)] ${EMPTY_STATE_CLASS_NAME}`}>
            <EmptyState
              title={isThreeWeeks && threeWeekEmails.length === 0
                ? "该市场在三周窗口内暂无邮件"
                : "无有效词"}
              description={isThreeWeeks && threeWeekEmails.length === 0
                ? "该市场在三周窗口内暂无邮件，请切换市场或时间范围。"
                : "该市场邮件的关键词均为空或为噪音词，无法生成词云。"}
              actionLabel={isThreeWeeks ? "切换至三个月" : selectedMarket === null ? "重新拉取" : "切换至全部市场"}
              onAction={isThreeWeeks
                ? () => setTimeRange("threeMonths")
                : selectedMarket === null ? retry : () => setMarket(null)}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider-wordcloud)] px-4 sm:px-5" aria-live="polite" aria-atomic="true">
            {groupedWords.map((category) => {
              const headingId = `word-category-${timeRange}-${category.key}`;

              return (
                <section
                  key={category.key}
                  aria-labelledby={headingId}
                  className="min-w-0 py-5 first:pt-5 last:pb-5"
                >
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3
                      id={headingId}
                      className="flex items-center gap-2.5 text-sm font-bold tracking-wide text-[var(--text-control)]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.label}
                    </h3>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--text-caption)]">
                      {category.total > MAX_WORDS_PER_CATEGORY
                        ? `展示 ${category.words.length} / 共 ${category.total} 个词`
                        : `${category.words.length} 个词`}
                    </span>
                  </div>

                  <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-3 sm:gap-x-6 sm:gap-y-4">
                    {category.words.map((word) => (
                      <li key={word.text} className="min-w-0">
                        <span
                          aria-label={`${word.text}，包含于 ${word.count} 封邮件，${category.label}`}
                          className="inline-block max-w-full whitespace-nowrap font-semibold tracking-tight transition-opacity hover:opacity-70"
                          style={{
                            color: "var(--text-calendar-heading)",
                            fontSize: getWordSize(word.count, displayedWords),
                            lineHeight: 1.1,
                          }}
                        >
                          <span aria-hidden="true" className="break-words">
                            {word.text}
                          </span>
                          <sup
                            aria-hidden="true"
                            className="ml-1 align-super font-mono text-[0.55em] font-bold tabular-nums"
                          >
                            {word.count}
                          </sup>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
