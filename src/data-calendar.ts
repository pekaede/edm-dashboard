/**
 * 品牌营销触达趋势看板 - 90天日历视图数据层
 *
 * 数据源：统一适配后的逐封邮件记录
 * 覆盖窗口：2026-07-16 至 2026-10-15（共 92 天）
 * 包含品牌（共 6 品牌，859 封 = US 770 + UK 89）：
 *   - Zara（92 封 = US 43 + UK 49）
 *   - lululemon（99 封 = US 59 + UK 40）
 *   - ALO Yoga（113 封，US only）
 *   - Halara（191 封，US only）
 *   - Temu（85 封消费者邮件，US only，已排除 8 封商家侧 listing 邮件）
 *   - SHEIN（279 封，US only）
 *
 * 注：仅提供数据模型与导出接口，不含 UI 组件。
 */

import { BRAND_ORDER, EXTENDED_EMAIL_META, getEmailMarket, type EmailRecord } from "./email-data";

// ==========================================
// 类型定义
// ==========================================

export type BrandKey = (typeof BRAND_ORDER)[number];

export const CALENDAR_BRANDS: readonly BrandKey[] = BRAND_ORDER;

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

export interface CalendarEmail extends EmailRecord {
  theme: CalendarThemeKey;
}

export interface BrandCalendarData {
  brand: BrandKey;
  source: string;
  market: string;
  note: string;
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

export const CALENDAR_START_DATE = EXTENDED_EMAIL_META.windowStart;
export const CALENDAR_END_DATE = EXTENDED_EMAIL_META.windowEnd;

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

function processBrand(
  brandName: BrandKey,
  emailsInput: EmailRecord[]
): BrandCalendarData {
  const emails: CalendarEmail[] = emailsInput.map((email) => ({
    ...email,
    theme: email.theme as CalendarThemeKey,
    keywords: [...email.keywords],
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
  for (const keyword of Object.keys(keywordDatesMap)) {
    keywordIndex[keyword] = Array.from(keywordDatesMap[keyword]).sort();
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
    source: EXTENDED_EMAIL_META.source,
    // 该品牌覆盖的市场（由传入邮件推导；多市场时为 "US + UK" 形式）。此前硬编码 "US" 已失真。
    // 注意：CalendarView 目前不消费 built.brands[].market（用自己的 selectedMarket），此处仅保真。
    market: [...new Set(emailsInput.map((email) => getEmailMarket(email)))].join(" + ") || "US",
    note: "",
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

export const CALENDAR_META: CalendarDatasetMeta = {
  windowStart: CALENDAR_START_DATE,
  windowEnd: CALENDAR_END_DATE,
  totalDays: CALENDAR_TOTAL_DAYS,
  brands: [...CALENDAR_BRANDS],
  allDates: [...CALENDAR_DATES],
  keywordSet: [...CALENDAR_KEYWORDS],
  allThemes: [...CALENDAR_THEMES],
  totalEmails: EXTENDED_EMAIL_META.total,
};

export interface CalendarData {
  brands: Record<BrandKey, BrandCalendarData>;
  dailyTotals: Record<string, number>;
  themeSummary: Record<CalendarThemeKey, number>;
  keywordIndexByBrand: Record<BrandKey, Record<string, string[]>>;
  dailyCountsByBrand: Record<BrandKey, Record<string, number>>;
  themeSummaryByBrand: Record<BrandKey, Record<CalendarThemeKey, number>>;
  meta: CalendarDatasetMeta;
}

export function buildCalendarData(emails: EmailRecord[]): CalendarData {
  const brands = Object.fromEntries(CALENDAR_BRANDS.map((brand) => [
    brand,
    processBrand(brand, emails.filter((email) => email.brand === brand)),
  ])) as Record<BrandKey, BrandCalendarData>;
  const dailyTotals = Object.fromEntries(CALENDAR_DATES.map((date) => [
    date,
    CALENDAR_BRANDS.reduce((sum, brand) => sum + (brands[brand].dailyCounts[date] ?? 0), 0),
  ]));
  const themeSummary = Object.fromEntries(CALENDAR_THEMES.map((theme) => [
    theme,
    CALENDAR_BRANDS.reduce((sum, brand) => sum + (brands[brand].themeSummary[theme] ?? 0), 0),
  ])) as Record<CalendarThemeKey, number>;

  return {
    brands,
    dailyTotals,
    themeSummary,
    keywordIndexByBrand: Object.fromEntries(CALENDAR_BRANDS.map((brand) => [brand, brands[brand].keywordIndex])) as CalendarData["keywordIndexByBrand"],
    dailyCountsByBrand: Object.fromEntries(CALENDAR_BRANDS.map((brand) => [brand, brands[brand].dailyCounts])) as CalendarData["dailyCountsByBrand"],
    themeSummaryByBrand: Object.fromEntries(CALENDAR_BRANDS.map((brand) => [brand, brands[brand].themeSummary])) as CalendarData["themeSummaryByBrand"],
    meta: { ...CALENDAR_META, totalEmails: emails.length },
  };
}

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
 * 校验日历聚合与传入邮件记录的数据合法性：
 * 1. 总封数 === EXTENDED_EMAIL_META.total（当前 859 = US 770 + UK 89，多市场导入后同步更新）
 * 2. 6 品牌封数各自分别与传入邮件一致
 * 3. 6 品牌主题分布各自分别与传入邮件一致
 * 4. 每日封数完整覆盖 92 天窗口，无缺失日期，各日封数累加与总量守恒
 * 5. 关键词索引日期在窗口内升序排列
 */
export function validateCalendarData(emails: EmailRecord[], built: CalendarData): CalendarValidationResult {
  const errors: string[] = [];
  const expectedTotalEmails = EXTENDED_EMAIL_META.total;
  const expectedBrandsCount = CALENDAR_BRANDS.length;
  const identities = new Set<string>();

  for (const email of emails) {
    // 标识必须含市场：同一品牌同一天同一 source_index 在不同市场是不同邮件
    //（source_index 按市场内品牌文件重排，US 与 UK 有 7 个 (brand, date, source_index) 碰撞）。
    const identity = `${getEmailMarket(email)}-${email.brand}-${email.date}-${email.source_index}`;
    if (identities.has(identity)) errors.push("邮件存在重复标识。");
    identities.add(identity);
    if (!CALENDAR_BRANDS.includes(email.brand as BrandKey)) errors.push("邮件包含未知品牌。");
    if (!CALENDAR_DATES.includes(email.date)) errors.push("邮件日期不在统计窗口内。");
    if (!CALENDAR_THEMES.includes(email.theme as CalendarThemeKey)) errors.push("邮件包含未知主题。");
  }
  if (emails.length !== expectedTotalEmails) {
    errors.push(`邮件未取齐（已取 ${emails.length} / ${expectedTotalEmails} 封）。`);
  }
  if (built.meta.totalEmails !== emails.length) errors.push("日历元数据总数不一致。");

  let calculatedTotalEmails = 0;
  const brandValidations: Partial<Record<BrandKey, CalendarBrandValidation>> = {};

  for (const brandName of CALENDAR_BRANDS) {
    const brandErrors: string[] = [];
    const brandData = built.brands[brandName];
    const expectedEmails = emails.filter((email) => email.brand === brandName);

    if (!brandData) {
      errors.push(`品牌 ${brandName} 缺失于日历聚合`);
      continue;
    }

    calculatedTotalEmails += brandData.totalEmails;
    const countMatch = brandData.totalEmails === expectedEmails.length;
    if (!countMatch) {
      brandErrors.push(
        `总封数不一致: calendar=${brandData.totalEmails}, expected=${expectedEmails.length}`
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
        if (count !== expectedEmails.filter((email) => email.date === date).length) {
          brandErrors.push(`日期 ${date} 发信数与邮件记录不一致`);
        }
      }
    }
    const dailyCoverageMatch = dailyCoverageDays === CALENDAR_TOTAL_DAYS &&
      Object.keys(brandData.dailyCounts).length === CALENDAR_TOTAL_DAYS;
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

    // 主题分布校验（与传入邮件逐主题核对）
    const expectedThemes: Record<string, number> = {};
    for (const email of expectedEmails) {
      expectedThemes[email.theme] = (expectedThemes[email.theme] || 0) + 1;
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
    const keywords = new Set([...CALENDAR_KEYWORDS, ...expectedEmails.flatMap((email) => email.keywords)]);
    for (const keyword of keywords) {
      const dates = brandData.keywordIndex[keyword] || [];
      const expectedDates = [...new Set(expectedEmails
        .filter((email) => email.keywords.includes(keyword))
        .map((email) => email.date))].sort();
      if (!(keyword in brandData.keywordIndex) || dates.join() !== expectedDates.join()) {
        keywordIndexValid = false;
        brandErrors.push("关键词索引与邮件记录不一致");
      }
      for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
        const date = dates[dateIndex];
        if (!CALENDAR_DATES.includes(date)) {
          keywordIndexValid = false;
          brandErrors.push("关键词索引包含越界日期");
        }
        if (dateIndex > 0 && date <= dates[dateIndex - 1]) {
          keywordIndexValid = false;
          brandErrors.push("关键词索引日期未严格递增");
        }
      }
    }

    if (brandErrors.length > 0) {
      errors.push(...brandErrors.map((message) => `[${brandName}] ${message}`));
    }

    brandValidations[brandName] = {
      brand: brandName,
      totalEmails: brandData.totalEmails,
      expectedEmails: expectedEmails.length,
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
    const totalForDate = built.dailyTotals[date] ?? 0;
    dailyTotalsSum += totalForDate;
    let sumOfBrandsForDate = 0;
    for (const bName of CALENDAR_BRANDS) {
      sumOfBrandsForDate += built.brands[bName]?.dailyCounts[date] ?? 0;
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
      `看板总邮件数 (${calculatedTotalEmails}) 与期望总数 (${expectedTotalEmails}) 不一致`
    );
  }

  if (Object.keys(built.brands).length !== expectedBrandsCount) {
    errors.push(
      `看板品牌数与期望品牌数 (${expectedBrandsCount}) 不一致`
    );
  }

  for (const theme of CALENDAR_THEMES) {
    if (built.themeSummary[theme] !== emails.filter((email) => email.theme === theme).length) {
      errors.push("全品牌主题汇总与邮件记录不一致。");
    }
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

// ==========================================
// 便捷查询辅助函数
// ==========================================

/** 获取指定品牌指定日期的发信数 */
export function getDailyCount(built: CalendarData, brand: BrandKey, date: string): number {
  return built.brands[brand]?.dailyCounts[date] ?? 0;
}

/** 获取指定品牌命中某关键词的日期列表 */
export function getKeywordDates(built: CalendarData, brand: BrandKey, keyword: string): string[] {
  return built.brands[brand]?.keywordIndex[keyword] ?? [];
}

/** 获取指定品牌指定主题的邮件数 */
export function getThemeCount(built: CalendarData, brand: BrandKey, theme: CalendarThemeKey): number {
  return built.brands[brand]?.themeSummary[theme] ?? 0;
}

/** 获取指定品牌在某一天的全部邮件详情 */
export function getEmailsForDate(built: CalendarData, brand: BrandKey, date: string): CalendarEmail[] {
  return built.brands[brand]?.emails.filter((email) => email.date === date) ?? [];
}
