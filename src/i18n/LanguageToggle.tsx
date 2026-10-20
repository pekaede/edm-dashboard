import { useLocale, type Locale } from "./index";

const OPTIONS: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: "zh", label: "中文" },
  { code: "en", label: "EN" },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-[var(--control-border)] bg-[var(--control-bg)] p-0.5 shadow-[var(--shadow-switcher)]"
      role="group"
      aria-label={t("language")}
    >
      {OPTIONS.map((option) => {
        const isActive = locale === option.code;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLocale(option.code)}
            className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--control-bg)] ${
              isActive
                ? "bg-[var(--text-heading)] text-white shadow-[var(--shadow-switcher)]"
                : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
