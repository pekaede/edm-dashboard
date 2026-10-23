import { useLocale, type Locale } from "./index";
import { Button } from "../components/ui/button";

const OPTIONS: ReadonlyArray<{ code: Locale; label: string; lang: string }> = [
  { code: "zh", label: "中文", lang: "zh-CN" },
  { code: "en", label: "EN", lang: "en" },
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
          <Button
            variant="ghost"
            size="sm"
            key={option.code}
            type="button"
            lang={option.lang}
            aria-pressed={isActive}
            onClick={() => setLocale(option.code)}
            className={`h-7 min-h-7 rounded-full px-2.5 text-xs font-bold focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--control-bg)] ${
              isActive
                ? "bg-[var(--accent-tint)] text-[var(--accent-ink)] hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)]"
                : "text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
            }`}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
