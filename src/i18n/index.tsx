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
  | "backToDashboardAria";

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
