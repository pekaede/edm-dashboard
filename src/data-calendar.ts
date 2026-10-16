/**
 * 品牌营销触达趋势看板 - 90天日历视图数据层
 *
 * 数据源：data-collection/ 下 3 个品牌的 Milled 逐封衍生数据（JSON）
 * 覆盖窗口：2026-07-16 至 2026-10-15（共 92 天）
 * 包含品牌：Zara（43 封）、lululemon（59 封）、ALO Yoga（113 封），共 215 封邮件。
 *
 * 注：仅提供数据模型与导出接口，不含 UI 组件。
 */

import zaraRaw from "../data-collection/zara-2026-07-16-to-2026-10-15.json";
import luluRaw from "../data-collection/lululemon-2026-07-16-to-2026-10-15.json";
import aloRaw from "../data-collection/aloyoga-2026-07-16-to-2026-10-15.json";

// ==========================================
// 类型定义
// ==========================================

export type BrandKey = "Zara" | "lululemon" | "ALO Yoga";

export type CalendarThemeKey =
  | "price"
  | "behavior"
  | "new"
  | "lifestyle"
  | "category"
  | "other";

export const CALENDAR_THEMES: readonly CalendarThemeKey[] = [
  "new",
  "lifestyle",
  "category",
  "behavior",
  "price",
  "other",
] as const;

export const CALENDAR_KEYWORDS: readonly string[] = [
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
  "kids",
  "man",
  "woman",
  "new",
  "sale",
  "capsule",
  "collection",
  "pre-owned",
  "studio",
  "origins",
  "arrivals",
] as const;

export interface CalendarEmail {
  date: string; // YYYY-MM-DD
  theme: CalendarThemeKey;
  keywords: string[];
  url?: string;
}

export interface BrandCalendarData {
  brand: BrandKey;
  source: string;
  market: string;
  note: string;
  brandPage?: string;
  window: {
    start: string;
    end: string;
    days: number;
  };
  totalEmails: number;
  /** 每品牌每日封数（date → count，覆盖整个窗口 2026-07-16 ~ 2026-10-15，共 92 天） */
  dailyCounts: Record<string, number>;
  /** 关键词索引（keyword → 该关键词出现的去重日期列表，按升序排列） */
  keywordIndex: Record<string, string[]>;
  /** 关键词每封出现频次（keyword → 命中该关键词的邮件总数） */
  keywordOccurrences: Record<string, number>;
  /** 主题汇总（theme → 邮件总数） */
  themeSummary: Record<CalendarThemeKey, number>;
  /** 原始邮件记录列表 */
  emails: CalendarEmail[];
}

export interface CalendarDatasetMeta {
  windowStart: string;
  windowEnd: string;
  totalDays: number;
  brands: BrandKey[];
  allDates: string[];
  keywordSet: string[];
  allThemes: CalendarThemeKey[];
  totalEmails: number;
}

export interface OverlapComparisonItem {
  brand: BrandKey;
  overlapWindow: string;
  jsonCount: number;
  dataTsCount: number;
  diff: number;
  note: string;
}

// ==========================================
// 日期序列工具（生成 2026-07-16 至 2026-10-15 全部 92 天）
// ==========================================

export const CALENDAR_START_DATE = "2026-07-16";
export const CALENDAR_END_DATE = "2026-10-15";

function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export const CALENDAR_DATES: readonly string[] = Object.freeze(
  generateDateRange(CALENDAR_START_DATE, CALENDAR_END_DATE)
);
export const CALENDAR_TOTAL_DAYS = CALENDAR_DATES.length; // 92 天

// ==========================================
// 数据转换与索引构建
// ==========================================

interface RawEmailItem {
  date: string;
  theme: string;
  keywords: string[];
  url?: string;
}

interface RawBrandJson {
  brand: string;
  source: string;
  market: string;
  note: string;
  window: string;
  brandPage?: string;
  keywordSet: string[];
  emails: RawEmailItem[];
}

