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
  | "emptyStateReset"
  // Batch B: MarketFilter + theme labels
  | "marketAll"
  | "marketUS"
  | "marketUK"
  | "marketAU"
  | "marketFR"
  | "marketDE"
  | "marketIT"
  | "marketNL"
  | "marketES"
  | "marketFilterLabel"
  | "marketCurrent"
  | "marketUnitEmails"
  | "themePrice"
  | "themeBehavior"
  | "themeNew"
  | "themeLifestyle"
  | "themeCategory"
  | "themeOther"
  // Batch B: ThemeDistribution (td)
  | "tdTitle"
  | "tdHintRealtime"
  | "tdHintTotalPart"
  | "tdHintDiffPart"
  | "tdHintDescPart"
  | "tdHintFallback"
  | "tdEmptyTitle"
  | "tdEmptyDesc"
  | "tdRetry"
  | "tdSwitchAll"
  | "tdAllThemes"
  | "tdChartLabel"
  | "tdChartPart"
  | "tdSliceAria"
  | "tdTooltipShare"
  | "tdDenominator"
  | "tdVisible"
  | "tdCenterAll"
  | "tdSliceGroupAria"
  | "tdLegendAria"
  | "tdFooterNote"
  // Batch B: WordCloud (wc)
  | "wcCatCategory"
  | "wcCatPromotion"
  | "wcCatStyle"
  | "wcCatAudience"
  | "wcTitleBase"
  | "wcTitleWeeks"
  | "wcTitleMonths"
  | "wcTitleSuffixWeeks"
  | "wcTitleSuffixMonths"
  | "wcHintWeeks"
  | "wcHintMonths"
  | "wcTimeRangeLabel"
  | "wcRangeGroupAria"
  | "wcRangeWeeks"
  | "wcRangeMonths"
  | "wcEmptyMarketTitle"
  | "wcEmptyMarketDesc"
  | "wcRetry"
  | "wcSwitchAll"
  | "wcEmptyWeeksTitle"
  | "wcEmptyNoWordsTitle"
  | "wcEmptyWeeksDesc"
  | "wcEmptyNoWordsDesc"
  | "wcSwitchMonths"
  | "wcNote"
  | "wcShowing"
  | "wcWordCount"
  | "wcWordLabel"
  | "wcSampleShare"
  | "wcDenominator"
  // Batch B: BrandThemeBreakdown (btb)
  | "btbTitle"
  | "btbHintRealtime"
  | "btbHintTotalPart"
  | "btbHintDiffPart"
  | "btbHintDescPart"
  | "btbHintFallback"
  | "btbEmptyTitle"
  | "btbEmptyDesc"
  | "btbRetry"
  | "btbSwitchAll"
  | "btbNote"
  | "btbLegendAria"
  | "btbPinned"
  | "btbAxisLeft"
  | "btbAxisRight"
  | "btbSegLabel"
  | "btbBrandShare"
  | "btbDenominator"
  | "btbZeroNote"
  // Batch B: BrandDetailDialog (bdd)
  | "bddEyebrow"
  | "bddDesc"
  | "bddCloseAria"
  | "bddOverview"
  | "bddTotalLabel"
  | "bddPerDayLabel"
  | "bddPerDayUnit"
  | "bddStrategyLabel"
  | "bddWeeklyTitle"
  | "bddWeeklyNote"
  | "bddThemesTitle"
  | "bddCampaignsTitle"
  // Batch B: MarketComparison (mc)
  | "mcTitle"
  | "mcHint"
  | "mcHintFallback"
  | "mcEmpty"
  | "mcIncomplete"
  | "mcSelectLegend"
  | "mcTablistAria"
  | "mcViewBrand"
  | "mcViewBrandQ"
  | "mcViewBrandDesc"
  | "mcViewTheme"
  | "mcViewThemeQ"
  | "mcViewThemeDesc"
  | "mcViewFreq"
  | "mcViewFreqQ"
  | "mcViewFreqDesc"
  | "mcStatusLine"
  | "mcNeedTwo"
  | "mcHighestNote"
  | "mcMatrixAriaTheme"
  | "mcMatrixAriaBrand"
  | "mcCaptionTheme"
  | "mcCaptionBrand"
  | "mcCaptionSuffix"
  | "mcColTheme"
  | "mcColBrand"
  | "mcMarketSample"
  | "mcColAllMarkets"
  | "mcColAllMarketsSub"
  | "mcHighest"
  | "mcHighestSuffix"
  | "mcCellLabel"
  | "mcCellLine"
  | "mcMarketDenominator"
  | "mcVisible"
  | "mcWeeklyAvg"
  | "mcMarketTotal"
  | "mcFocusBrand"
  | "mcScaleNote"
  | "mcFreqRegionAria"
  | "mcFreqSectionAria"
  | "mcFreqLabel"
  | "mcFreqHighestSuffix"
  | "mcFreqLine"
  | "mcFreqLine3"
  | "mcWeeksAria"
  | "mcFreqFooter"
  // Batch B: CalendarView (cal)
  | "calTitle"
  | "calValidationFailed"
  | "calSubtitle"
  | "calBrandFilterAria"
  | "calAllBrands"
  | "calMonthTablistAria"
  | "calDailyTitle"
  | "calScopeLine"
  | "calLegendAria"
  | "calLegendLow"
  | "calLegendHigh"
  | "calLegendRange"
  | "calEmptyTitle"
  | "calEmptyDesc"
  | "calRetry"
  | "calResetFilters"
  | "calCaption"
  | "calDay0"
  | "calDay1"
  | "calDay2"
  | "calDay3"
  | "calDay4"
  | "calDay5"
  | "calDay6"
  | "calOutsideAria"
  | "calDayAria"
  | "calDayTitle"
  | "calCloseDetail"
  | "calFieldDate"
  | "calFieldBrand"
  | "calFieldMarket"
  | "calFieldTheme"
  | "calFieldKeywords"
  | "calFieldOriginal"
  | "calNoKeywords"
  | "calOpenOriginal"
  | "calOpenOriginalAria"
  | "calNoOriginal"
  | "calDayEmptyTitle"
  | "calDayEmptyDesc"
  | "calBackToCalendar"
  | "calSearchLabel"
  | "calSearchHelp"
  | "calSearchPlaceholder"
  | "calSearchFound"
  | "calViewDay"
  | "calViewDayAria"
  | "calNoMatchTitle"
  | "calNoMatchDesc"
  | "calClearSearch";

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
  // Batch B: MarketFilter + theme labels
  marketAll: { zh: "全部市场", en: "All Markets" },
  marketUS: { zh: "美国", en: "United States" },
  marketUK: { zh: "英国", en: "United Kingdom" },
  marketAU: { zh: "澳洲", en: "Australia" },
  marketFR: { zh: "法国", en: "France" },
  marketDE: { zh: "德国", en: "Germany" },
  marketIT: { zh: "意大利", en: "Italy" },
  marketNL: { zh: "荷兰", en: "Netherlands" },
  marketES: { zh: "西班牙", en: "Spain" },
  marketFilterLabel: { zh: "按市场筛选", en: "Filter by Market" },
  marketCurrent: { zh: "当前：", en: "Current: " },
  marketUnitEmails: { zh: "封", en: "emails" },
  themePrice: { zh: "价格促销", en: "Price Promotion" },
  themeBehavior: { zh: "行为触发", en: "Behavior-triggered" },
  themeNew: { zh: "上新", en: "New Arrival" },
  themeLifestyle: { zh: "生活方式", en: "Lifestyle Content" },
  themeCategory: { zh: "品类聚焦", en: "Category Focus" },
  themeOther: { zh: "其他", en: "Other" },
  // Batch B: ThemeDistribution (td)
  tdTitle: { zh: "内容结构分布", en: "Content Theme Distribution" },
  tdHintRealtime: { zh: "实时聚合（窗口 ", en: "Real-time aggregation (window " },
  tdHintTotalPart: { zh: "，全期 ", en: ", period total " },
  tdHintDiffPart: { zh: " 封），与 3 个月 ", en: " emails), different scope from 3-month " },
  tdHintDescPart: { zh: " 封为不同口径。每封严格归入唯一主题。", en: " emails. Each email is assigned to exactly one theme." },
  tdHintFallback: { zh: "）。每封严格归入唯一主题。", en: "). Each email is assigned to exactly one theme." },
  tdEmptyTitle: { zh: "三周窗口暂无主题分布", en: "No theme distribution in 3-week window" },
  tdEmptyDesc: {
    zh: "该站点在三周窗口内暂无邮件（0 封），不计算主题占比或绘制环形图。可切换市场或重新拉取数据。",
    en: "No emails (0) for this site in the 3-week window; theme shares and the donut chart are not generated. Try switching markets or retrying.",
  },
  tdRetry: { zh: "重新拉取", en: "Retry" },
  tdSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  tdAllThemes: { zh: "全部主题", en: "All Themes" },
  tdChartLabel: {
    zh: "主题分布，{market}，{range}，共 {total} 封。{parts}。切片或图例链接可查看对应邮件。",
    en: "Theme distribution, {market}, {range}, {total} emails total. {parts}. Use a slice or legend link to view matching emails.",
  },
  tdChartPart: { zh: "{label} {count} 封，占 {pct}%", en: "{label} {count} emails, {pct}%" },
  tdSliceAria: {
    zh: "查看{label}主题邮件：{count} 封，占三周样本 {pct}%",
    en: "View {label} theme emails: {count} emails, {pct}% of the 3-week sample",
  },
  tdTooltipShare: { zh: "占比", en: "Share" },
  tdDenominator: { zh: "分母", en: "Denominator" },
  tdVisible: { zh: "可见收录", en: "visible archived" },
  tdCenterAll: { zh: "全部邮件 · 封", en: "All Emails" },
  tdSliceGroupAria: {
    zh: "主题切片，点击或按 Enter、空格查看对应邮件",
    en: "Theme slices; click or press Enter/Space to view matching emails",
  },
  tdLegendAria: { zh: "主题图例，点击查看对应邮件", en: "Theme legend; click to view matching emails" },
  tdFooterNote: {
    zh: "描边表示当前查看；小切片占比见图例。悬停或聚焦查看明细，切片或图例可进入邮件列表。占比四舍五入后可能不等于 100%。",
    en: "Outline marks the slice being viewed; see the legend for small-slice shares. Hover or focus for details; slices and legend open the email list. Rounded shares may not sum to 100%.",
  },
  // Batch B: WordCloud (wc)
  wcCatCategory: { zh: "品类类", en: "Category" },
  wcCatPromotion: { zh: "促销类", en: "Promotion" },
  wcCatStyle: { zh: "风格上新类", en: "Style & New" },
  wcCatAudience: { zh: "人群类", en: "Audience" },
  wcTitleBase: { zh: "分类高频词 Top 10 · ", en: "Top Category Keywords · " },
  wcTitleWeeks: { zh: "三周窗口", en: "3-Week Window" },
  wcTitleMonths: { zh: "三个月窗口", en: "3-Month Window" },
  wcTitleSuffixWeeks: { zh: "（{market} · {count} 封 · 实时聚合）", en: "({market} · {count} emails · real-time)" },
  wcTitleSuffixMonths: { zh: "（{market} · {count} 封）", en: "({market} · {count} emails)" },
  wcHintWeeks: {
    zh: "{range}；市场：{market}；实时聚合窗口内邮件，与三个月词云同口径分组，逐封邮件内同词去重，每类按含该词的邮件数倒序展示前 10 个。",
    en: "{range}; market: {market}; real-time emails in the window, grouped with the same rules as the 3-month cloud; duplicates within one email counted once; top 10 per category by number of emails containing the word.",
  },
  wcHintMonths: {
    zh: "{range}；市场：{market}；逐封邮件内同词去重，每类按含该词的邮件数倒序展示前 10 个。",
    en: "{range}; market: {market}; duplicates within one email counted once; top 10 per category by number of emails containing the word.",
  },
  wcTimeRangeLabel: { zh: "时间范围", en: "Time Range" },
  wcRangeGroupAria: { zh: "选择词云统计时间范围", en: "Select word cloud time range" },
  wcRangeWeeks: { zh: "三周", en: "3 Weeks" },
  wcRangeMonths: { zh: "三个月", en: "3 Months" },
  wcEmptyMarketTitle: { zh: "该市场暂无邮件", en: "No emails for this market" },
  wcEmptyMarketDesc: {
    zh: "{market}在统计窗口内暂无邮件，请切换市场或重新拉取数据。",
    en: "{market} has no emails in the statistics window. Switch markets or retry.",
  },
  wcRetry: { zh: "重新拉取", en: "Retry" },
  wcSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  wcEmptyWeeksTitle: { zh: "该市场在三周窗口内暂无邮件", en: "No emails for this market in the 3-week window" },
  wcEmptyNoWordsTitle: { zh: "无有效词", en: "No valid words" },
  wcEmptyWeeksDesc: {
    zh: "该市场在三周窗口内暂无邮件，请切换市场或时间范围。",
    en: "This market has no emails in the 3-week window. Switch markets or time range.",
  },
  wcEmptyNoWordsDesc: {
    zh: "该市场邮件的关键词均为空或为噪音词，无法生成词云。",
    en: "Keywords for this market's emails are empty or noise words; the word cloud cannot be generated.",
  },
  wcSwitchMonths: { zh: "切换至三个月", en: "Switch to 3 months" },
  wcNote: {
    zh: "字号表示含该词的邮件数，右上角为封数；分类色标不代表效果。聚焦词条查看样本占比，Esc 关闭提示。",
    en: "Font size indicates the number of emails containing the word; the superscript is the count. Category colors do not imply performance. Focus a word to see its sample share; Esc dismisses the tooltip.",
  },
  wcShowing: { zh: "展示 {shown} / 共 {total} 个词", en: "Showing {shown} of {total} words" },
  wcWordCount: { zh: "{n} 个词", en: "{n} words" },
  wcWordLabel: {
    zh: "{word}，包含于 {count} 封邮件，{category}，占当前样本 {pct}%",
    en: "{word}, appears in {count} emails, {category}, {pct}% of the current sample",
  },
  wcSampleShare: { zh: "样本占比", en: "Sample share" },
  wcDenominator: { zh: "分母", en: "Denominator" },
  // Batch B: BrandThemeBreakdown (btb)
  btbTitle: { zh: "各品牌内容结构", en: "Brand Content Structure" },
  btbHintRealtime: { zh: "各品牌 3 周实时聚合（窗口 ", en: "3-week real-time aggregation by brand (window " },
  btbHintTotalPart: { zh: "，共 ", en: ", total " },
  btbHintDiffPart: { zh: " 封）邮件主题占比与封数分布，与 3 个月 ", en: " emails) theme shares and volume distribution by brand, different scope from 3-month " },
  btbHintDescPart: { zh: " 封为不同口径。", en: " emails." },
  btbHintFallback: { zh: "）邮件主题占比与封数分布。", en: ") theme shares and volume distribution by brand." },
  btbEmptyTitle: { zh: "三周窗口暂无品牌主题记录", en: "No brand theme records in 3-week window" },
  btbEmptyDesc: {
    zh: "该站点在三周窗口内暂无邮件（0 封），不生成品牌主题占比与封数分布。可切换市场或重新拉取数据。",
    en: "No emails (0) for this site in the 3-week window; brand theme shares are not generated. Try switching markets or retrying.",
  },
  btbRetry: { zh: "重新拉取", en: "Retry" },
  btbSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  btbNote: {
    zh: "每条柱总长为该品牌的 100%，不代表邮件量。聚焦查看明细；点击图例锁定主题，再次点击或按 Esc 清除。",
    en: "Each bar totals 100% for its brand and does not represent email volume. Focus to view details; click the legend to pin a theme, click again or press Esc to clear.",
  },
  btbLegendAria: { zh: "主题高亮图例，不改变统计范围", en: "Theme highlight legend; does not change the statistics scope" },
  btbPinned: { zh: "已锁定", en: "Pinned" },
  btbAxisLeft: { zh: "品牌 / 主题占比", en: "Brand / Theme Share" },
  btbAxisRight: { zh: "100% · 总封数", en: "100% · Total" },
  btbSegLabel: {
    zh: "{brand} · {theme}：{count} 封，占该品牌 {pct}%，分母 {total} 封",
    en: "{brand} · {theme}: {count} emails, {pct}% of this brand, denominator {total} emails",
  },
  btbBrandShare: { zh: "品牌内占比", en: "Share within brand" },
  btbDenominator: { zh: "分母", en: "Denominator" },
  btbZeroNote: { zh: "该品牌三周窗口未收录邮件，不计算占比。", en: "No emails archived for this brand in the 3-week window; no share computed." },
  // Batch B: BrandDetailDialog (bdd)
  bddEyebrow: { zh: "品牌明细", en: "Brand Details" },
  bddDesc: {
    zh: "可见收录频率、主题结构与近期活动摘要；Esc 关闭并返回原位置。",
    en: "Visible archived frequency, theme structure and recent campaign summary. Esc closes and returns focus.",
  },
  bddCloseAria: { zh: "关闭品牌明细", en: "Close brand details" },
  bddOverview: { zh: "概览", en: "Overview" },
  bddTotalLabel: { zh: "总封数", en: "Total Emails" },
  bddPerDayLabel: { zh: "日均", en: "Daily Average" },
  bddPerDayUnit: { zh: "封 / 天", en: "emails / day" },
  bddStrategyLabel: { zh: "主要策略", en: "Main Strategy" },
  bddWeeklyTitle: { zh: "每周趋势", en: "Weekly Trend" },
  bddWeeklyNote: {
    zh: "横柱共用 0–{max} 封刻度；各周覆盖天数可能不同，不能将周总量直接当作发送效率。",
    en: "Bars share a 0–{max} email scale; weeks cover different numbers of days, so weekly totals are not directly comparable as send efficiency.",
  },
  bddThemesTitle: { zh: "主题结构", en: "Theme Structure" },
  bddCampaignsTitle: { zh: "每周活动摘要", en: "Weekly Campaign Summary" },
  // Batch B: MarketComparison (mc)
  mcTitle: { zh: "跨市场对比", en: "Cross-Market Comparison" },
  mcHint: {
    zh: "实时聚合（全期数据，窗口 {start} – {end}，共 {total} 封）。至少选择 2 个市场；品牌、主题、频率视图共用所选市场，0 封市场仍可比较。",
    en: "Real-time aggregation (full-period data, window {start} – {end}, {total} emails). Select at least 2 markets; brand, theme and frequency views share the selected markets, and 0-email markets remain comparable.",
  },
  mcHintFallback: {
    zh: "实时聚合（全期数据）。选择至少 2 个市场，按品牌、主题或频率任务进行对比。",
    en: "Real-time aggregation (full-period data). Select at least 2 markets to compare by brand, theme or frequency.",
  },
  mcEmpty: { zh: "暂无邮件", en: "No emails" },
  mcIncomplete: {
    zh: "数据未取齐（已取 {got} / 预期 {expected} 封），以下对比基于已取数据，不作完整市场排名。",
    en: "Data incomplete ({got} of {expected} emails fetched). The comparison below uses fetched data only and is not a complete market ranking.",
  },
  mcSelectLegend: { zh: "选择对比市场（至少 2 个）", en: "Select markets to compare (at least 2)" },
  mcTablistAria: { zh: "对比任务视图", en: "Comparison task views" },
  mcViewBrand: { zh: "品牌对比", en: "Brand" },
  mcViewBrandQ: { zh: "同一品牌，在哪些市场更活跃？", en: "In which markets is the same brand more active?" },
  mcViewBrandDesc: {
    zh: "先比较收录邮件数，再用周均核对频率。横柱在同一品牌行内共用刻度，不跨品牌比较柱长；收录覆盖差异不等于市场需求差异。",
    en: "Compare archived email counts first, then check frequency with the weekly average. Bars share a scale within each brand row only; coverage differences do not equal market demand differences.",
  },
  mcViewTheme: { zh: "主题对比", en: "Theme" },
  mcViewThemeQ: { zh: "不同市场的内容侧重有何区别？", en: "How does content focus differ across markets?" },
  mcViewThemeDesc: {
    zh: "先比较主题在各市场内的占比，避免市场总量不同造成误读；所有横柱均使用 0–100% 刻度，同时保留封数。",
    en: "Compare each theme's share within a market to avoid misreading different market totals; all bars use a 0–100% scale and counts are kept.",
  },
  mcViewFreq: { zh: "频率对比", en: "Frequency" },
  mcViewFreqQ: { zh: "同一品牌的触达节奏，在哪些周出现差异？", en: "In which weeks does the same brand's cadence diverge?" },
  mcViewFreqDesc: {
    zh: "选择一个品牌，沿同一时间轴比较市场。所有柱共用纵轴，避免每个市场独立放大；末桶可能不足 7 天，周均按实际窗口天数折算。",
    en: "Pick one brand and compare markets on the same timeline. All bars share one axis; the last bucket may be under 7 days and weekly averages use actual window days.",
  },
  mcStatusLine: {
    zh: "已选 {n} 个市场 · 样本 {sample} 封；全市场 {total} 封。{days} 天共同窗口。",
    en: "{n} markets selected · sample {sample} emails; all markets {total} emails. Shared {days}-day window.",
  },
  mcNeedTwo: {
    zh: "请至少选择 2 个市场进行对比，任务视图选择会保留。",
    en: "Select at least 2 markets to compare. Your task view selection is kept.",
  },
  mcHighestNote: {
    zh: "强调色＋「最高」表示当前指标的已选市场最大值（频率视图含所有周桶），含并列；描边仅表示当前查看，不代表效果。聚焦可读 Tooltip，Esc 关闭。",
    en: "Accent color + “Highest” marks the maximum among selected markets for the current metric (frequency view includes all week buckets), ties included. Outlines only mark the current view, not performance. Focus to read the tooltip; Esc dismisses.",
  },
  mcMatrixAriaTheme: { zh: "主题占比对比表，可横向滚动", en: "Theme share comparison table, horizontally scrollable" },
  mcMatrixAriaBrand: { zh: "品牌收录量对比表，可横向滚动", en: "Brand volume comparison table, horizontally scrollable" },
  mcCaptionTheme: { zh: "主题在各市场的封数与市场内占比", en: "Theme counts and within-market shares by market" },
  mcCaptionBrand: { zh: "各品牌在各市场的封数与周均", en: "Brand counts and weekly averages by market" },
  mcCaptionSuffix: {
    zh: "；全市场参照包含未选市场，最高仅比较已选市场，含并列。",
    en: "; the all-market reference includes unselected markets, while “highest” compares selected markets only, ties included.",
  },
  mcColTheme: { zh: "主题", en: "Theme" },
  mcColBrand: { zh: "品牌", en: "Brand" },
  mcMarketSample: { zh: "市场样本 {n} 封", en: "Market sample {n} emails" },
  mcColAllMarkets: { zh: "全市场参照", en: "All-Market Reference" },
  mcColAllMarketsSub: { zh: "包含未选市场", en: "Includes unselected markets" },
  mcHighest: { zh: "最高", en: "Highest" },
  mcHighestSuffix: { zh: "，已选市场最高，含并列", en: ", highest among selected markets, ties included" },
  mcCellLabel: {
    zh: "{label}，{market}：{count} 封，市场内占比 {share}，周均 {avg} 封",
    en: "{label}, {market}: {count} emails, within-market share {share}, weekly average {avg} emails",
  },
  mcCellLine: {
    zh: "{count} 封 · 市场内占比 {share} · 周均 {avg} 封",
    en: "{count} emails · within-market share {share} · weekly avg {avg} emails",
  },
  mcMarketDenominator: { zh: "市场分母", en: "Market denominator" },
  mcVisible: { zh: "可见收录", en: "visible archived" },
  mcWeeklyAvg: { zh: "周均", en: "Weekly avg" },
  mcMarketTotal: { zh: "市场合计", en: "Market Total" },
  mcFocusBrand: { zh: "聚焦品牌", en: "Focus Brand" },
  mcScaleNote: {
    zh: "共用刻度：0–{max} 封 / 周桶；标注「最高」包含并列。",
    en: "Shared scale: 0–{max} emails per week bucket; “Highest” includes ties.",
  },
  mcFreqRegionAria: {
    zh: "{brand}各市场周频率，可横向滚动，所有图共用刻度",
    en: "{brand} weekly frequency by market, horizontally scrollable, shared scale",
  },
  mcFreqSectionAria: { zh: "{brand} · {market}周频率", en: "{brand} · {market} weekly frequency" },
  mcFreqLabel: {
    zh: "{brand}，{market}，{week}，{start} 至 {end}：{count} 封，覆盖 {days} 天",
    en: "{brand}, {market}, {week}, {start} to {end}: {count} emails over {days} days",
  },
  mcFreqHighestSuffix: { zh: "，当前视图最高", en: ", highest in current view" },
  mcFreqLine: {
    zh: "{count} 封 · 覆盖 {days} 天 · 日均 {perDay} 封",
    en: "{count} emails · {days} days · daily avg {perDay} emails",
  },
  mcFreqLine3: {
    zh: "{start} – {end} · 共用刻度 0–{max} 封 · 可见收录",
    en: "{start} – {end} · shared scale 0–{max} emails · visible archived",
  },
  mcWeeksAria: { zh: "各周日期范围", en: "Date range of each week" },
  mcFreqFooter: {
    zh: "末桶按实际覆盖天数展示；悬停或聚焦柱子可查看日期和日均。0 表示未收录，不代表实际未发送。",
    en: "The last bucket shows actual covered days; hover or focus a bar for dates and daily average. 0 means not archived, not necessarily unsent.",
  },
  // Batch B: CalendarView (cal)
  calTitle: { zh: "日历热力图与关键词搜索", en: "Calendar Heatmap & Keyword Search" },
  calValidationFailed: { zh: "日历数据校验失败：", en: "Calendar data validation failed: " },
  calSubtitle: {
    zh: "{range} · {market} · {brands} 个有记录品牌 · 共 {total} 封邮件",
    en: "{range} · {market} · {brands} brands with records · {total} emails in total",
  },
  calBrandFilterAria: { zh: "按品牌筛选邮件", en: "Filter emails by brand" },
  calAllBrands: { zh: "全部", en: "All" },
  calMonthTablistAria: { zh: "选择月份", en: "Select month" },
  calDailyTitle: { zh: "{month}每日发信量", en: "{month} Daily Email Volume" },
  calScopeLine: {
    zh: "当前范围：{brand} · {market}，共 {count} 封",
    en: "Current scope: {brand} · {market}, {count} emails",
  },
  calLegendAria: {
    zh: "热力图颜色图例，无邮件为米白，有邮件时从每日 {min} 封到 {max} 封由浅至深",
    en: "Heatmap legend: beige for no emails; with emails, shades deepen from {min} to {max} emails per day",
  },
  calLegendLow: { zh: "少", en: "Less" },
  calLegendHigh: { zh: "多", en: "More" },
  calLegendRange: { zh: "全窗口非零范围 {min}–{max} 封", en: "Window non-zero range {min}–{max} emails" },
  calEmptyTitle: { zh: "当前筛选暂无邮件", en: "No emails for current filters" },
  calEmptyDesc: {
    zh: "{brand} · {market}在统计窗口 {range} 内暂无邮件（0 封），请切换市场或清除筛选。日历按日期统计邮件收录数。",
    en: "{brand} · {market} has no emails (0) in the statistics window {range}. Switch markets or clear the filters. The calendar counts archived emails by date.",
  },
  calRetry: { zh: "重新拉取", en: "Retry" },
  calResetFilters: { zh: "重置品牌与市场筛选", en: "Reset brand & market filters" },
  calCaption: {
    zh: "{month}邮件日历，颜色深浅使用{start}至{end}的全局刻度",
    en: "{month} email calendar; shading uses the global scale from {start} to {end}",
  },
  calDay0: { zh: "周日", en: "Sun" },
  calDay1: { zh: "周一", en: "Mon" },
  calDay2: { zh: "周二", en: "Tue" },
  calDay3: { zh: "周三", en: "Wed" },
  calDay4: { zh: "周四", en: "Thu" },
  calDay5: { zh: "周五", en: "Fri" },
  calDay6: { zh: "周六", en: "Sat" },
  calOutsideAria: { zh: "{date}，不在统计窗口内", en: "{date}, outside the statistics window" },
  calDayAria: { zh: "{date}，{brand} · {market} {count} 封邮件", en: "{date}, {brand} · {market} {count} emails" },
  calDayTitle: { zh: "{date} · {brand} · {market} {count} 封邮件", en: "{date} · {brand} · {market} {count} emails" },
  calCloseDetail: { zh: "收起详情", en: "Collapse" },
  calFieldDate: { zh: "日期", en: "Date" },
  calFieldBrand: { zh: "品牌", en: "Brand" },
  calFieldMarket: { zh: "市场", en: "Market" },
  calFieldTheme: { zh: "主题", en: "Theme" },
  calFieldKeywords: { zh: "关键词", en: "Keywords" },
  calFieldOriginal: { zh: "原文", en: "Original" },
  calNoKeywords: { zh: "无关键词", en: "No keywords" },
  calOpenOriginal: { zh: "打开原文", en: "Open Original" },
  calOpenOriginalAria: {
    zh: "打开 {brand} {date} {market}第 {n} 封邮件原文（新窗口打开）",
    en: "Open the original of email {n} from {brand} on {date} in {market} (opens in a new window)",
  },
  calNoOriginal: { zh: "暂无原文链接", en: "No original link" },
  calDayEmptyTitle: { zh: "当日无邮件", en: "No Emails That Day" },
  calDayEmptyDesc: {
    zh: "{date} · {brand} · {market}暂无邮件记录，请返回日历选择其他日期。",
    en: "{date} · {brand} · {market} has no email records. Return to the calendar and pick another date.",
  },
  calBackToCalendar: { zh: "返回日历", en: "Back to Calendar" },
  calSearchLabel: { zh: "关键词搜索", en: "Keyword Search" },
  calSearchHelp: {
    zh: "搜索范围跟随品牌与市场筛选；支持完整词或部分词，例如 dress、sale、new。",
    en: "Search follows the brand and market filters; whole or partial words are supported, e.g. dress, sale, new.",
  },
  calSearchPlaceholder: { zh: "输入关键词", en: "Enter keywords" },
  calSearchFound: { zh: "找到 {n} 个日期与品牌与市场组合", en: "Found {n} date–brand–market combinations" },
  calViewDay: { zh: "查看当日", en: "View Day" },
  calViewDayAria: {
    zh: "查看 {date} 当日邮件详情（搜索命中 {brand} · {market}）",
    en: "View email details for {date} (search hit {brand} · {market})",
  },
  calNoMatchTitle: { zh: "无匹配", en: "No Matches" },
  calNoMatchDesc: {
    zh: "当前品牌与市场筛选内，没有包含关键词“{term}”的邮件。支持完整词或部分词，可清除关键词后重新搜索。",
    en: "No emails containing “{term}” within the current brand and market filters. Whole or partial words are supported; clear the keyword to search again.",
  },
  calClearSearch: { zh: "清除关键词", en: "Clear Keyword" },
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

let currentLocale: Locale = getInitialLocale();

/** 当前语言的模块级单例：供 getMarketLabel 等非组件纯函数读取（由 LocaleProvider 同步）。 */
export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  // 渲染期同步单例：纯函数消费者在同一次渲染即可读到新语言（赋值幂等）。
  currentLocale = locale;

  useEffect(() => {
    currentLocale = locale;
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
