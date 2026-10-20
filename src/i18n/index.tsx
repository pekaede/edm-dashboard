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
  | "calClearSearch"
  // Batch C: state components (st shared, ss snapshot)
  | "stEmptyMarketTitle"
  | "stEmptyNoMatch"
  | "stEmptyMarketDesc"
  | "stEmptyFilterDesc"
  | "stRetryFetch"
  | "stLoadingTitle"
  | "stLoadingDesc"
  | "stConfigBadge"
  | "stConfigTitleEmails"
  | "stConfigDescEmails"
  | "stRecheck"
  | "stIncompleteBadge"
  | "stIncompleteTitle"
  | "stIncompleteDescToken"
  | "stIncompleteDescPlain"
  | "stRefetchFull"
  | "stNetworkBadge"
  | "stErrorTitleEmails"
  | "stErrorDescEmails"
  | "stRetryLoad"
  | "ssEmptyTitle"
  | "ssEmptyDesc"
  | "ssLoadingDefault"
  | "ssLoadingDesc"
  | "ssConfigTitle"
  | "ssConfigDesc"
  | "ssIncompleteTitle"
  | "ssIncompleteDesc"
  | "ssErrorTitle"
  | "ssErrorDesc"
  // Batch C: MarkdownReport chrome (mr) — report body stays generated content
  | "mrEmptyTitle"
  | "mrEmptyDesc"
  | "mrRetry"
  | "mrSwitchAll"
  | "mrEyebrow"
  | "mrTitle"
  | "mrSubNote"
  | "mrSummaryTitle"
  | "mrEvidence"
  | "mrAction"
  | "mrWatch"
  | "mrNextStep"
  | "mrAppendix"
  | "mrAppendixSub"
  | "mrFullReport"
  | "mrTableAria"
  // Batch C: ExtendedEmailFilter (ef)
  | "efTitle"
  | "efHint"
  | "efEmptyMarketDesc"
  | "efSwitchAll"
  | "efRetry"
  | "efIntro"
  | "efUnitEmails"
  | "efFilterByBrand"
  | "efFilterByTheme"
  | "efFilterByDate"
  | "efBrandGroupAria"
  | "efThemeGroupAria"
  | "efChipSelectedSuffix"
  | "efBrandChipAria"
  | "efThemeChipAria"
  | "efDateGroupAria"
  | "efRangeAll"
  | "efRange7d"
  | "efRange3w"
  | "efRange30d"
  | "efDateFrom"
  | "efDateTo"
  | "efClearDates"
  | "efSearchLabel"
  | "efSearchPlaceholder"
  | "efClearSearchAria"
  | "efFavOnly"
  | "efCollapseAll"
  | "efExpandAll"
  | "efExportAria"
  | "efExportLabel"
  | "efNoResultTitle"
  | "efNoResultDesc"
  | "efResetFilterSearch"
  | "efTableAria"
  | "efCaption"
  | "efColFav"
  | "efColDate"
  | "efColBrand"
  | "efColMarket"
  | "efColTheme"
  | "efColSubject"
  | "efColPreheader"
  | "efColKeywords"
  | "efColOriginal"
  | "efFavAria"
  | "efFavAdd"
  | "efFavRemove"
  | "efOriginalAria"
  | "efShownPrefix"
  | "efSortDesc"
  | "efLoadMore"
  | "efLoadedAll"
  | "efUnlimited"
  | "efDateRange"
  | "efFilterSummary"
  | "efSummaryDate"
  | "efSummaryFav"
  | "efSummarySearch"
  | "efKwAria"
  | "efCollapse"
  | "efExpand"
  | "efExpandAllBtn"
  // Batch C: ContentAnalysis (ca)
  | "caTacUrgency"
  | "caTacDiscount"
  | "caTacSocialProof"
  | "caTacNewness"
  | "caTacCuriosity"
  | "caTacPersonalization"
  | "caTacBenefit"
  | "caTacExclusivity"
  | "caTacSeasonal"
  | "caLayCentered"
  | "caLayLeftAligned"
  | "caLaySplit"
  | "caLayFullBleed"
  | "caLayGrid"
  | "caRatioTextHeavy"
  | "caRatioBalanced"
  | "caRatioImageHeavy"
  | "caCtaTop"
  | "caCtaCenter"
  | "caCtaBottom"
  | "caCtaBottomRight"
  | "caCtaNone"
  | "caTrendFashion"
  | "caTrendTrend"
  | "caTrendHotspot"
  | "caTrendSeasonal"
  | "caTrendMarketing"
  | "caShareAria"
  | "caOutcomeLine"
  | "caOutcomeExpired"
  | "caNoSubjects"
  | "caTimeout"
  | "caSrcEmails"
  | "caSrcAnalysis"
  | "caNotEnabledCol"
  | "caNotEnabledView"
  | "caRangeLabel"
  | "caRangeAria"
  | "caPeriod3w"
  | "caPeriod3m"
  | "caBrandAria"
  | "caAllBrands"
  | "caPickMarketTitle"
  | "caPickMarketDesc"
  | "caLoading"
  | "caWindowLine"
  | "caNotEnabledTitle"
  | "caNotEnabledDesc"
  | "caRetryBtn"
  | "caFailedTitle"
  | "caMetaWindow"
  | "caEmptyWindowTitle"
  | "caEmptyWindowDesc"
  | "caMetaMarket"
  | "caMetaBrand"
  | "caMetaSampleAll"
  | "caMetaSampleBrand"
  | "caCovCollected"
  | "caCovSubject"
  | "caCovBanner"
  | "caCovTitle"
  | "caCovHint"
  | "caCovCollectedTitle"
  | "caCovCollectedSub"
  | "caCovSubjectTitle"
  | "caCovSubjectSub"
  | "caCovBannerTitle"
  | "caCovBannerSub"
  | "caRawLine"
  | "caOutcomeSubject"
  | "caOutcomeBanner"
  | "caOutcomeBannerExtra"
  | "caOutcomeBannerRate"
  | "caSubjectTitle"
  | "caAnalyzedHint"
  | "caLenTitle"
  | "caLenRange"
  | "caEmojiAvgTitle"
  | "caEmojiRate"
  | "caPersTitle"
  | "caPersSub"
  | "caEmojiCountTitle"
  | "caAnalyzedSamples"
  | "caTacticsHeading"
  | "caTacticsHint"
  | "caNoTactics"
  | "caDetailCount"
  | "caCommonPatterns"
  | "caExamplePrefix"
  | "caNewPatterns"
  | "caFirstSeen"
  | "caFewSamples"
  | "caAllSubjectsHeading"
  | "caCtaVerbsHeading"
  | "caNoCtaVerbs"
  | "caDiscountHeading"
  | "caOccurTitle"
  | "caNoDiscount"
  | "caTrendHeading"
  | "caTrendChipTitle"
  | "caNoTrend"
  | "caNoSubjectResults"
  | "caBannerTitle"
  | "caBannerCtaTitle"
  | "caBannerCtaSub"
  | "caColorKindsTitle"
  | "caColorKindsSub"
  | "caColorsHeading"
  | "caColorAria"
  | "caColorUnit"
  | "caColorCount"
  | "caNoColors"
  | "caCompositionHeading"
  | "caNoComposition"
  | "caRatioHeading"
  | "caNoRatio"
  | "caCtaPlacementHeading"
  | "caNoCtaPlacement"
  | "caSeasonalHeading"
  | "caNoSeasonal"
  | "caNoBannerResults"
  | "caColorGlyph";

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
  // Batch C: state components (st shared, ss snapshot)
  stEmptyMarketTitle: { zh: "{market}暂无收录邮件", en: "No archived emails for {market}" },
  stEmptyNoMatch: { zh: "未找到匹配邮件", en: "No matching emails found" },
  stEmptyMarketDesc: {
    zh: "该市场在当前统计窗口内暂无邮件收录记录，请切换其他站点或清除筛选条件。",
    en: "This market has no archived emails in the current statistics window. Switch sites or clear the filters.",
  },
  stEmptyFilterDesc: {
    zh: "当前筛选条件下暂无符合条件的邮件记录，请尝试调整筛选条件。",
    en: "No email records match the current filters. Try adjusting them.",
  },
  stRetryFetch: { zh: "重新拉取", en: "Retry" },
  stLoadingTitle: { zh: "正在载入邮件数据…", en: "Loading email data…" },
  stLoadingDesc: {
    zh: "正在连接 Supabase 校验数据完整性与记录总量，请稍候。",
    en: "Connecting to Supabase to verify data integrity and totals. Please wait.",
  },
  stConfigBadge: { zh: "配置缺失", en: "Missing Configuration" },
  stConfigTitleEmails: { zh: "Supabase 环境配置缺失", en: "Missing Supabase Configuration" },
  stConfigDescEmails: {
    zh: "缺少 Supabase 本地环境配置，请检查环境变量 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。",
    en: "Supabase environment configuration is missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
  },
  stRecheck: { zh: "重新检测配置", en: "Recheck Configuration" },
  stIncompleteBadge: { zh: "数据未取齐", en: "Incomplete Data" },
  stIncompleteTitle: { zh: "邮件数据载入不完整", en: "Email Data Loaded Incompletely" },
  stIncompleteDescToken: {
    zh: "当前已接收 {loaded} 封邮件，预期完整记录应为 {expected} 封。部分数据分页拉取中断，可点击重新拉取以补全完整记录。",
    en: "{loaded} emails received so far; the complete record should be {expected}. Paginated fetching was interrupted — retry to complete the records.",
  },
  stIncompleteDescPlain: {
    zh: "邮件数据分页拉取未取齐，部分记录中断，可点击重新拉取以补全完整记录。",
    en: "Paginated email fetching was incomplete and some records were interrupted. Retry to complete the records.",
  },
  stRefetchFull: { zh: "重新拉取完整数据", en: "Refetch Complete Data" },
  stNetworkBadge: { zh: "网络请求失败", en: "Network Request Failed" },
  stErrorTitleEmails: { zh: "邮件数据加载失败", en: "Failed to Load Email Data" },
  stErrorDescEmails: {
    zh: "网络连接异常或请求超时，未能成功获取邮件数据，请检查网络连接后重试。",
    en: "Network error or request timeout — email data could not be fetched. Check your connection and retry.",
  },
  stRetryLoad: { zh: "重试加载", en: "Retry Loading" },
  ssEmptyTitle: { zh: "暂无快照数据", en: "No Snapshot Data" },
  ssEmptyDesc: { zh: "当前无可用快照记录。", en: "No snapshot records are currently available." },
  ssLoadingDefault: { zh: "正在加载快照数据…", en: "Loading snapshot data…" },
  ssLoadingDesc: { zh: "正在拉取数据视图，请稍候。", en: "Fetching the data view. Please wait." },
  ssConfigTitle: { zh: "快照环境配置缺失", en: "Missing Snapshot Configuration" },
  ssConfigDesc: { zh: "缺少必要的环境变量配置，请检查相关设置。", en: "Required environment variables are missing. Check the related settings." },
  ssIncompleteTitle: { zh: "快照数据不完整", en: "Snapshot Data Incomplete" },
  ssIncompleteDesc: {
    zh: "快照数据未能完全拉取，请重试以重新同步完整数据。",
    en: "Snapshot data was not fully fetched. Retry to resync the complete data.",
  },
  ssErrorTitle: { zh: "快照加载失败", en: "Failed to Load Snapshot" },
  ssErrorDesc: { zh: "网络连接异常，未能获取快照数据，请重试。", en: "Network error — snapshot data could not be fetched. Please retry." },
  // Batch C: MarkdownReport chrome (mr)
  mrEmptyTitle: { zh: "{market} · OnePage 报告暂无记录", en: "{market} · No records for the OnePage report" },
  mrEmptyDesc: {
    zh: "{range} 内暂无邮件（0 封），不生成主题或发送频次结论。可切换市场或重新拉取数据。",
    en: "No emails (0) within {range}; no theme or frequency conclusions are generated. Switch markets or retry.",
  },
  mrRetry: { zh: "重新拉取", en: "Retry" },
  mrSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  mrEyebrow: { zh: "先决策，再查证 · {market}", en: "Decide first, verify second · {market}" },
  mrTitle: { zh: "EDM 竞品 OnePage", en: "EDM Competitor OnePage" },
  mrSubNote: {
    zh: "{range} · 固定截止 {end}。可见收录不等于实际全量发送，也不代表营销效果。",
    en: "{range} · fixed cutoff {end}. Visible archived emails do not equal actual total sends, nor marketing effectiveness.",
  },
  mrSummaryTitle: { zh: "决策摘要", en: "Decision Summary" },
  mrEvidence: { zh: "证据：", en: "Evidence: " },
  mrAction: { zh: "建议：", en: "Recommendation: " },
  mrWatch: { zh: "值得关注", en: "Worth Watching" },
  mrNextStep: { zh: "下一步：", en: "Next step: " },
  mrAppendix: { zh: "完整报告附录", en: "Full Report Appendix" },
  mrAppendixSub: {
    zh: "统计口径、完整数据表与验证建议 · 点击展开",
    en: "Definitions, full data tables and validation advice · click to expand",
  },
  mrFullReport: { zh: "完整报告", en: "Full Report" },
  mrTableAria: { zh: "报告数据表：{headers}，可横向滚动", en: "Report data table: {headers}, horizontally scrollable" },
  // Batch C: ExtendedEmailFilter (ef)
  efTitle: { zh: "3 个月邮件筛选", en: "3-Month Email Filter" },
  efHint: { zh: "{range} · {market} · 逐封记录按日期倒序", en: "{range} · {market} · records sorted by date, newest first" },
  efEmptyMarketDesc: {
    zh: "该市场在当前统计窗口（{range}）内暂无公开邮件收录记录。看板统计总量均为 Milled 公开收录样本，非品牌私域全量投递。",
    en: "This market has no publicly archived emails in the current statistics window ({range}). All dashboard totals are Milled public samples, not full private sends.",
  },
  efSwitchAll: { zh: "切换至全部市场", en: "Switch to all markets" },
  efRetry: { zh: "重新拉取", en: "Retry" },
  efIntro: {
    zh: "从品牌与主题切入三个月邮件触达（含服务/法务通知），支持关键词高亮搜索、收藏标记与结果全量导出。",
    en: "Explore three months of email outreach by brand and theme (including service/legal notices), with keyword highlight search, favorites and full-result export.",
  },
  efUnitEmails: { zh: "封邮件", en: "emails" },
  efFilterByBrand: { zh: "按品牌筛选", en: "Filter by Brand" },
  efFilterByTheme: { zh: "按主题筛选", en: "Filter by Theme" },
  efFilterByDate: { zh: "按日期筛选", en: "Filter by Date" },
  efBrandGroupAria: { zh: "按邮件品牌筛选", en: "Filter emails by brand" },
  efThemeGroupAria: { zh: "按邮件主题筛选", en: "Filter emails by theme" },
  efChipSelectedSuffix: { zh: "，当前已选中，再次点击清除筛选", en: ", currently selected; click again to clear" },
  efBrandChipAria: { zh: "{brand}品牌{selected}", en: "{brand} brand{selected}" },
  efThemeChipAria: { zh: "{label}主题{selected}", en: "{label} theme{selected}" },
  efDateGroupAria: { zh: "日期快捷范围", en: "Quick date ranges" },
  efRangeAll: { zh: "全部日期", en: "All Dates" },
  efRange7d: { zh: "最近 7 天", en: "Last 7 Days" },
  efRange3w: { zh: "最近三周", en: "Last 3 Weeks" },
  efRange30d: { zh: "最近一个月", en: "Last Month" },
  efDateFrom: { zh: "起始", en: "From" },
  efDateTo: { zh: "结束", en: "To" },
  efClearDates: { zh: "清除日期", en: "Clear Dates" },
  efSearchLabel: { zh: "搜索邮件关键词、品牌或主题", en: "Search email keywords, brands or themes" },
  efSearchPlaceholder: { zh: "搜索邮件关键词、品牌、主题或日期...", en: "Search keywords, brands, themes or dates..." },
  efClearSearchAria: { zh: "清空搜索内容", en: "Clear search" },
  efFavOnly: { zh: "仅看收藏 ({n})", en: "Favorites only ({n})" },
  efCollapseAll: { zh: "收起所有内容", en: "Collapse All" },
  efExpandAll: { zh: "展开全部内容", en: "Expand All" },
  efExportAria: { zh: "导出当前全部筛选结果为 CSV，共 {n} 封邮件", en: "Export all current filtered results as CSV, {n} emails" },
  efExportLabel: { zh: "导出 CSV ({n})", en: "Export CSV ({n})" },
  efNoResultTitle: { zh: "无符合当前条件的邮件", en: "No Emails Match the Current Filters" },
  efNoResultDesc: {
    zh: "{summary}。当前暂无符合该组合条件的公开邮件样本。你可以重置条件或清空搜索词。",
    en: "{summary}. No public email samples match this combination yet. Reset the filters or clear the search term.",
  },
  efResetFilterSearch: { zh: "重置筛选与搜索", en: "Reset Filters & Search" },
  efTableAria: { zh: "{summary}的邮件列表，可横向滚动", en: "Email list for {summary}, horizontally scrollable" },
  efCaption: { zh: "{summary}的 3 个月邮件记录，按日期从新到旧排列", en: "3-month email records for {summary}, sorted newest to oldest" },
  efColFav: { zh: "收藏", en: "Favorite" },
  efColDate: { zh: "日期", en: "Date" },
  efColBrand: { zh: "品牌", en: "Brand" },
  efColMarket: { zh: "市场", en: "Market" },
  efColTheme: { zh: "主题", en: "Theme" },
  efColSubject: { zh: "标题", en: "Subject" },
  efColPreheader: { zh: "副标题", en: "Preheader" },
  efColKeywords: { zh: "关键词", en: "Keywords" },
  efColOriginal: { zh: "原文", en: "Original" },
  efFavAria: { zh: "{action} {brand} {date} 的邮件", en: "{action} the email from {brand} on {date}" },
  efFavAdd: { zh: "收藏", en: "Favorite" },
  efFavRemove: { zh: "取消收藏", en: "Unfavorite" },
  efOriginalAria: { zh: "查看 {brand} {date} 的邮件原文（新窗口打开）", en: "View the original email from {brand} on {date} (opens in a new window)" },
  efShownPrefix: { zh: "已显示", en: "Showing" },
  efSortDesc: { zh: "按日期倒序", en: "Newest first" },
  efLoadMore: { zh: "加载更多（剩余 {n} 封）", en: "Load more ({n} remaining)" },
  efLoadedAll: { zh: "已加载全部", en: "All Loaded" },
  efUnlimited: { zh: "不限", en: "Any" },
  efDateRange: { zh: "{from} 至 {to}", en: "{from} to {to}" },
  efFilterSummary: {
    zh: "市场：{market}，品牌：{brand}，主题：{theme}{date}{fav}{search}",
    en: "Market: {market}, Brand: {brand}, Theme: {theme}{date}{fav}{search}",
  },
  efSummaryDate: { zh: "，日期：{range}", en: ", Date: {range}" },
  efSummaryFav: { zh: "，仅看收藏", en: ", Favorites only" },
  efSummarySearch: { zh: "，搜索：“{q}”", en: ", Search: “{q}”" },
  efKwAria: { zh: "{action} {brand} {date} 的全部关键词", en: "{action} all keywords for {brand} on {date}" },
  efCollapse: { zh: "收起", en: "Collapse" },
  efExpand: { zh: "展开", en: "Expand" },
  efExpandAllBtn: { zh: "展开全部", en: "Expand all" },
  // Batch C: ContentAnalysis (ca) — enum labels
  caTacUrgency: { zh: "紧迫感 (Urgency)", en: "Urgency" },
  caTacDiscount: { zh: "折扣促销 (Discount)", en: "Discount" },
  caTacSocialProof: { zh: "社会认同 (Social Proof)", en: "Social Proof" },
  caTacNewness: { zh: "新品上架 (Newness)", en: "Newness" },
  caTacCuriosity: { zh: "好奇悬念 (Curiosity)", en: "Curiosity" },
  caTacPersonalization: { zh: "个性化 (Personalization)", en: "Personalization" },
  caTacBenefit: { zh: "利益承诺 (Benefit)", en: "Benefit" },
  caTacExclusivity: { zh: "专享特权 (Exclusivity)", en: "Exclusivity" },
  caTacSeasonal: { zh: "节日时效 (Seasonal)", en: "Seasonal" },
  caLayCentered: { zh: "居中对称 (Centered)", en: "Centered" },
  caLayLeftAligned: { zh: "左侧对齐 (Left-aligned)", en: "Left-aligned" },
  caLaySplit: { zh: "左右/图文分栏 (Split)", en: "Split" },
  caLayFullBleed: { zh: "满版全屏 (Full-bleed)", en: "Full-bleed" },
  caLayGrid: { zh: "网格拼贴 (Grid)", en: "Grid" },
  caRatioTextHeavy: { zh: "文字主导 (Text-heavy)", en: "Text-heavy" },
  caRatioBalanced: { zh: "图文均衡 (Balanced)", en: "Balanced" },
  caRatioImageHeavy: { zh: "图片主导 (Image-heavy)", en: "Image-heavy" },
  caCtaTop: { zh: "顶部 (Top)", en: "Top" },
  caCtaCenter: { zh: "居中 (Center)", en: "Center" },
  caCtaBottom: { zh: "底部 (Bottom)", en: "Bottom" },
  caCtaBottomRight: { zh: "右下角 (Bottom-right)", en: "Bottom-right" },
  caCtaNone: { zh: "未标明/无明显按钮 (None)", en: "None" },
  caTrendFashion: { zh: "时尚", en: "Fashion" },
  caTrendTrend: { zh: "趋势", en: "Trend" },
  caTrendHotspot: { zh: "热点", en: "Hotspot" },
  caTrendSeasonal: { zh: "季节", en: "Seasonal" },
  caTrendMarketing: { zh: "营销", en: "Marketing" },
  // Batch C: ContentAnalysis (ca) — chrome
  caShareAria: { zh: "{label} 占比", en: "{label} share" },
  caOutcomeLine: {
    zh: "成功 {s} 封 ({sp}) · 排队中 {q} 封 ({qp}) · 失败 {f} 封 ({fp}) · 未采集 {m} 封 ({mp}) · 已跳过 {sk} 封 ({skp})",
    en: "Succeeded {s} ({sp}) · Queued {q} ({qp}) · Failed {f} ({fp}) · Not collected {m} ({mp}) · Skipped {sk} ({skp})",
  },
  caOutcomeExpired: { zh: "其中结果过期（成功但无分析时间）{n} 封", en: "Of these, {n} results are stale (succeeded without an analysis time)" },
  caNoSubjects: { zh: "该分类下暂无可展示的标题", en: "No subjects to show in this category yet" },
  caTimeout: { zh: "{label}请求超时（{s} 秒）。", en: "{label} request timed out ({s}s)." },
  caSrcEmails: { zh: "邮件", en: "Emails" },
  caSrcAnalysis: { zh: "内容分析", en: "Content analysis" },
  caNotEnabledCol: {
    zh: "emails 表缺少 subject / preheader / banner_url 列，迁移尚未执行：{detail}",
    en: "The emails table is missing subject / preheader / banner_url columns; the migration has not run: {detail}",
  },
  caNotEnabledView: {
    zh: "内容分析视图 email_content_analysis_current 不存在或未迁移：{detail}",
    en: "The email_content_analysis_current view does not exist or is not migrated: {detail}",
  },
  caRangeLabel: { zh: "时间范围", en: "Time Range" },
  caRangeAria: { zh: "选择内容分析统计周期", en: "Select the content analysis period" },
  caPeriod3w: { zh: "三周", en: "3 Weeks" },
  caPeriod3m: { zh: "三个月", en: "3 Months" },
  caBrandAria: { zh: "选择品牌", en: "Select brand" },
  caAllBrands: { zh: "全部品牌", en: "All Brands" },
  caPickMarketTitle: { zh: "请选择单个市场查看内容 AI 分析", en: "Select a single market to view content AI analysis" },
  caPickMarketDesc: {
    zh: "覆盖率按同市场同窗口的 emails 样本计算；当前为全部市场视图，请先在顶部站点选择器选一个市场。",
    en: "Coverage is computed from emails samples in the same market and window. You are in the all-markets view — pick a market in the top site selector first.",
  },
  caLoading: { zh: "正在加载 {site} 市场内容 AI 分析数据...", en: "Loading content AI analysis data for the {site} market..." },
  caWindowLine: { zh: "窗口范围：{start} 至 {end}", en: "Window: {start} to {end}" },
  caNotEnabledTitle: { zh: "内容 AI 分析尚未启用", en: "Content AI Analysis Not Enabled Yet" },
  caNotEnabledDesc: {
    zh: "{detail}完成迁移后刷新即可查看；已有原始内容仍按未采集计入覆盖率。",
    en: "{detail} Refresh after the migration to view it; existing raw content still counts as not collected in coverage.",
  },
  caRetryBtn: { zh: "重新尝试", en: "Try Again" },
  caFailedTitle: { zh: "内容 AI 分析数据拉取失败", en: "Failed to Fetch Content AI Analysis Data" },
  caMetaWindow: { zh: "日期窗口：{start} ~ {end}", en: "Date window: {start} ~ {end}" },
  caEmptyWindowTitle: { zh: "窗口内无邮件", en: "No Emails in Window" },
  caEmptyWindowDesc: {
    zh: "市场 {site} 在所选日期窗口（{start} ~ {end}）内暂无邮件样本，无法计算覆盖率。",
    en: "The {site} market has no email samples in the selected window ({start} ~ {end}), so coverage cannot be computed.",
  },
  caMetaMarket: { zh: "市场：{site}", en: "Market: {site}" },
  caMetaBrand: { zh: "品牌：{brand}", en: "Brand: {brand}" },
  caMetaSampleAll: { zh: "（同市场同窗口 emails 样本：{n} 封）", en: "(emails samples in the same market & window: {n})" },
  caMetaSampleBrand: { zh: "（同市场同窗口同品牌 emails 样本：{n} 封）", en: "(emails samples for the same brand, market & window: {n})" },
  caCovCollected: { zh: "采集覆盖：", en: "Collection coverage: " },
  caCovSubject: { zh: "标题成功：", en: "Subject success: " },
  caCovBanner: { zh: "Banner 成功：", en: "Banner success: " },
  caCovTitle: { zh: "覆盖率", en: "Coverage" },
  caCovHint: {
    zh: "分母统一为同市场同窗口 emails 样本 {n} 封；标题/Banner 分布占比的分母是各自已分析封数，缺失行不计入分布。",
    en: "The denominator is uniformly the {n} emails samples in the same market & window; subject/banner distribution shares use their own analyzed counts, and missing rows are excluded.",
  },
  caCovCollectedTitle: { zh: "采集覆盖率", en: "Collection Coverage" },
  caCovCollectedSub: { zh: "{c} / {n} 封已采集任一原始内容", en: "{c} / {n} emails with any raw content collected" },
  caCovSubjectTitle: { zh: "标题成功率", en: "Subject Success Rate" },
  caCovSubjectSub: { zh: "{c} / {n} 封标题分析成功", en: "{c} / {n} subjects analyzed successfully" },
  caCovBannerTitle: { zh: "Banner 成功率", en: "Banner Success Rate" },
  caCovBannerSub: { zh: "{c} / {n} 封 Banner 分析成功", en: "{c} / {n} banners analyzed successfully" },
  caRawLine: {
    zh: "原始内容采集：有标题 {a} 封 · 有副标题 {b} 封 · 有 Banner 图 {c} 封 · 无任一原始内容 {d} 封（未采集的邮件不进入分析，标题成功率也不把它们算成“无 CTA”）。",
    en: "Raw content collection: {a} with subjects · {b} with preheaders · {c} with banner images · {d} with none (uncollected emails never enter analysis, and the subject success rate does not count them as “no CTA”).",
  },
  caOutcomeSubject: { zh: "标题分析状态", en: "Subject Analysis Status" },
  caOutcomeBanner: { zh: "Banner 分析状态", en: "Banner Analysis Status" },
  caOutcomeBannerExtra: { zh: "无 Banner 图 {n} 封", en: "{n} without a banner image" },
  caOutcomeBannerRate: { zh: " · 在有 Banner 图的邮件中成功率 {r}%", en: " · success rate among emails with a banner image: {r}%" },
  caSubjectTitle: { zh: "主副标题策略分析", en: "Subject & Preheader Strategy" },
  caAnalyzedHint: {
    zh: "已分析 {n} 封（分布占比按已分析计） · 未采集/排队/失败见覆盖率",
    en: "{n} analyzed (shares are based on analyzed emails) · see Coverage for not-collected / queued / failed",
  },
  caLenTitle: { zh: "标题平均字符", en: "Avg. Subject Length" },
  caLenRange: { zh: "范围 {min} ~ {max}", en: "Range {min} ~ {max}" },
  caEmojiAvgTitle: { zh: "平均 Emoji", en: "Avg. Emojis" },
  caEmojiRate: { zh: "含 Emoji 占比 {r}%", en: "{r}% contain emojis" },
  caPersTitle: { zh: "个性化元素", en: "Personalization Elements" },
  caPersSub: { zh: "强信号：模板变量/为你定制", en: "Strong signals: template variables / made-for-you" },
  caEmojiCountTitle: { zh: "含 Emoji 封数", en: "Emails with Emojis" },
  caAnalyzedSamples: { zh: "共 {n} 封已分析样本", en: "{n} analyzed samples in total" },
  caTacticsHeading: { zh: "标题策略分布 (Tactics)", en: "Tactic Distribution" },
  caTacticsHint: {
    zh: "点击某个分类，展开该类型下的全部标题/副标题与句式总结",
    en: "Click a category to expand all its subjects/preheaders and the pattern summary",
  },
  caNoTactics: { zh: "暂未标记任何策略标签", en: "No tactic tags marked yet" },
  caDetailCount: { zh: "共 {n} 封", en: "{n} emails" },
  caCommonPatterns: { zh: "常用句式（数字/价格已抽象为占位符）", en: "Common patterns (numbers/prices abstracted as placeholders)" },
  caExamplePrefix: { zh: "例：", en: "Example: " },
  caNewPatterns: { zh: "新句式（最近 7 天内首次出现）", en: "New patterns (first seen in the last 7 days)" },
  caFirstSeen: { zh: "首见 {d}", en: "First seen {d}" },
  caFewSamples: { zh: "该分类样本较少，未形成可归纳的句式", en: "Too few samples in this category to generalize patterns" },
  caAllSubjectsHeading: { zh: "全部标题 / 副标题", en: "All Subjects / Preheaders" },
  caCtaVerbsHeading: { zh: "CTA 高频动词 Top", en: "Top CTA Verbs" },
  caNoCtaVerbs: {
    zh: "已分析样本中无提取到的行动召唤动词（未分析行不计入）",
    en: "No call-to-action verbs extracted from analyzed samples (unanalyzed rows excluded)",
  },
  caDiscountHeading: { zh: "折扣促销话术 (去重收录)", en: "Discount Phrases (deduplicated)" },
  caOccurTitle: { zh: "出现 {n} 次", en: "Appears {n} times" },
  caNoDiscount: { zh: "已分析样本中未检测到明确的折扣短语", en: "No explicit discount phrases detected in analyzed samples" },
  caTrendHeading: { zh: "趋势 · 热点 · 季节词 (去重收录)", en: "Trend · Hotspot · Seasonal Terms (deduplicated)" },
  caTrendChipTitle: { zh: "出现 {n} 次，点击查看相关邮件", en: "Appears {n} times — click to view related emails" },
  caNoTrend: {
    zh: "已分析样本中暂未抽取到趋势/热点词（新版分析补跑后自动填充）",
    en: "No trend/hotspot terms extracted yet (filled automatically after the new analysis backfill)",
  },
  caNoSubjectResults: {
    zh: "该窗口内 {n} 封邮件尚无标题分析成功结果（成功 0 封；排队/失败/未采集见上方覆盖率）。",
    en: "None of the {n} emails in this window has a successful subject analysis yet (0 succeeded; see Coverage above for queued / failed / not collected).",
  },
  caBannerTitle: { zh: "Banner 视觉风格分析", en: "Banner Visual Style" },
  caBannerCtaTitle: { zh: "Banner CTA 包含率（视觉）", en: "Banner CTA Presence (visual)" },
  caBannerCtaSub: {
    zh: "共 {a} / {b} 封已分析；仅指视觉可见按钮，不代表可点击",
    en: "{a} / {b} analyzed; refers only to visually visible buttons, not clickability",
  },
  caColorKindsTitle: { zh: "识别主色族种类", en: "Dominant Color Families Found" },
  caColorKindsSub: { zh: "色族标签按频次降序 Top（模型不直接编 Hex）", en: "Color-family labels by frequency (the model never invents Hex values)" },
  caColorsHeading: { zh: "视觉主色族分布 (Dominant Colors)", en: "Dominant Color Families" },
  caColorAria: { zh: "颜色 {hex}", en: "Color {hex}" },
  caColorUnit: { zh: " 色", en: "" },
  caColorCount: { zh: "{count} 次 ({percentage}%)", en: "{count}× ({percentage}%)" },
  caNoColors: { zh: "暂无色彩提取数据", en: "No color data extracted yet" },
  caCompositionHeading: { zh: "构图风格分布 (Composition)", en: "Composition Distribution" },
  caNoComposition: { zh: "暂无构图风格标签", en: "No composition tags yet" },
  caRatioHeading: { zh: "图文比例分布 (Text-Image Ratio)", en: "Text–Image Ratio Distribution" },
  caNoRatio: { zh: "暂无图文比例数据", en: "No text–image ratio data yet" },
  caCtaPlacementHeading: { zh: "CTA 引导位置分布（视觉位置）", en: "CTA Placement Distribution (visual)" },
  caNoCtaPlacement: { zh: "暂无 CTA 位置数据", en: "No CTA placement data yet" },
  caSeasonalHeading: { zh: "季节与节日氛围 (Seasonal Cues)", en: "Seasonal & Holiday Cues" },
  caNoSeasonal: {
    zh: "已分析样本中无可见季节/节日氛围标签（标题里的季节词不计入）",
    en: "No visible seasonal/holiday cues in analyzed samples (seasonal words in subjects do not count)",
  },
  caNoBannerResults: {
    zh: "该窗口内 {n} 封邮件尚无 Banner 视觉分析成功结果（成功 0 封；排队/失败/未采集/无 Banner 见上方覆盖率）。",
    en: "None of the {n} emails in this window has a successful banner visual analysis yet (0 succeeded; see Coverage above for queued / failed / not collected / no banner).",
  },
  caColorGlyph: { zh: "色", en: "C" },
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
