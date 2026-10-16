import { DATA, type Word } from "../data";
import { Card } from "./Card";

type CategoryKey =
  | "category"
  | "promotion"
  | "season"
  | "audience"
  | "style"
  | "other";

interface WordCategory {
  key: CategoryKey;
  label: string;
  color: string;
  tint: string;
}

const CATEGORIES: WordCategory[] = [
  { key: "category", label: "品类类", color: "#2563eb", tint: "#eff6ff" },
  { key: "promotion", label: "促销类", color: "#be123c", tint: "#fff1f2" },
  { key: "season", label: "季节场景类", color: "#047857", tint: "#ecfdf5" },
  { key: "audience", label: "人群类", color: "#7c3aed", tint: "#f5f3ff" },
  { key: "style", label: "风格氛围类", color: "#b45309", tint: "#fffbeb" },
  { key: "other", label: "其他", color: "#475569", tint: "#f8fafc" },
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
  Action: "other",
  Coupon: "promotion",
  Got: "other",
  Listing: "other",
  Please: "other",
  Start: "other",
  Under: "promotion",
  Arrivals: "category",
  Back: "promotion",
  Price: "promotion",
  Sent: "other",
  Drop: "category",
  Denim: "category",
  Good: "style",
  Less: "promotion",
  Little: "other",
  Thank: "other",
  Attention: "other",
  Zara: "other",
} as const satisfies Record<string, CategoryKey>;

const MAX_WORDS_PER_CATEGORY = 10;
const maxCount = Math.max(...DATA.words.map((word) => word.count));
const minCount = Math.min(...DATA.words.map((word) => word.count));

function getCategory(word: Word): CategoryKey {
  return WORD_CATEGORY[word.text as keyof typeof WORD_CATEGORY] ?? "other";
}

function getWordSize(count: number): string {
  const range = Math.max(maxCount - minCount, 1);
  const scale = (count - minCount) / range;
  return `${0.875 + scale * 0.875}rem`;
}

export function WordCloud() {
  const groupedWords = CATEGORIES.map((category) => ({
    ...category,
    words: DATA.words
      .filter((word) => getCategory(word) === category.key)
      .sort((first, second) => second.count - first.count)
      .slice(0, MAX_WORDS_PER_CATEGORY),
    total: DATA.words.filter((word) => getCategory(word) === category.key).length,
  }));

  return (
    <Card
      title="分类高频词 Top 10"
      hint="按品类、促销、季节场景、人群、风格氛围与其他分组；每类按含该词的邮件数倒序展示前 10 个，字号反映词频。"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groupedWords.map((category) => {
          const headingId = `word-category-${category.key}`;

          return (
            <section
              key={category.key}
              aria-labelledby={headingId}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                <h3
                  id={headingId}
                  className="flex items-center gap-2 text-sm font-bold text-slate-800"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.label}
                </h3>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {category.words.length}/{category.total}
                </span>
              </div>

              {category.words.length > 0 ? (
                <ul className="flex min-h-20 flex-wrap content-start items-center gap-2">
                  {category.words.map((word) => (
                    <li key={word.text}>
                      <span
                        aria-label={`${word.text}，出现 ${word.count} 次，${category.label}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold leading-none transition-transform hover:-translate-y-0.5"
                        style={{
                          backgroundColor: category.tint,
                          borderColor: `${category.color}55`,
                          color: category.color,
                          fontSize: getWordSize(word.count),
                        }}
                      >
                        <span className="truncate">{word.text}</span>
                        <span
                          aria-hidden="true"
                          className="rounded-full bg-white/80 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums shadow-xs"
                        >
                          {word.count}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex min-h-20 items-center justify-center text-sm text-slate-400">
                  暂无高频词
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
