import { useLocale } from "./index";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="view-switcher" role="group" aria-label={t("language")}>
      <button
        type="button"
        aria-pressed={locale === "zh"}
        className={`view-switcher-link ${
          locale === "zh"
            ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-switcher)]"
            : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
        }`}
        onClick={() => setLocale("zh")}
      >
        中文
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        className={`view-switcher-link ${
          locale === "en"
            ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-switcher)]"
            : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
        }`}
        onClick={() => setLocale("en")}
      >
        English
      </button>
    </div>
  );
}