function processBrand(raw: RawBrandJson, brandName: BrandKey): BrandCalendarData {
  const emails: CalendarEmail[] = raw.emails.map((e) => ({
    date: e.date,
    theme: e.theme as CalendarThemeKey,
    keywords: [...e.keywords],
    url: e.url,
  }));

  // 1. 每品牌每日封数（date → count，覆盖整个 92 天窗口，未发信日期置 0）
  const dailyCounts: Record<string, number> = {};
  for (const date of CALENDAR_DATES) {
    dailyCounts[date] = 0;
  }
  for (const email of emails) {
    dailyCounts[email.date] = (dailyCounts[email.date] || 0) + 1;
  }

  // 2. 关键词索引（keyword → 该关键词出现的日期列表，升序排列）
  const keywordDatesMap: Record<string, Set<string>> = {};
  const keywordOccurrences: Record<string, number> = {};

  for (const kw of CALENDAR_KEYWORDS) {
    keywordDatesMap[kw] = new Set<string>();
    keywordOccurrences[kw] = 0;
  }

  for (const email of emails) {
    for (const kw of email.keywords) {
      if (!keywordDatesMap[kw]) {
        keywordDatesMap[kw] = new Set<string>();
        keywordOccurrences[kw] = 0;
      }
      keywordDatesMap[kw].add(email.date);
      keywordOccurrences[kw] += 1;
    }
  }

  const keywordIndex: Record<string, string[]> = {};
  for (const kw of CALENDAR_KEYWORDS) {
    keywordIndex[kw] = Array.from(keywordDatesMap[kw] || []).sort();
  }

  // 3. 主题汇总
  const themeSummary: Record<CalendarThemeKey, number> = {
    new: 0,
    lifestyle: 0,
    category: 0,
    behavior: 0,
    price: 0,
    other: 0,
  };
  for (const email of emails) {
    if (themeSummary[email.theme] !== undefined) {
      themeSummary[email.theme] += 1;
    } else {
      themeSummary[email.theme] = 1;
    }
  }

  return {
    brand: brandName,
    source: raw.source,
    market: raw.market,
    note: raw.note,
    brandPage: raw.brandPage,
    window: {
      start: CALENDAR_START_DATE,
      end: CALENDAR_END_DATE,
      days: CALENDAR_TOTAL_DAYS,
    },
    totalEmails: emails.length,
    dailyCounts,
    keywordIndex,
    keywordOccurrences,
    themeSummary,
    emails,
  };
}

// 实例化 3 个品牌数据
export const ZARA_CALENDAR: BrandCalendarData = processBrand(zaraRaw as RawBrandJson, "Zara");
export const LULULEMON_CALENDAR: BrandCalendarData = processBrand(luluRaw as RawBrandJson, "lululemon");
export const ALO_CALENDAR: BrandCalendarData = processBrand(aloRaw as RawBrandJson, "ALO Yoga");

export const BRANDS_CALENDAR: Record<BrandKey, BrandCalendarData> = {
  Zara: ZARA_CALENDAR,
  lululemon: LULULEMON_CALENDAR,
  "ALO Yoga": ALO_CALENDAR,
};

// ==========================================
// 聚合数据汇总
// ==========================================

// 每日 3 品牌合计发信数
export const DAILY_TOTALS: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const date of CALENDAR_DATES) {
    totals[date] =
      ZARA_CALENDAR.dailyCounts[date] +
      LULULEMON_CALENDAR.dailyCounts[date] +
      ALO_CALENDAR.dailyCounts[date];
  }
  return totals;
})();

// 全品牌主题总汇总
export const OVERALL_THEME_SUMMARY: Record<CalendarThemeKey, number> = (() => {
  const summary: Record<CalendarThemeKey, number> = {
    new: 0,
    lifestyle: 0,
    category: 0,
    behavior: 0,
    price: 0,
    other: 0,
  };
  for (const brand of Object.values(BRANDS_CALENDAR)) {
    for (const theme of CALENDAR_THEMES) {
      summary[theme] += brand.themeSummary[theme] || 0;
    }
  }
  return summary;
})();

