import { useMemo, useState } from "react";
import { DATA, type Word } from "../data";
import { useExtendedEmails, type EmailRecord } from "../email-data";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

type TimeRange = "threeWeeks" | "threeMonths";
type CategoryKey = "category" | "promotion" | "season" | "style" | "audience" | "other";

interface WordCategory {
  key: CategoryKey;
  label: string;
  color: string;
}

interface GroupedCategory extends WordCategory {
  words: Word[];
  total: number;
}

const THREE_WEEK_CATEGORIES: WordCategory[] = [
  { key: "category", label: "品类类", color: "#d95d45" },
  { key: "promotion", label: "促销类", color: "#c77b18" },
  { key: "season", label: "季节场景类", color: "#e28a57" },
  { key: "style", label: "风格氛围类", color: "#c9573f" },
];

const THREE_MONTH_CATEGORIES: WordCategory[] = [
  { key: "category", label: "品类类", color: "#d95d45" },
  { key: "promotion", label: "促销类", color: "#c77b18" },
  { key: "style", label: "风格上新类", color: "#e28a57" },
  { key: "audience", label: "人群类", color: "#c9573f" },
  { key: "other", label: "其他", color: "#b87912" },
];

const THREE_WEEK_WORD_CATEGORY = {
  New: "style",
  Off: "promotion",
  Down: "promotion",
  Credit: "promotion",
  Deal: "promotion",
  Buy: "promotion",
  Fall: "season",
  Style: "style",
  Offer: "promotion",
  Sale: "promotion",
  Coupon: "promotion",
  Under: "promotion",
  Arrivals: "style",
  Back: "promotion",
  Price: "promotion",
  Drop: "style",
  Denim: "category",
  Less: "promotion",
} as const satisfies Record<string, CategoryKey>;

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

// 排除不能描述 EDM 内容的噪音：功能/操作提示词、礼貌用语、泛化形容词，以及品牌名。
const NOISE_WORDS = new Set(
  [
    "Up to",
    "Required",
    "Good",
    "Action",
    "Got",
    "Please",
    "Start",
    "Sent",
    "Little",
    "Thank",
    "Attention",
    "Listing",
    "Zara",
  ].map((word) => word.toLowerCase()),
);

const MAX_WORDS_PER_CATEGORY = 10;

const THREE_WEEK_WORDS = DATA.words.filter(
  (word) => !NOISE_WORDS.has(word.text.toLowerCase()),
);

function getThreeWeekCategory(word: Word): CategoryKey | undefined {
  return THREE_WEEK_WORD_CATEGORY[word.text as keyof typeof THREE_WEEK_WORD_CATEGORY];
}

function getThreeMonthCategory(word: string): CategoryKey {
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
  getCategory: (word: Word) => CategoryKey | undefined,
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

const THREE_WEEK_GROUPS = groupWords(
  THREE_WEEK_WORDS,
  THREE_WEEK_CATEGORIES,
  getThreeWeekCategory,
);

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
  const emailData = useExtendedEmails();
  const { emails, meta, status, total } = emailData;
  const [timeRange, setTimeRange] = useState<TimeRange>("threeWeeks");
  const isThreeWeeks = timeRange === "threeWeeks";
  const threeMonthGroups = useMemo(
    () => !isThreeWeeks && status === "ready" ? buildThreeMonthGroups(emails) : [],
    [emails, isThreeWeeks, status],
  );
  const groupedWords = isThreeWeeks ? THREE_WEEK_GROUPS : threeMonthGroups;
  const displayedWords = groupedWords.flatMap((category) => category.words);
  const title = isThreeWeeks
    ? `分类高频词 Top 10 · 三周窗口（${DATA.meta.total} 封）`
    : `分类高频词 Top 10 · 三个月窗口${status === "ready" ? `（${total} 封）` : ""}`;
  const hint = isThreeWeeks
    ? `${DATA.meta.range}；沿用现有分类，每类按含该词的邮件数倒序展示前 10 个。`
    : `${meta.range}；逐封邮件内同词去重，每类按含该词的邮件数倒序展示前 10 个。`;

  return (
    <Card title={title} hint={hint}>
      <div className="overflow-hidden rounded-2xl border border-[#ded2c3] bg-[#fffaf3]">
        <div className="flex flex-col gap-3 border-b border-[#ded2c3] bg-[#f7f1e8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-sm font-bold text-[#292521]">时间范围</span>
          <div
            role="group"
            aria-label="选择词云统计时间范围"
            className="grid w-full grid-cols-2 rounded-full border border-[#cfc1b1] bg-[#fffaf3] p-1 sm:w-auto"
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
                  className={`min-h-10 rounded-full px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292521] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f1e8] ${
                    isSelected
                      ? value === "threeWeeks"
                        ? "bg-[#292521] text-[#fffaf3] shadow-sm"
                        : "bg-[#b94330] text-white shadow-sm"
                      : "text-[#6f665c] hover:bg-[#f1e5d8] hover:text-[#292521]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {!isThreeWeeks && status !== "ready" ? (
          <div className="p-4 sm:p-5">
            <ExtendedEmailsState {...emailData} />
          </div>
        ) : (
          <div className="divide-y divide-[#e2d7ca] px-4 sm:px-5" aria-live="polite" aria-atomic="true">
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
                      className="flex items-center gap-2.5 text-sm font-bold tracking-wide text-[#292521]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.label}
                    </h3>
                    <span className="shrink-0 text-xs tabular-nums text-[#746a60]">
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
                            color: "#1c1917",
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
