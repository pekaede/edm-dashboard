/**
 * 品牌营销触达趋势看板 - 90天日历视图数据层
 *
 * 数据源：data-collection/ 下 6 个品牌的 Milled 逐封衍生数据（JSON）与 src/data.ts EXTENDED_3MONTH
 * 覆盖窗口：2026-07-16 至 2026-10-15（共 92 天）
 * 包含品牌（共 6 品牌，770 封消费者邮件）：
 *   - Zara（43 封）
 *   - lululemon（59 封）
 *   - ALO Yoga（113 封）
 *   - Halara（191 封）
 *   - Temu（85 封消费者邮件，已排除 8 封商家侧 listing 邮件）
 *   - SHEIN（279 封）
 *
 * 注：仅提供数据模型与导出接口，不含 UI 组件。
 */

import aloRaw from "../data-collection/aloyoga-2026-07-16-to-2026-10-15.json";
import halaraRaw from "../data-collection/halara-2026-07-16-to-2026-10-15.json";
import luluRaw from "../data-collection/lululemon-2026-07-16-to-2026-10-15.json";
import sheinRaw from "../data-collection/shein-2026-07-16-to-2026-10-15.json";
import temuRaw from "../data-collection/temu-2026-07-16-to-2026-10-15.json";
import zaraRaw from "../data-collection/zara-2026-07-16-to-2026-10-15.json";
import { EXTENDED_3MONTH } from "./data";

// ==========================================
// 类型定义
// ==========================================

export type BrandKey =
  | "Zara"
  | "lululemon"
  | "ALO Yoga"
  | "Halara"
  | "Temu"
  | "SHEIN";

export const CALENDAR_BRANDS: readonly BrandKey[] = [
  "Zara",
  "lululemon",
  "ALO Yoga",
  "Halara",
  "Temu",
  "SHEIN",
] as const;

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

interface RawBrandMeta {
  source?: string;
  market?: string;
  note?: string;
  brandPage?: string;
}

