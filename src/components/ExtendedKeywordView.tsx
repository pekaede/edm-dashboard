import { EXTENDED_3MONTH } from "../data";
import { Card } from "./Card";

type KeywordCategoryKey =
  | "product"
  | "promotion"
  | "newness"
  | "audience"
  | "other";

interface KeywordCategory {
  key: KeywordCategoryKey;
  label: string;
  color: string;
  tint: string;
}

interface KeywordFrequency {
  text: string;
  count: number;
}

const MAX_WORDS_PER_CATEGORY = 10;

const CATEGORIES: KeywordCategory[] = [
  { key: "product", label: "品类类", color: "#2563eb", tint: "#eff6ff" },
  { key: "promotion", label: "促销类", color: "#be123c", tint: "#fff1f2" },
  { key: "newness", label: "风格上新类", color: "#b45309", tint: "#fffbeb" },
  { key: "audience", label: "人群类", color: "#7c3aed", tint: "#f5f3ff" },
  { key: "other", label: "其他", color: "#475569", tint: "#f8fafc" },
];

const PRODUCT_KEYWORDS = new Set([
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

const AUDIENCE_KEYWORDS = new Set(["kids", "man", "woman"]);
const NEWNESS_KEYWORDS = new Set(["new", "arrivals"]);

function getCategory(keyword: string): KeywordCategoryKey {
  if (PRODUCT_KEYWORDS.has(keyword)) {
    return "product";
  }

  if (keyword === "sale") {
    return "promotion";
  }

  if (NEWNESS_KEYWORDS.has(keyword)) {
    return "newness";
  }

  if (AUDIENCE_KEYWORDS.has(keyword)) {
    return "audience";
  }

  return "other";
}

const KEYWORD_FREQUENCIES = (() => {
  const counts = new Map<string, number>();

  for (const brand of EXTENDED_3MONTH.brands) {
    for (const email of brand.emails) {
      const emailKeywords = new Set(
        email.keywords
          .map((keyword) => keyword.trim().toLocaleLowerCase())
          .filter(Boolean),
      );

      for (const keyword of emailKeywords) {
        counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts, ([text, count]) => ({ text, count })).sort(
    (first, second) =>
      second.count - first.count || first.text.localeCompare(second.text),
  );
})();

const GROUPED_KEYWORDS = CATEGORIES.map((category) => ({
  ...category,
  words: KEYWORD_FREQUENCIES.filter(
    (keyword) => getCategory(keyword.text) === category.key,
  ).slice(0, MAX_WORDS_PER_CATEGORY),
})).filter((category) => category.words.length > 0);

const displayedKeywords = GROUPED_KEYWORDS.flatMap((category) => category.words);
const maxCount = Math.max(...displayedKeywords.map((keyword) => keyword.count), 1);
const minCount = Math.min(...displayedKeywords.map((keyword) => keyword.count), 1);

function getWordSize(count: number): string {
  const minimum = Math.log(minCount + 1);
  const range = Math.max(Math.log(maxCount + 1) - minimum, 1);
  const scale = (Math.log(count + 1) - minimum) / range;

  return `${0.875 + scale * 1.125}rem`;
}

function KeywordItem({
  keyword,
  category,
}: {
  keyword: KeywordFrequency;
  category: KeywordCategory;
}) {
  return (
    <li>
      <span
        aria-label={`${keyword.text}，${category.label}，出现在 ${keyword.count} 封邮件中`}
        className="inline-flex max-w-full items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold leading-none transition-transform motion-safe:hover:-translate-y-0.5"
        style={{
          backgroundColor: category.tint,
          borderColor: `${category.color}55`,
          color: category.color,
          fontSize: getWordSize(keyword.count),
        }}
      >
        <span className="break-words">{keyword.text}</span>
        <span
          aria-hidden="true"
          className="shrink-0 font-mono text-[0.6875rem] font-bold tabular-nums opacity-75"
        >
          {keyword.count}
        </span>
      </span>
    </li>
  );
}

export function ExtendedKeywordView() {
  return (
    <Card
      title="3 个月关键词"
      hint={`${EXTENDED_3MONTH.meta.range} · ${EXTENDED_3MONTH.meta.total} 封消费者邮件 · 每封邮件含同一关键词仅计 1 次`}
    >
      <div className="divide-y divide-slate-200">
        {GROUPED_KEYWORDS.map((category, index) => {
          const headingId = `extended-keyword-category-${category.key}`;

          return (
            <section
              key={category.key}
              aria-labelledby={headingId}
              className={index === 0 ? "pb-5" : "py-5 last:pb-0"}
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3
                  id={headingId}
                  className="flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.label}
                </h3>
                <span className="text-xs tabular-nums text-slate-500">
                  Top {category.words.length}
                </span>
              </div>

              <ul
                className="flex flex-wrap items-center gap-x-2.5 gap-y-2"
                aria-label={`${category.label}关键词，按邮件数从高到低排列`}
              >
                {category.words.map((keyword) => (
                  <KeywordItem
                    key={keyword.text}
                    keyword={keyword}
                    category={category}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
