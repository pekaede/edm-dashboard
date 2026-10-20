import { useId } from "react";
import { dictionary, getCurrentLocale, useLocale, type DictionaryKey } from "../i18n";

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
  const locale = getCurrentLocale();
  if (market === null) return dictionary.marketAll[locale];
  const option = MARKET_OPTIONS.find((item) => item.code === market);
  return option ? dictionary[option.labelKey][locale] : market;
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
  /** 各市场封数（market 代码 → 封数），用于下拉选项展示；缺失按 0 计。 */
  counts: Record<string, number>;
  /** 全部市场总封数。 */
  total: number;
  label?: string;
}) {
  const { t, locale } = useLocale();
  const resolvedLabel = label ?? t("marketFilterLabel");
  const selectId = useId();
  // 下拉外的新市场（如未来导入 JP）：有封数时追加为 extra 选项，避免其封数在下拉中不可见。
  const extraMarkets = Object.keys(counts)
    .filter((code) => counts[code] > 0 && !MARKET_OPTIONS.some((option) => option.code === code))
    .sort();
  const formatOption = (name: string, count: number) =>
    locale === "zh" ? `${name}（${count}${t("marketUnitEmails")}）` : `${name} (${count} ${t("marketUnitEmails")})`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        htmlFor={selectId}
        className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]"
      >
        {resolvedLabel}
      </label>
      <select
        id={selectId}
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          // 白名单校验：只接受空串（全部市场）或 MARKET_OPTIONS / 有封数的 extra 市场码；
          // 被篡改的 DOM 值落入 null（全部市场），不进入非法筛选。
          const isKnown =
            next === "" ||
            MARKET_OPTIONS.some((option) => option.code === next) ||
            (counts[next] ?? 0) > 0;
          onChange(next === "" || !isKnown ? null : next);
        }}
        aria-label={resolvedLabel}
        className="min-h-11 max-w-full rounded-full border border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] px-4 py-2 text-sm font-bold text-[var(--text-control)] transition hover:border-[var(--control-filter-hover-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
      >
        <option value="">{formatOption(t("marketAll"), total)}</option>
        {MARKET_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {formatOption(t(option.labelKey), counts[option.code] ?? 0)}
          </option>
        ))}
        {extraMarkets.map((code) => (
          <option key={code} value={code}>
            {formatOption(code, counts[code])}
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--text-description)]" aria-live="polite" aria-atomic="true">
        {t("marketCurrent")}{getMarketLabel(value)}
      </span>
    </div>
  );
}
