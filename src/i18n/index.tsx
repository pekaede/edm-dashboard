import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type Locale = "zh" | "en";

export type DictionaryKey =
  | "appTitle"
  | "appSubtitle"
  | "viewDashboard"
  | "viewReport"
  | "viewEmails"
  | "viewNavigation"
  | "sectionSummary"
  | "sectionOverview"
  | "sectionKeywords"
  | "sectionCalendar"
  | "sectionComparison"
  | "sectionContentAnalysis"
  | "globalSite"
  | "globalSiteThreeMonths"
  | "loading"
  | "footer"
  | "language"
  | "all"
  | "backToDashboard"
  | "backToDashboardAria"
  // DashboardHeader
  | "headerSamplesThreeWeeks"
  | "headerThreeMonthBrands"
  | "headerStudyPeriod"
  | "headerWeeks"
  | "headerDataScopeSummary"
  | "headerQueryFixedTo"
  | "headerSiteLinkedDescription"
  | "headerCountLoading"
  // DashboardFooter
  | "footerUnitEmails"
  | "footerAriaLabel"
  | "footerStatWindow"
  | "footerLocalMarketDate"
  | "footerFixedCutoff"
  | "footerCurrentSiteSamples"
  | "footerThreeWeekAgg"
  | "footerTotalMeaningTitle"
  | "footerTotalMeaningLabel"
  | "footerTotalMeaningText1"
  | "footerTotalMeaningHighlight"
  | "footerCutoffTimeTitle"
  | "footerCutoffLabel"
  | "footerJsonIntro"
  | "footerJsonCoverage"
  | "footerJsonWindowPart1"
  | "footerJsonWindowPart2"
  | "footerLiveIntro"
  | "footerLiveCoverage"
  | "footerLiveWindowPart1"
  | "footerLiveWindowPart2"
  | "footerLiveWindowPart3"
  | "footerTimeStandardLabel"
  | "footerTimeStandardText1"
  | "footerTimeStandardHighlight"
  | "footerTimeStandardText2"
  | "footerMarketCoverageTitle"
  | "footerMarketCoverageLabel"
  | "footerMarketCoverageText"
  | "footerMarketJsonNote"
  | "footerBrandRulesLabel"
  | "footerBrandRulesText"
  // PageNav
  | "pageNavAriaLabel"
  // KpiGrid
  | "kpiTitle"
  | "kpiTotalEmails"
  | "kpiBrandCount"
  | "kpiWeekCount"
  | "kpiPerDay"
  | "kpiEmptyTitle"
  | "kpiEmptyDescPart1"
  | "kpiEmptyDescPart2"
  | "kpiEmptyDescPart3"
  | "kpiRetry"
  | "kpiSwitchAllMarkets"
  | "kpiLoadingStatus"
  | "kpiErrorStatus"
  // Insights
  | "insightsTitle"
  | "insightsHint"
  | "insightsEmptyTitle"
  | "insightsEmptyDesc1"
  | "insightsEmptyDesc2"
  | "insightsSwitchAll"
  | "insightsRetry"
  // CampaignOverview
  | "campaignTitle"
  | "campaignHintRealtime"
  | "campaignHintTotalPart"
  | "campaignHintDiffPart"
  | "campaignHintDescPart"
  | "campaignHintFallback"
  | "campaignEmptyTitle"
  | "campaignEmptyDesc"
  | "campaignRetry"
  | "campaignSwitchAll"
  | "campaignScaleNote"
  | "campaignTableAriaLabel"
  | "campaignCaptionUnit"
  | "campaignBrand"
  | "campaignTotal"
  | "campaignTooltipLabelEmails"
  | "campaignTooltipLabelSuffix"
  | "campaignTooltipEmails"
  | "campaignTooltipShare"
  | "campaignTooltipDenominator"
  | "campaignTooltipVisible"
  | "campaignLegendAriaLabel"
  | "campaignVolumeLabel"
  | "campaignFooterNote"
  // EmptyState
  | "emptyStateReset";

