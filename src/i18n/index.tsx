import { useEffect, type ReactNode } from "react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

export type Locale = "zh" | "en";

/** 全部翻译键：由中文资源生成，新增键先加 zh.json 再加 en.json，缺键构建报错。 */
export type DictionaryKey = keyof typeof zh;

// 完整方案：语言检测（仅读 localStorage，默认中文）+ React 绑定。
// 翻译资源按语言拆分在 locales/*.json，代码里只出现 key。
// 消息格式只用 {var} 插值与 {var, plural, one {…} other {…}} 两种语法，
// 由下方 formatMessage 自研实现（替代 i18next-icu + intl-messageformat 大依赖）。
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    fallbackLng: "zh",
    supportedLngs: ["zh", "en"],
    nonExplicitSupportedLngs: true,
    keySeparator: false,
    nsSeparator: false,
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: "edm-lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export function getCurrentLocale(): Locale {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "zh";
  return lang.startsWith("en") ? "en" : "zh";
}

type TranslateValues = Record<string, unknown>;
type RawT = (key: string, values?: TranslateValues) => string;

// ICU 子集格式化（语义与 intl-messageformat 对齐，金标准全键比对验证）：
// - 复数分支按 Intl.PluralRules 选择（en: 1 → one，其余 → other；zh 恒 other）；
// - 分支内 # 按 Intl.NumberFormat 渲染（如 2.56789 → "2.568"、1483 → "1,483"）；
// - 普通 {var} 按 String(值) 原样替换（不做数字格式化）；缺值时保留占位符不吞。
const PLURAL_RE = /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g;
const VAR_RE = /\{(\w+)\}/g;

function formatMessage(template: string, values: TranslateValues | undefined, locale: Locale): string {
  if (!values) return template;
  const intlLocale = locale === "en" ? "en-US" : "zh-CN";
  const pluralRules = new Intl.PluralRules(intlLocale);
  const numberFormat = new Intl.NumberFormat(intlLocale);
  const withPlurals = template.replace(
    PLURAL_RE,
    (segment, name: string, one: string, other: string) => {
      const raw = values[name];
      if (typeof raw !== "number") return segment;
      const branch = pluralRules.select(raw) === "one" ? one : other;
      return branch.replace(/#/g, numberFormat.format(raw));
    },
  );
  return withPlurals.replace(VAR_RE, (placeholder, name: string) => {
    const raw = values[name];
    return raw === undefined || raw === null ? placeholder : String(raw);
  });
}

/** 模块级翻译：纯函数与聚合层（非组件代码）用，与组件内 t() 同一实例。 */
export function translate(key: DictionaryKey, values?: TranslateValues): string {
  const raw = (i18n.t as unknown as RawT)(key);
  return formatMessage(raw, values, getCurrentLocale());
}

/** 按指定语言取词（搜索匹配等需要跨语言查词的场景）。 */
export function translateIn(locale: Locale, key: DictionaryKey, values?: TranslateValues): string {
  const raw = (i18n.getFixedT(locale) as unknown as RawT)(key);
  return formatMessage(raw, values, locale);
}

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey, values?: TranslateValues) => string;
}

export function useLocale(): LocaleContextValue {
  const { t: tRaw, i18n: instance } = useTranslation();
  return {
    locale: getCurrentLocale(),
    setLocale: (next: Locale) => {
      void instance.changeLanguage(next);
    },
    t: (key: DictionaryKey, values?: TranslateValues) => {
      const raw = (tRaw as unknown as RawT)(key);
      return formatMessage(raw, values, getCurrentLocale());
    },
  };
}

/** 语言变化时同步 <html lang> 与页面标题（无障碍/SEO 最佳实践）。 */
function LocaleEffects() {
  const { t } = useTranslation();
  const locale = getCurrentLocale();
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = (t as unknown as RawT)("appTitle");
  }, [locale, t]);
  return null;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleEffects />
      {children}
    </I18nextProvider>
  );
}

export default i18n;
