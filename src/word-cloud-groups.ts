import { THREE_WEEK_WINDOW } from "./three-week-aggregation";

export interface Word {
  text: string;
  count: number;
}

// "season" 已移除：没有任何分类/词映射返回它，是死联合成员。
export type WordCategoryKey = "category" | "promotion" | "style" | "audience" | "other";

export interface WordCategory {
  key: WordCategoryKey;
  label: string;
  color: string;
}

export interface GroupedCategory extends WordCategory {
  words: Word[];
  total: number;
}

// 排除不能描述 EDM 内容的噪音：功能/操作提示词、礼貌用语、泛化形容词，以及品牌名。
export const NOISE_WORDS = new Set(
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

export const MAX_WORDS_PER_CATEGORY = 10;

// 3 周词云窗口：单一事实来源是 three-week-aggregation.ts 的 THREE_WEEK_WINDOW，
// 此处不再重复定义起止常量（M2）。滑动窗口只改那一处。
// 窗口过滤输入：只需日期与关键词；EmailRecord 的 date 即 Supabase 的 sent_date。
export interface WindowEmail {
  date: string;
  keywords: string[];
}

// 按窗口过滤邮件；窗口起止为参数（默认 THREE_WEEK_WINDOW）。
// 日期为 YYYY-MM-DD 字符串，直接按字典序比较即为日期比较。
export function filterEmailsByWindow<T extends WindowEmail>(
  emails: T[],
  start: string = THREE_WEEK_WINDOW.start,
  end: string = THREE_WEEK_WINDOW.end,
): T[] {
  return emails.filter((email) => email.date >= start && email.date <= end);
}