export const dictionary: Record<DictionaryKey, Record<Locale, string>> = {
  appTitle: { zh: "EDM 竞品监测", en: "EDM Competitor Monitor" },
  appSubtitle: { zh: "邮件营销竞品分析", en: "Competitive email marketing insights" },
  viewDashboard: { zh: "数据看板", en: "Dashboard" },
  viewReport: { zh: "OnePage 报告", en: "OnePage Report" },
  viewEmails: { zh: "邮件视图", en: "Email View" },
  viewNavigation: { zh: "页面视图", en: "Page views" },
  sectionSummary: { zh: "OnePage 摘要", en: "OnePage Summary" },
  sectionOverview: { zh: "数据概览", en: "Overview" },
  sectionKeywords: { zh: "关键词", en: "Keywords" },
  sectionCalendar: { zh: "日历", en: "Calendar" },
  sectionComparison: { zh: "跨市场对比", en: "Cross-market comparison" },
  sectionContentAnalysis: { zh: "内容 AI 分析", en: "Content AI analysis" },
  globalSite: { zh: "当前全局站点", en: "Global site" },
  globalSiteThreeMonths: {
    zh: "全局站点（三个月）",
    en: "Global site (three months)",
  },
  loading: { zh: "加载中…", en: "Loading…" },
  footer: { zh: "EDM 竞品监测", en: "EDM Competitor Monitor" },
  language: { zh: "语言", en: "Language" },
  all: { zh: "全部", en: "All" },
  backToDashboard: { zh: "← 回到看板", en: "← Back to dashboard" },
  backToDashboardAria: { zh: "返回数据看板", en: "Back to dashboard" },
  // DashboardHeader
  headerSamplesThreeWeeks: { zh: "封样本（3 周）", en: "sample emails (3 weeks)" },
  headerThreeMonthBrands: { zh: "3 个月有记录品牌", en: "Brands recorded (3 mo)" },
  headerStudyPeriod: { zh: "研究周期", en: "Study period" },
  headerWeeks: { zh: "周", en: "weeks" },
  headerDataScopeSummary: { zh: "数据范围摘要", en: "Data scope summary" },
  headerQueryFixedTo: { zh: "查询固定至", en: "Query fixed to" },
  headerSiteLinkedDescription: {
    zh: "。站点联动看板、OnePage、邮件、日历和词云；跨市场对比独立选择。",
    en: ". Site selection syncs Dashboard, OnePage, Emails, Calendar, and Word Cloud; Cross-Market Comparison is selected independently.",
  },
  headerCountLoading: { zh: " 计数加载中。", en: " Loading counts." },
  // DashboardFooter
  footerUnitEmails: { zh: "封", en: "emails" },
  footerAriaLabel: { zh: "数据说明与口径", en: "Data notes and methodology" },
  footerStatWindow: { zh: "统计窗口：", en: "Statistical window: " },
  footerLocalMarketDate: { zh: "（各市场当地日期）", en: " (local market dates)" },
  footerFixedCutoff: { zh: "固定截止日：", en: "Fixed cutoff date: " },
  footerCurrentSiteSamples: { zh: "当前站点样本：", en: "Current site samples: " },
  footerThreeWeekAgg: { zh: "近 3 周聚合：", en: "3-week aggregation: " },
  footerTotalMeaningTitle: { zh: "总数含义", en: "Meaning of Totals" },
  footerTotalMeaningLabel: { zh: "总数含义：", en: "Meaning of Totals: " },
  footerTotalMeaningText1: {
    zh: "看板统计的所有封数均为 Milled 品牌归档在统计窗口内公开可见并被收录的邮件样本量，反映竞品公开营销动作、排期频次与主题节奏；",
    en: "All email counts tracked on this dashboard represent publicly visible email samples archived by Milled within the statistical window, reflecting competitors' public marketing cadence, scheduling frequency, and thematic rhythm; ",
  },
  footerTotalMeaningHighlight: {
    zh: "非品牌向其私域受众全量发送的投递总量（Delivery Volume）。",
    en: "not the total delivery volume sent by brands to their full private audience (Delivery Volume).",
  },
  footerCutoffTimeTitle: { zh: "固定截止日与时间口径", en: "Fixed Cutoff Date and Time Standard" },
  footerCutoffLabel: { zh: "固定截止日：", en: "Fixed cutoff date: " },
  footerJsonIntro: { zh: "本期研究为历史快照，截止日为 ", en: "This study uses a historical snapshot with a cutoff date of " },
  footerJsonCoverage: { zh: "，整体分析覆盖 ", en: ", covering " },
  footerJsonWindowPart1: { zh: " 的 ", en: " across " },
  footerJsonWindowPart2: {
    zh: " 天历史窗口。快照窗口固定，不随每日任务或访问自然日滑动。",
    en: " days of historical window. The snapshot window is fixed and does not roll with daily tasks or calendar days.",
  },
  footerLiveIntro: { zh: "本期研究设定固定截止日为 ", en: "This study sets a fixed cutoff date of " },
  footerLiveCoverage: { zh: "，整体分析覆盖 ", en: ", covering " },
  footerLiveWindowPart1: { zh: " 的 ", en: " across " },
  footerLiveWindowPart2: {
    zh: " 天滑动窗口。截止日由每日更新任务在成功后推进，窗口随之滑动并保持 ",
    en: " days of rolling window. The cutoff date advances after successful daily update tasks, maintaining ",
  },
  footerLiveWindowPart3: {
    zh: " 天，确保各品牌与站点在恒定长度时间区间内具备横向对比的可比性与复现性；窗口不随访问自然日自动推进。",
    en: " days to ensure horizontal comparability and reproducibility across brands and sites; the window does not advance with calendar days.",
  },
  footerTimeStandardLabel: { zh: "时间口径：", en: "Time Standard: " },
  footerTimeStandardText1: { zh: "所有发送日期均按邮件发出时 ", en: "All send dates are archived and aligned to " },
  footerTimeStandardHighlight: { zh: "各市场当地日历日期", en: "each market's local calendar date" },
  footerTimeStandardText2: { zh: " 归档与对齐。", en: " at the time of sending." },
  footerMarketCoverageTitle: { zh: "市场覆盖与分析规则", en: "Market Coverage and Analysis Rules" },
  footerMarketCoverageLabel: { zh: "市场覆盖：", en: "Market Coverage: " },
  footerMarketCoverageText: {
    zh: "系统共配置 8 个市场（US、UK、AU、FR、DE、IT、NL、ES），当前 7 个市场已有收录记录，西班牙（ES）收录为 0（选择后暂无邮件）。意大利（IT）与荷兰（NL）已有收录记录。",
    en: "The system is configured with 8 markets (US, UK, AU, FR, DE, IT, NL, ES). Currently 7 markets have archived records; Spain (ES) has 0 records (no emails after selection). Italy (IT) and Netherlands (NL) have archived records.",
  },
  footerMarketJsonNote: {
    zh: "（当前为离线快照，仅展示历史 US 770 封样本。）",
    en: " (Currently offline snapshot, displaying historical US 770 sample emails only.)",
  },
  footerBrandRulesLabel: { zh: "品牌与分类：", en: "Brands and Categories: " },
  footerBrandRulesText: {
    zh: "监测包含 Zara、lululemon、ALO Yoga、Halara、Temu、SHEIN 共 6 个品牌。主题分类依据主题行与正文推介判定，每封邮件唯一归入一个主导主题；词频按包含该词的去重邮件篇数计算；看板严格遵守合规边界，不引用任何竞品未经授权的原始文案。",
    en: "Monitoring covers 6 brands: Zara, lululemon, ALO Yoga, Halara, Temu, and SHEIN. Topic classification is determined by subject line and content highlights, with each email uniquely assigned to one dominant topic; keyword frequency is calculated by unique email count containing the word; the dashboard strictly adheres to compliance boundaries and does not quote unauthorized original copy from competitors.",
  },
  // PageNav
  pageNavAriaLabel: { zh: "页面内容导航", en: "Page content navigation" },
  // KpiGrid
  kpiTitle: { zh: "关键指标", en: "Key Metrics" },
  kpiTotalEmails: { zh: "3 周邮件总数", en: "3-Week Total Emails" },
  kpiBrandCount: { zh: "3 个月有记录品牌", en: "Brands Recorded (3 Mo)" },
  kpiWeekCount: { zh: "研究周期（周）", en: "Study Period (Weeks)" },
  kpiPerDay: { zh: "日均邮件", en: "Daily Avg Emails" },
  kpiEmptyTitle: { zh: "当前站点三周窗口暂无邮件", en: "No emails in 3-week window for current site" },
  kpiEmptyDescPart1: {
    zh: " 内暂无邮件，邮件总数与日均以 — 显示。品牌数按三个月（",
    en: " has no emails in this window. Total emails and daily average are shown as —. Brand count is based on 3 months (",
  },
  kpiEmptyDescPart2: { zh: "）统计，研究周期为 ", en: "), and the study period is " },
  kpiEmptyDescPart3: { zh: " 周。", en: " weeks." },
  kpiRetry: { zh: "重新拉取", en: "Retry" },
  kpiSwitchAllMarkets: { zh: "切换至全部市场", en: "Switch to all markets" },
  kpiLoadingStatus: { zh: "指标加载中，邮件量与品牌数暂以 — 显示。", en: "Loading metrics, email volume and brand count shown as —." },
  kpiErrorStatus: { zh: "数据暂不可用，邮件量与品牌数以 — 显示；请查看下方数据状态。", en: "Data temporarily unavailable, email volume and brand count shown as —; please check data status below." },
  // Insights
  insightsTitle: { zh: "关键洞察", en: "Key Insights" },
  insightsHint: { zh: "三周实时聚合", en: "3-week real-time aggregation" },
  insightsEmptyTitle: { zh: "暂无三周洞察", en: " No 3-Week Insights" },
  insightsEmptyDesc1: { zh: "该市场在三周聚合窗口（", en: "No publicly archived email records found for this market within the 3-week aggregation window (" },
  insightsEmptyDesc2: {
    zh: "）内暂无公开邮件收录记录，不推断主题偏好或触达策略。看板统计总量均为 Milled 公开收录样本，非品牌私域全量投递。",
    en: "); subject preferences or engagement strategies cannot be inferred. All counts on this dashboard are publicly archived samples from Milled, not full private delivery.",
  },
  insightsSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  insightsRetry: { zh: "重新拉取", en: "Retry" },
  // CampaignOverview
  campaignTitle: { zh: "品牌 × 周 × 发送频次", en: "Brand × Week × Send Frequency" },
  campaignHintRealtime: { zh: "实时聚合（窗口 ", en: "Real-time aggregation (window " },
  campaignHintTotalPart: { zh: "，共 ", en: ", total " },
  campaignHintDiffPart: { zh: " 封），与 3 个月 ", en: " emails), different scope from 3-month " },
  campaignHintDescPart: {
    zh: " 封为不同口径。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。",
    en: " emails. Cell numbers indicate archived emails for that brand in that week; color intensity corresponds to email volume.",
  },
  campaignHintFallback: {
    zh: "）。单元格数字为该品牌当周邮件收录数；颜色深浅对应邮件量高低。",
    en: "). Cell numbers indicate archived emails for that brand in that week; color intensity corresponds to email volume.",
  },
  campaignEmptyTitle: { zh: "三周窗口暂无发送记录", en: "No send records in 3-week window" },
  campaignEmptyDesc: {
    zh: "该站点在三周窗口内暂无邮件（0 封），不生成品牌周发送频次。可切换市场或重新拉取数据。",
    en: "No emails (0 emails) found for this site within the 3-week window; brand weekly send frequency cannot be generated. Try switching markets or retrying data fetch.",
  },
  campaignRetry: { zh: "重新拉取", en: "Retry" },
  campaignSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  campaignScaleNote: {
    zh: "色阶固定，跨品牌使用同一尺度；描边表示当前查看，不代表效果优劣。聚焦单元格可查看明细，Esc 关闭提示。",
    en: "Fixed color scale applied uniformly across brands; outlines indicate current selection, not performance quality. Focus cell to view details, Esc to dismiss tooltip.",
  },
  campaignTableAriaLabel: {
    zh: "品牌每周发送频次，可横向滚动",
    en: "Brand weekly send frequency, horizontally scrollable",
  },
  campaignCaptionUnit: { zh: "，品牌每周可见收录邮件数，单位：封", en: ", visible archived emails per brand per week, unit: emails" },
  campaignBrand: { zh: "品牌", en: "Brand" },
  campaignTotal: { zh: "合计", en: "Total" },
  campaignTooltipLabelEmails: { zh: " 封邮件，占三周样本 ", en: " emails, " },
  campaignTooltipLabelSuffix: { zh: "%", en: "% of 3-week sample" },
  campaignTooltipEmails: { zh: "封", en: "emails" },
  campaignTooltipShare: { zh: "三周样本占比", en: "Share of 3-week sample" },
  campaignTooltipDenominator: { zh: "分母", en: "Denominator" },
  campaignTooltipVisible: { zh: "可见收录", en: "visible archived" },
  campaignLegendAriaLabel: { zh: "固定邮件量色阶，单位：封", en: "Fixed email volume color scale, unit: emails" },
  campaignVolumeLabel: { zh: "邮件量（封）", en: "Email Volume (emails)" },
  campaignFooterNote: {
    zh: "各周桶覆盖天数可能不同；0 表示未收录，不代表实际未发送。",
    en: "Days covered per weekly bucket may vary; 0 indicates not archived, not necessarily unsent.",
  },
  // EmptyState
  emptyStateReset: { zh: "重置筛选", en: "Reset filter" },
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh";

  try {
    return window.localStorage.getItem("edm-lang") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    try {
      window.localStorage.setItem("edm-lang", locale);
    } catch {
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: DictionaryKey) => dictionary[key][locale],
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
