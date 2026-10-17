import { useId } from "react";

export const MARKET_OPTIONS = [
  { code: "US", label: "美国" },
  { code: "UK", label: "英国" },
  { code: "AU", label: "澳洲" },
  { code: "FR", label: "法国" },
  { code: "DE", label: "德国" },
  { code: "IT", label: "意大利" },
  { code: "NL", label: "荷兰" },
  { code: "ES", label: "西班牙" },
] as const;

/**
 * 市场筛选值：null = 全部市场，否则为市场代码。
 * 用 string 而非 MARKET_OPTIONS 联合类型，以便未来新市场（如 JP）导入后
 * 能直接作为下拉 extra 选项出现（见下），无需先改类型。
 */
export type MarketFilterValue = string | null;

export function getMarketLabel(market: MarketFilterValue): string {
  if (market === null) return "全部市场";
  return MARKET_OPTIONS.find((option) => option.code === market)?.label ?? market;
}

export function MarketFilter({
  value,
  onChange,
  counts,
  total,
  label = "按市场筛选",
}: {
  value: MarketFilterValue;
  onChange: (market: MarketFilterValue) => void;
  /** 各市场封数（market 代码 → 封数），用于下拉选项展示；缺失按 0 计。 */
  counts: Record<string, number>;
  /** 全部市场总封数。 */
  total: number;
  label?: string;
}) {
  const selectId = useId();
  // 下拉外的新市场（如未来导入 JP）：有封数时追加为 extra 选项，避免其封数在下拉中不可见。
  const extraMarkets = Object.keys(counts)
    .filter((code) => counts[code] > 0 && !MARKET_OPTIONS.some((option) => option.code === code))
    .sort();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        htmlFor={selectId}
        className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f665c]"
      >
        {label}
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
        aria-label={label}
        className="min-h-11 rounded-full border border-[#d4cabd] bg-[#fffaf3] px-4 py-2 text-sm font-bold text-[#292521] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1c19] focus-visible:ring-offset-2"
      >
        <option value="">全部市场（{total} 封）</option>
        {MARKET_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}（{counts[option.code] ?? 0} 封）
          </option>
        ))}
        {extraMarkets.map((code) => (
          <option key={code} value={code}>
            {code}（{counts[code]} 封）
          </option>
        ))}
      </select>
      <span className="text-xs text-[#6f655b]" aria-live="polite" aria-atomic="true">
        当前：{getMarketLabel(value)}
      </span>
    </div>
  );
}
