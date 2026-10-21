import { useMemo, useState } from "react";
import type { EmailRecord } from "../email-data";
import { useLocale, type DictionaryKey } from "../i18n";
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
import { Tooltip } from "./Tooltip";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--control-active-bg)] [&_button]:text-[var(--control-active-text)] [&_button:hover]:bg-[var(--control-active-hover-bg)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

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

const WC_CATEGORY_KEYS: Record<string, DictionaryKey> = {
  category: "wcCatCategory",
  promotion: "wcCatPromotion",
  style: "wcCatStyle",
  audience: "wcCatAudience",
  other: "themeOther",
};

export function WordCloud() {
  const { t } = useLocale();
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
  const sampleTotal = isThreeWeeks ? threeWeekEmails.length : marketFilteredEmails.length;
  const catName = (key: string, fallback: string) => (WC_CATEGORY_KEYS[key] ? t(WC_CATEGORY_KEYS[key]) : fallback);
  const fillTokens = (key: DictionaryKey, count: number) => t(key, { market: marketLabel, count });
  const title = isThreeWeeks
    ? `${t("wcTitleBase")}${t("wcTitleWeeks")}${status === "ready" ? fillTokens("wcTitleSuffixWeeks", threeWeekEmails.length) : ""}`
    : `${t("wcTitleBase")}${t("wcTitleMonths")}${status === "ready" ? fillTokens("wcTitleSuffixMonths", marketFilteredEmails.length) : ""}`;
  const hint = isThreeWeeks
    ? t("wcHintWeeks", { range: THREE_WEEK_RANGE, market: marketLabel })
    : t("wcHintMonths", { range: meta.range, market: marketLabel });

  return (
    <Card title={title} hint={hint}>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-wordcloud)] bg-[var(--surface-raised)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-wordcloud)] bg-[var(--surface-page)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-sm font-bold text-[var(--text-control)]">{t("wcTimeRangeLabel")}</span>
          <div
            role="group"
            aria-label={t("wcRangeGroupAria")}
            className="grid w-full grid-cols-2 rounded-full border border-[var(--border-wordcloud-control)] bg-[var(--surface-raised)] p-1 sm:w-auto"
          >
            {([
              ["threeWeeks", t("wcRangeWeeks")],
              ["threeMonths", t("wcRangeMonths")],
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
                      ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
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
              title={t("wcEmptyMarketTitle")}
              description={t("wcEmptyMarketDesc", { market: marketLabel })}
              actionLabel={selectedMarket === null ? t("wcRetry") : t("wcSwitchAll")}
              onAction={selectedMarket === null ? retry : () => setMarket(null)}
            />
          </div>
        ) : groupedWords.length === 0 ? (
          <div className={`p-[var(--card-padding)] sm:p-[var(--card-padding-sm)] ${EMPTY_STATE_CLASS_NAME}`}>
            <EmptyState
              title={isThreeWeeks && threeWeekEmails.length === 0
                ? t("wcEmptyWeeksTitle")
                : t("wcEmptyNoWordsTitle")}
              description={isThreeWeeks && threeWeekEmails.length === 0
                ? t("wcEmptyWeeksDesc")
                : t("wcEmptyNoWordsDesc")}
              actionLabel={isThreeWeeks ? t("wcSwitchMonths") : selectedMarket === null ? t("wcRetry") : t("wcSwitchAll")}
              onAction={isThreeWeeks
                ? () => setTimeRange("threeMonths")
                : selectedMarket === null ? retry : () => setMarket(null)}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider-wordcloud)] px-4 sm:px-5" aria-live="polite" aria-atomic="true">
            <p className="py-3 text-xs leading-5 text-[var(--text-secondary)]">{t("wcNote")}</p>
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
                      {catName(category.key, category.label)}
                    </h3>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--text-caption)]">
                      {category.total > MAX_WORDS_PER_CATEGORY
                        ? t("wcShowing", { shown: category.words.length, total: category.total })
                        : t("wcWordCount", { n: category.words.length })}
                    </span>
                  </div>

                  <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-3 sm:gap-x-6 sm:gap-y-4">
                    {category.words.map((word) => (
                      <li key={word.text} className="min-w-0">
                        <Tooltip
                          label={t("wcWordLabel", { word: word.text, count: word.count, category: catName(category.key, category.label), pct: (word.count / sampleTotal * 100).toFixed(1) })}
                          content={<>
                            <div className="font-semibold">{word.text} · {catName(category.key, category.label)}</div>
                            <div className="mt-1 font-mono font-bold">{word.count} {t("marketUnitEmails", { count: word.count })} · {t("wcSampleShare")} {(word.count / sampleTotal * 100).toFixed(1)}%</div>
                            <div className="mt-1">{marketLabel} · {isThreeWeeks ? THREE_WEEK_RANGE : meta.range} · {t("wcDenominator")} {sampleTotal} {t("marketUnitEmails", { count: sampleTotal })}</div>
                          </>}
                          className="inline-block max-w-full break-words rounded px-1 py-1 font-semibold tracking-tight hover:bg-[var(--surface-wordcloud-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
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
                        </Tooltip>
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
