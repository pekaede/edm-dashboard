import { DATA, type Word } from "../data";
import { Card } from "./Card";

type CategoryKey = "category" | "promotion" | "season" | "style";

interface WordCategory {
  key: CategoryKey;
  label: string;
  color: string;
}

const CATEGORIES: WordCategory[] = [
  { key: "category", label: "品类类", color: "#2563eb" },
  { key: "promotion", label: "促销类", color: "#be123c" },
  { key: "season", label: "季节场景类", color: "#047857" },
  { key: "style", label: "风格氛围类", color: "#b45309" },
];

const WORD_CATEGORY = {
  New: "style",
  Off: "promotion",
  "Up to": "promotion",
  Down: "promotion",
  Credit: "promotion",
  Deal: "promotion",
  Buy: "promotion",
  Required: "promotion",
  Fall: "season",
  Style: "style",
  Offer: "promotion",
  Sale: "promotion",
  Coupon: "promotion",
  Under: "promotion",
  Arrivals: "category",
  Back: "promotion",
  Price: "promotion",
  Drop: "category",
  Denim: "category",
  Good: "style",
  Less: "promotion",
} as const satisfies Record<string, CategoryKey>;

// 排除不能描述 EDM 内容的噪音：通用动词/功能词、商家邮件操作词，以及品牌名。
const NOISE_WORDS = new Set([
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
]);

const MAX_WORDS_PER_CATEGORY = 10;
const meaningfulWords = DATA.words.filter((word) => !NOISE_WORDS.has(word.text));
const maxCount = Math.max(...meaningfulWords.map((word) => word.count));
const minCount = Math.min(...meaningfulWords.map((word) => word.count));

function getCategory(word: Word): CategoryKey | undefined {
  return WORD_CATEGORY[word.text as keyof typeof WORD_CATEGORY];
}

function getWordSize(count: number): string {
  const range = Math.max(maxCount - minCount, 1);
  const scale = (count - minCount) / range;
  return `${0.95 + scale * 1.05}rem`;
}

export function WordCloud() {
  const groupedWords = CATEGORIES.map((category) => {
    const categoryWords = meaningfulWords
      .filter((word) => getCategory(word) === category.key)
      .sort((first, second) => second.count - first.count);

    return {
      ...category,
      words: categoryWords.slice(0, MAX_WORDS_PER_CATEGORY),
      total: categoryWords.length,
    };
  }).filter((category) => category.words.length > 0);

  return (
    <Card
      title="分类高频词 Top 10"
      hint="按品类、促销、季节场景与风格氛围分组；每类按含该词的邮件数倒序展示前 10 个，字号反映词频。"
    >
      <div className="divide-y divide-slate-200/80">
        {groupedWords.map((category) => {
          const headingId = `word-category-${category.key}`;

          return (
            <section
              key={category.key}
              aria-labelledby={headingId}
              className="min-w-0 py-5 first:pt-0 last:pb-0"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3
                  id={headingId}
                  className="flex items-center gap-2.5 text-sm font-bold tracking-wide text-slate-800"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.label}
                </h3>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {category.total > MAX_WORDS_PER_CATEGORY
                    ? `展示 ${category.words.length} / 共 ${category.total} 个词`
                    : `${category.words.length} 个词`}
                </span>
              </div>

              <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-3 sm:gap-x-6 sm:gap-y-4">
                {category.words.map((word) => (
                  <li key={word.text} className="min-w-0">
                    <span
                      aria-label={`${word.text}，出现 ${word.count} 次，${category.label}`}
                      className="inline-block max-w-full whitespace-nowrap font-semibold tracking-tight transition-opacity hover:opacity-70"
                      style={{
                        color: category.color,
                        fontSize: getWordSize(word.count),
                        lineHeight: 1.1,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="break-words"
                      >
                        {word.text}
                      </span>
                      <sup
                        aria-hidden="true"
                        className="ml-1 align-super font-mono text-[0.55em] font-bold tabular-nums opacity-65"
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
    </Card>
  );
}