function processBrand(
  brandName: BrandKey,
  rawMeta: RawBrandMeta,
  emailsInput: { date: string; theme: string; keywords: string[]; url?: string }[]
): BrandCalendarData {
  const emails: CalendarEmail[] = emailsInput.map((e) => ({
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
    source: rawMeta.source ?? "Milled",
    market: rawMeta.market ?? "US",
    note: rawMeta.note ?? "",
    brandPage: rawMeta.brandPage,
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

// 建立 EXTENDED_3MONTH 的品牌邮件字典映射（严格对齐 EXTENDED_3MONTH）
const extendedBrandsMap = new Map(
  EXTENDED_3MONTH.brands.map((b) => [b.name, b])
);

// 实例化 6 个品牌数据
export const ZARA_CALENDAR: BrandCalendarData = processBrand(
  "Zara",
  zaraRaw,
  extendedBrandsMap.get("Zara")!.emails
);

export const LULULEMON_CALENDAR: BrandCalendarData = processBrand(
  "lululemon",
  luluRaw,
  extendedBrandsMap.get("lululemon")!.emails
);

export const ALO_CALENDAR: BrandCalendarData = processBrand(
  "ALO Yoga",
  aloRaw,
  extendedBrandsMap.get("ALO Yoga")!.emails
);

export const HALARA_CALENDAR: BrandCalendarData = processBrand(
  "Halara",
  halaraRaw,
  extendedBrandsMap.get("Halara")!.emails
);

export const TEMU_CALENDAR: BrandCalendarData = processBrand(
  "Temu",
  temuRaw,
  extendedBrandsMap.get("Temu")!.emails
);

export const SHEIN_CALENDAR: BrandCalendarData = processBrand(
  "SHEIN",
  sheinRaw,
  extendedBrandsMap.get("SHEIN")!.emails
);

export const BRANDS_CALENDAR: Record<BrandKey, BrandCalendarData> = {
  Zara: ZARA_CALENDAR,
  lululemon: LULULEMON_CALENDAR,
  "ALO Yoga": ALO_CALENDAR,
  Halara: HALARA_CALENDAR,
  Temu: TEMU_CALENDAR,
  SHEIN: SHEIN_CALENDAR,
};

// ==========================================
// 聚合数据汇总
// ==========================================

// 每日 6 品牌合计发信数
export const DAILY_TOTALS: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const date of CALENDAR_DATES) {
    let daySum = 0;
    for (const brand of Object.values(BRANDS_CALENDAR)) {
      daySum += brand.dailyCounts[date] || 0;
    }
    totals[date] = daySum;
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
  Halara: HALARA_CALENDAR.dailyCounts,
  Temu: TEMU_CALENDAR.dailyCounts,
  SHEIN: SHEIN_CALENDAR.dailyCounts,
};

// 分品牌关键词索引映射表（便捷查询）
export const KEYWORD_INDEX_BY_BRAND: Record<BrandKey, Record<string, string[]>> = {
  Zara: ZARA_CALENDAR.keywordIndex,
  lululemon: LULULEMON_CALENDAR.keywordIndex,
  "ALO Yoga": ALO_CALENDAR.keywordIndex,
  Halara: HALARA_CALENDAR.keywordIndex,
  Temu: TEMU_CALENDAR.keywordIndex,
  SHEIN: SHEIN_CALENDAR.keywordIndex,
};

// 分品牌主题汇总映射表（便捷查询）
export const THEME_SUMMARY_BY_BRAND: Record<BrandKey, Record<CalendarThemeKey, number>> = {
  Zara: ZARA_CALENDAR.themeSummary,
  lululemon: LULULEMON_CALENDAR.themeSummary,
  "ALO Yoga": ALO_CALENDAR.themeSummary,
  Halara: HALARA_CALENDAR.themeSummary,
  Temu: TEMU_CALENDAR.themeSummary,
  SHEIN: SHEIN_CALENDAR.themeSummary,
};

// 元信息
export const CALENDAR_META: CalendarDatasetMeta = {
  windowStart: CALENDAR_START_DATE,
  windowEnd: CALENDAR_END_DATE,
  totalDays: CALENDAR_TOTAL_DAYS,
  brands: [...CALENDAR_BRANDS],
  allDates: [...CALENDAR_DATES],
  keywordSet: [...CALENDAR_KEYWORDS],
  allThemes: [...CALENDAR_THEMES],
  totalEmails: Object.values(BRANDS_CALENDAR).reduce(
    (sum, b) => sum + b.totalEmails,
    0
  ),
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
  {
    brand: "Halara",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 44,
    dataTsCount: 43,
    diff: 1,
    note: "2026-10-15 抓取收录 44 封 vs 原 3 周 43 封（多 1 封）；且 3 个月主题按标题主钩分类",
  },
  {
    brand: "Temu",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 44,
    dataTsCount: 44,
    diff: 0,
    note: "抓取收录 44 封与原 data.ts 一致；其中 8 封 other 为商家 listing 邮件，消费者 EDM 净计 36 封",
  },
  {
    brand: "SHEIN",
    overlapWindow: "2026-09-24 to 2026-10-15",
    jsonCount: 65,
    dataTsCount: 62,
    diff: 3,
    note: "Milled 页面收录 65 封 vs 原 3 周 62 封（多 3 封），仅记录差异不覆盖原始 DATA",
  },
];

// ==========================================
// 数据合法性校验
// ==========================================

export interface CalendarBrandValidation {
  brand: BrandKey;
  totalEmails: number;
  expectedEmails: number;
  countMatch: boolean;
  dailySumMatch: boolean;
  dailyCoverageDays: number;
  dailyCoverageMatch: boolean;
  themeDistributionMatch: boolean;
  keywordIndexValid: boolean;
  calendarThemes: Record<CalendarThemeKey, number>;
  expectedThemes: Record<string, number>;
  errors: string[];
}

export interface CalendarValidationResult {
  isValid: boolean;
  totalEmails: number;
  expectedTotalEmails: number;
  brandsCount: number;
  expectedBrandsCount: number;
  dailyTotalsSum: number;
  dailyTotalsMatch: boolean;
  brandValidations: Record<BrandKey, CalendarBrandValidation>;
  errors: string[];
}

/**
 * 校验日历数据层与 EXTENDED_3MONTH 的数据合法性：
 * 1. 总封数 === 770
 * 2. 6 品牌封数各自分别与 EXTENDED_3MONTH 一致
 * 3. 6 品牌主题分布各自分别与 EXTENDED_3MONTH 一致
 * 4. 每日封数完整覆盖 92 天窗口，无缺失日期，各日封数累加与总量守恒
 * 5. 关键词索引日期在窗口内升序排列
 */
export function validateCalendarData(): CalendarValidationResult {
  const errors: string[] = [];
  const expectedTotalEmails = EXTENDED_3MONTH.meta.total; // 770
  const expectedBrandsCount = EXTENDED_3MONTH.brands.length; // 6

  let calculatedTotalEmails = 0;
  const brandValidations: Partial<Record<BrandKey, CalendarBrandValidation>> = {};

  for (const brandName of CALENDAR_BRANDS) {
    const brandErrors: string[] = [];
    const brandData = BRANDS_CALENDAR[brandName];
    const expectedBrand = EXTENDED_3MONTH.brands.find((b) => b.name === brandName);

    if (!brandData) {
      errors.push(`品牌 ${brandName} 缺失于 BRANDS_CALENDAR`);
      continue;
    }
    if (!expectedBrand) {
      errors.push(`品牌 ${brandName} 缺失于 EXTENDED_3MONTH`);
      continue;
    }

    calculatedTotalEmails += brandData.totalEmails;
    const countMatch = brandData.totalEmails === expectedBrand.emails.length;
    if (!countMatch) {
      brandErrors.push(
        `总封数不一致: calendar=${brandData.totalEmails}, expected=${expectedBrand.emails.length}`
      );
    }

    // 每日封数覆盖检查（92天全量日期）
    let dailySum = 0;
    let dailyCoverageDays = 0;
    for (const date of CALENDAR_DATES) {
      if (date in brandData.dailyCounts) {
        dailyCoverageDays += 1;
        const count = brandData.dailyCounts[date];
        if (count < 0 || !Number.isInteger(count)) {
          brandErrors.push(`日期 ${date} 发信数非法: ${count}`);
        }
        dailySum += count;
      }
    }
    const dailyCoverageMatch = dailyCoverageDays === CALENDAR_TOTAL_DAYS;
    if (!dailyCoverageMatch) {
      brandErrors.push(
        `每日覆盖天数不足: ${dailyCoverageDays} / ${CALENDAR_TOTAL_DAYS}`
      );
    }

    const dailySumMatch = dailySum === brandData.totalEmails;
    if (!dailySumMatch) {
      brandErrors.push(
        `每日封数之和 (${dailySum}) 不等于总邮件数 (${brandData.totalEmails})`
      );
    }

    // 主题分布校验（与 EXTENDED_3MONTH 逐主题核对）
    const expectedThemes: Record<string, number> = {};
    for (const e of expectedBrand.emails) {
      expectedThemes[e.theme] = (expectedThemes[e.theme] || 0) + 1;
    }

    let themeDistributionMatch = true;
    for (const theme of CALENDAR_THEMES) {
      const calCount = brandData.themeSummary[theme] || 0;
      const expCount = expectedThemes[theme] || 0;
      if (calCount !== expCount) {
        themeDistributionMatch = false;
        brandErrors.push(
          `主题 [${theme}] 封数不一致: calendar=${calCount}, expected=${expCount}`
        );
      }
    }

    // 关键词索引合法性校验（升序、窗口内、索引键覆盖）
    let keywordIndexValid = true;
    for (const kw of CALENDAR_KEYWORDS) {
      const dates = brandData.keywordIndex[kw] || [];
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        if (d < CALENDAR_START_DATE || d > CALENDAR_END_DATE) {
          keywordIndexValid = false;
          brandErrors.push(`关键词 [${kw}] 包含越界日期: ${d}`);
        }
        if (i > 0 && dates[i] <= dates[i - 1]) {
          keywordIndexValid = false;
          brandErrors.push(`关键词 [${kw}] 日期未严格递增: ${dates[i - 1]} -> ${d}`);
        }
      }
    }

    if (brandErrors.length > 0) {
      errors.push(...brandErrors.map((e) => `[${brandName}] ${e}`));
    }

    brandValidations[brandName] = {
      brand: brandName,
      totalEmails: brandData.totalEmails,
      expectedEmails: expectedBrand.emails.length,
      countMatch,
      dailySumMatch,
      dailyCoverageDays,
      dailyCoverageMatch,
      themeDistributionMatch,
      keywordIndexValid,
      calendarThemes: { ...brandData.themeSummary },
      expectedThemes,
      errors: brandErrors,
    };
  }

  // 每日合计与全局总数校验
  let dailyTotalsSum = 0;
  let dailyTotalsMatch = true;
  for (const date of CALENDAR_DATES) {
    const totalForDate = DAILY_TOTALS[date] ?? 0;
    dailyTotalsSum += totalForDate;
    let sumOfBrandsForDate = 0;
    for (const bName of CALENDAR_BRANDS) {
      sumOfBrandsForDate += BRANDS_CALENDAR[bName]?.dailyCounts[date] ?? 0;
    }
    if (totalForDate !== sumOfBrandsForDate) {
      dailyTotalsMatch = false;
      errors.push(
        `日期 ${date} DAILY_TOTALS (${totalForDate}) 与各品牌累加 (${sumOfBrandsForDate}) 不一致`
      );
    }
  }

  if (dailyTotalsSum !== expectedTotalEmails) {
    dailyTotalsMatch = false;
    errors.push(
      `DAILY_TOTALS 总和 (${dailyTotalsSum}) 与期望 (${expectedTotalEmails}) 不一致`
    );
  }

  if (calculatedTotalEmails !== expectedTotalEmails) {
    errors.push(
      `看板总邮件数 (${calculatedTotalEmails}) 与 EXTENDED_3MONTH 总数 (${expectedTotalEmails}) 不一致`
    );
  }

  if (CALENDAR_BRANDS.length !== expectedBrandsCount) {
    errors.push(
      `看板品牌数 (${CALENDAR_BRANDS.length}) 与 EXTENDED_3MONTH 品牌数 (${expectedBrandsCount}) 不一致`
    );
  }

  return {
    isValid: errors.length === 0,
    totalEmails: calculatedTotalEmails,
    expectedTotalEmails,
    brandsCount: CALENDAR_BRANDS.length,
    expectedBrandsCount,
    dailyTotalsSum,
    dailyTotalsMatch,
    brandValidations: brandValidations as Record<BrandKey, CalendarBrandValidation>,
    errors,
  };
}

export const CALENDAR_VALIDATION: CalendarValidationResult = validateCalendarData();

if (!CALENDAR_VALIDATION.isValid) {
  throw new Error(
    `Calendar data validation failed:\n${CALENDAR_VALIDATION.errors.join("\n")}`
  );
}

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
  validation: CALENDAR_VALIDATION,
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