// 分品牌每日封数映射表（便捷查询）
export const DAILY_COUNTS_BY_BRAND: Record<BrandKey, Record<string, number>> = {
  Zara: ZARA_CALENDAR.dailyCounts,
  lululemon: LULULEMON_CALENDAR.dailyCounts,
  "ALO Yoga": ALO_CALENDAR.dailyCounts,
};

// 分品牌关键词索引映射表（便捷查询）
export const KEYWORD_INDEX_BY_BRAND: Record<BrandKey, Record<string, string[]>> = {
  Zara: ZARA_CALENDAR.keywordIndex,
  lululemon: LULULEMON_CALENDAR.keywordIndex,
  "ALO Yoga": ALO_CALENDAR.keywordIndex,
};

// 分品牌主题汇总映射表（便捷查询）
export const THEME_SUMMARY_BY_BRAND: Record<BrandKey, Record<CalendarThemeKey, number>> = {
  Zara: ZARA_CALENDAR.themeSummary,
  lululemon: LULULEMON_CALENDAR.themeSummary,
  "ALO Yoga": ALO_CALENDAR.themeSummary,
};

// 元信息
export const CALENDAR_META: CalendarDatasetMeta = {
  windowStart: CALENDAR_START_DATE,
  windowEnd: CALENDAR_END_DATE,
  totalDays: CALENDAR_TOTAL_DAYS,
  brands: ["Zara", "lululemon", "ALO Yoga"],
  allDates: [...CALENDAR_DATES],
  keywordSet: [...CALENDAR_KEYWORDS],
  allThemes: [...CALENDAR_THEMES],
  totalEmails:
    ZARA_CALENDAR.totalEmails +
    LULULEMON_CALENDAR.totalEmails +
    ALO_CALENDAR.totalEmails,
};

// 重叠窗口对账记录（2026-09-24 至 2026-10-15）
export const OVERLAP_AUDIT_DATA: OverlapComparisonItem[] = [
  {
    brand: "Zara",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 8,
    dataTsCount: 7,
    diff: 1,
    note: "2026-10-15 多出 1 封 (zara-pre-owned)，因 data.ts 收录时该邮件尚未抓取或未更新",
  },
  {
    brand: "ALO Yoga",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 28,
    dataTsCount: 27,
    diff: 1,
    note: "2026-10-15 多出 1 封 (lifestyle)，与 Zara 相同模式",
  },
  {
    brand: "lululemon",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 13,
    dataTsCount: 13,
    diff: 0,
    note: "完全一致（W1: 4, W2: 3, W3: 6）",
  },
];

// 综合导出对象
export const CALENDAR_DATA = {
  meta: CALENDAR_META,
  brands: BRANDS_CALENDAR,
  dailyTotals: DAILY_TOTALS,
  themeSummary: OVERALL_THEME_SUMMARY,
  keywordIndexByBrand: KEYWORD_INDEX_BY_BRAND,
  dailyCountsByBrand: DAILY_COUNTS_BY_BRAND,
  themeSummaryByBrand: THEME_SUMMARY_BY_BRAND,
  overlapAudit: OVERLAP_AUDIT_DATA,
};

// ==========================================
// 便捷查询辅助函数
// ==========================================

/** 获取指定品牌指定日期的发信数 */
export function getDailyCount(brand: BrandKey, date: string): number {
  return BRANDS_CALENDAR[brand]?.dailyCounts[date] ?? 0;
}

/** 获取指定品牌命中某关键词的日期列表 */
export function getKeywordDates(brand: BrandKey, keyword: string): string[] {
  return BRANDS_CALENDAR[brand]?.keywordIndex[keyword] ?? [];
}

/** 获取指定品牌指定主题的邮件数 */
export function getThemeCount(brand: BrandKey, theme: CalendarThemeKey): number {
  return BRANDS_CALENDAR[brand]?.themeSummary[theme] ?? 0;
}

/** 获取指定品牌在某一天的全部邮件详情 */
export function getEmailsForDate(brand: BrandKey, date: string): CalendarEmail[] {
  return BRANDS_CALENDAR[brand]?.emails.filter((e) => e.date === date) ?? [];
}
