import { translate, useLocale, type DictionaryKey } from "../i18n";
import { Button } from "./ui/button";

export const MARKET_OPTIONS = [
  { code: "US", labelKey: "marketUS" },
  { code: "UK", labelKey: "marketUK" },
  { code: "AU", labelKey: "marketAU" },
  { code: "FR", labelKey: "marketFR" },
  { code: "DE", labelKey: "marketDE" },
  { code: "IT", labelKey: "marketIT" },
  { code: "NL", labelKey: "marketNL" },
  { code: "ES", labelKey: "marketES" },
] as const satisfies readonly { code: string; labelKey: DictionaryKey }[];

/**
 * 市场筛选值：null = 全部市场，否则为市场代码。
 * 用 string 而非 MARKET_OPTIONS 联合类型，以便未来新市场（如 JP）导入后
 * 能直接作为下拉 extra 选项出现（见下），无需先改类型。
 */
export type MarketFilterValue = string | null;

export function getMarketLabel(market: MarketFilterValue): string {
  if (market === null) return translate("marketAll");
  const option = MARKET_OPTIONS.find((item) => item.code === market);
  return option ? translate(option.labelKey) : market;
}

export function MarketFilter({
  value,
  onChange,
  counts,
  total,
  label,
}: {
  value: MarketFilterValue;
  onChange: (market: MarketFilterValue) => void;
  /** 各市场封数（market 代码 → 封数），用于选项展示；缺失按 0 计。 */
  counts: Record<string, number>;
  /** 全部市场总封数。 */
  total: number;
  label?: string;
}) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("marketFilterLabel");
  // 选项外的新市场（如未来导入 JP）：有封数时追加为 extra 选项，避免其封数不可见。
  const extraMarkets = Object.keys(counts)
    .filter((code) => counts[code] > 0 && !MARKET_OPTIONS.some((option) => option.code === code))
    .sort();
  // 排序：全部市场固定第一；其余按封数从大到小（同量保持原有固定顺序），
  // 让高数据量市场先被看到，空市场自然沉底。
  const sortedMarkets = [
    ...MARKET_OPTIONS.map((option) => ({
      code: option.code as MarketFilterValue,
      name: t(option.labelKey),
      count: counts[option.code] ?? 0,
    })),
    ...extraMarkets.map((code) => ({ code: code as MarketFilterValue, name: code, count: counts[code] })),
  ].sort((a, b) => b.count - a.count);
  const options: Array<{ code: MarketFilterValue; name: string; count: number }> = [
    { code: null, name: t("marketAll"), count: total },
    ...sortedMarkets,
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
        {resolvedLabel}
      </p>
      <div
        className="grid grid-cols-2 gap-1 rounded-3xl bg-[color-mix(in_srgb,var(--text-heading)_5%,transparent)] p-1.5 min-[480px]:grid-cols-3 xl:grid-cols-5"
        role="group"
        aria-label={resolvedLabel}
      >
        {options.map((option) => {
          const isSelected = value === option.code;
          const isEmpty = option.code !== null && option.count === 0;
          return (
            <Button
              variant={isSelected ? "default" : "ghost"}
              key={option.code ?? "all"}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.code)}
              className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] ${
                isSelected
                  ? "border-[var(--control-active-border)] bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-filter-active)]"
                  : `border-transparent bg-transparent text-[var(--text-control)] hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)] ${isEmpty ? "opacity-55" : ""}`
              }`}
            >
              {option.name}
              <span className={`text-xs font-medium tabular-nums ${isSelected ? "text-[var(--control-active-text)]" : "text-[var(--text-description)]"}`}>
                {option.count} {t("marketUnitEmails", { count: option.count })}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
