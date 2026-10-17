import { useMemo, useState } from "react";
import { DATA } from "../data";
import {
  BRAND_ORDER,
  getEmailMarket,
  useExtendedEmails,
  type EmailRecord,
} from "../email-data";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";

/**
 * 跨市场对比视图（已接入 App.tsx dashboard 视图，位于 WordCloud/Insights 网格之后、CalendarView 之前）。
 *
 * 产品视角：用户要一眼看出“同品牌在不同市场的表现差异”。
 * 本视图选 2 个及以上市场并排对比：
 *  - 品牌 × 市场：各品牌在各市场的邮件数 + 周均（周频率的单值版）
 *  - 主题对比：各主题在各市场的封数 + 占该市场份额
 *  - 周频率：各品牌 × 各市场的周度分布迷你柱状图（7 天一桶）
 *
 * 数据：复用 useExtendedEmails() 的共享缓存（Supabase emails 表），
 * 本组件只做聚合，不造数据、不硬编码计数。0 封的市场显示 0。
 * 窗口：由 emails 的最小/最大发送日期推导（7 天一桶），不依赖固定窗口常量，
 * 当前上游查询固定为 2026-07-16 至 2026-10-15；仅在查询窗口经确认后扩展时，聚合周桶才随数据扩展。
 */

// 对比市场（固定 8 个，任务指定）。EU 不在固定列表内：
// 若数据中出现 EU（或未来新市场如 JP），自动作为 extra 市场追加，不静默丢弃。
const COMPARISON_MARKETS = [
  { code: "US", label: "美国" },
  { code: "UK", label: "英国" },
  { code: "AU", label: "澳洲" },
  { code: "FR", label: "法国" },
  { code: "DE", label: "德国" },
  { code: "IT", label: "意大利" },
  { code: "ES", label: "西班牙" },
  { code: "NL", label: "荷兰" },
] as const;

const OTHER_THEME_KEY = "other";
const OTHER_THEME_LABEL = "其他";

interface WeekDef {
  index: number;
  label: string;
  range: string;
  start: string;
  end: string;
}

interface ThemeDef {
  key: string;
  labelZh: string;
}

interface ComparisonData {
  /** 全部可用市场（固定 8 + 数据中出现的 extra），按固定顺序 + extra 字母序。 */
  markets: string[];
  marketLabels: Map<string, string>;
  brands: string[];
  themes: ThemeDef[];
  weeks: WeekDef[];
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  brandMarket: Map<string, Map<string, number>>;
  themeMarket: Map<string, Map<string, number>>;
  brandMarketWeekly: Map<string, Map<string, number[]>>;
  marketTotals: Map<string, number>;
  brandTotals: Map<string, number>;
  themeTotals: Map<string, number>;
  grandTotal: number;
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayMonth(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * 实时聚合：单次遍历 emails，填满品牌×市场、主题×市场、品牌×市场×周三张计数。
 * 品牌/主题/市场用 Map（不用普通对象做动态 key 索引），避免 __proto__ 等原型污染。
 */
function aggregateComparison(emails: EmailRecord[]): ComparisonData {
  let minDate = emails[0].date;
  let maxDate = emails[0].date;
  for (const email of emails) {
    if (email.date < minDate) minDate = email.date;
    if (email.date > maxDate) maxDate = email.date;
  }
  const windowDays =
    Math.round((Date.parse(`${maxDate}T00:00:00Z`) - Date.parse(`${minDate}T00:00:00Z`)) / 86_400_000) + 1;

  const weeks: WeekDef[] = [];
  for (let start = minDate, index = 0; start <= maxDate; start = addDaysISO(start, 7), index += 1) {
    const end = addDaysISO(start, 6) <= maxDate ? addDaysISO(start, 6) : maxDate;
    weeks.push({
      index,
      label: `W${index + 1}`,
      range: `${formatDayMonth(start)}–${formatDayMonth(end)}`,
      start,
      end,
    });
  }
  const weekIndex = (date: string): number =>
    Math.min(Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${minDate}T00:00:00Z`)) / 86_400_000 / 7), weeks.length - 1);

  // 市场：固定 8 + 数据中出现的 extra（有封数时追加，字母序）。
  const marketLabels = new Map<string, string>(COMPARISON_MARKETS.map((m) => [m.code, m.label]));
  const extraMarkets = new Set<string>();
  for (const email of emails) {
    const market = getEmailMarket(email);
    if (!marketLabels.has(market)) extraMarkets.add(market);
  }
  const markets = [
    ...COMPARISON_MARKETS.map((m) => m.code),
    ...[...extraMarkets].sort(),
  ];
  for (const code of extraMarkets) marketLabels.set(code, code);

  // 品牌：BRAND_ORDER + 数据中出现的未知品牌（追加，字母序）。
  const extraBrands = new Set<string>();
  for (const email of emails) {
    if (!BRAND_ORDER.includes(email.brand as (typeof BRAND_ORDER)[number])) extraBrands.add(email.brand);
  }
  const brands = [...BRAND_ORDER, ...[...extraBrands].sort()];

  // 主题：DATA.themes 顺序 + other（若出现）+ 未知主题（追加，字母序）。
  const themeLabelZh = new Map(DATA.themes.map((t) => [t.key, t.labelZh]));
  const unknownThemes = new Set<string>();
  let hasOther = false;
  for (const email of emails) {
    if (email.theme === OTHER_THEME_KEY) hasOther = true;
    else if (!themeLabelZh.has(email.theme)) unknownThemes.add(email.theme);
  }
  const themes: ThemeDef[] = DATA.themes.map((t) => ({ key: t.key, labelZh: t.labelZh }));
  if (hasOther) themes.push({ key: OTHER_THEME_KEY, labelZh: OTHER_THEME_LABEL });
  for (const key of [...unknownThemes].sort()) themes.push({ key, labelZh: key });

  const brandMarket = new Map<string, Map<string, number>>();
  const themeMarket = new Map<string, Map<string, number>>();
  const brandMarketWeekly = new Map<string, Map<string, number[]>>();
  const marketTotals = new Map<string, number>();
  const brandTotals = new Map<string, number>();
  const themeTotals = new Map<string, number>();
  let grandTotal = 0;

  for (const email of emails) {
    const market = getEmailMarket(email);
    const wi = weekIndex(email.date);
    increment(getOrCreate(brandMarket, email.brand, () => new Map()), market);
    increment(getOrCreate(themeMarket, email.theme, () => new Map()), market);
    const weekly = getOrCreate(
      getOrCreate(brandMarketWeekly, email.brand, () => new Map()),
      market,
      () => Array.from({ length: weeks.length }, () => 0),
    );
    weekly[wi] += 1;
    increment(marketTotals, market);
    increment(brandTotals, email.brand);
    increment(themeTotals, email.theme);
    grandTotal += 1;
  }

  return {
    markets,
    marketLabels,
    brands,
    themes,
    weeks,
    windowStart: minDate,
    windowEnd: maxDate,
    windowDays,
    brandMarket,
    themeMarket,
    brandMarketWeekly,
    marketTotals,
    brandTotals,
    themeTotals,
    grandTotal,
  };
}

/** 周均 = 封数 / (窗口天数 / 7)，1 位小数。 */
function weeklyAvg(count: number, windowDays: number): string {
  if (windowDays <= 0) return "0.0";
  return (count / (windowDays / 7)).toFixed(1);
}

/** 行内最大值（>0 时才高亮；全 0 不高亮，避免满屏色块）。 */
function rowMax(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

export function MarketComparison() {
  const { status, emails, total: emailTotal, error, retry, meta } = useExtendedEmails();
  const [selected, setSelected] = useState<string[]>(["US", "UK"]);
  const data = useMemo(
    () => (emails.length > 0 ? aggregateComparison(emails) : null),
    [emails],
  );

  const hint = data
    ? `实时聚合（全期数据，窗口 ${data.windowStart} – ${data.windowEnd}，共 ${data.grandTotal} 封）。选 2 个及以上市场并排对比：同品牌在不同市场的邮件数、主题分布、周频率。0 封的市场显示 0。`
    : `实时聚合（全期数据）。选 2 个及以上市场并排对比：同品牌在不同市场的邮件数、主题分布、周频率。0 封的市场显示 0。`;

  if (status === "ready" && !data) {
    return (
      <Card title="跨市场对比" hint={hint}>
        <p className="py-6 text-center text-sm text-slate-600" role="status">暂无邮件</p>
      </Card>
    );
  }

  if (status === "loading" || status === "error" || !data) {
    return (
      <Card title="跨市场对比" hint={hint}>
        <ExtendedEmailsState status={status} total={emailTotal} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  // 选中市场：与可用市场取交集，按可用市场顺序排（列序稳定）。
  // 默认 US + UK；用户可自由勾选/取消，<2 个时只显示提示、不渲染表格。
  const effectiveSelected = data.markets.filter((market) => selected.includes(market));
  const toggleMarket = (market: string) => {
    setSelected((prev) =>
      prev.includes(market) ? prev.filter((m) => m !== market) : [...prev, market],
    );
  };

  const weekFootnote = data.weeks.map((w) => `${w.label} ${w.range}`).join("、");

  return (
    <Card title="跨市场对比" hint={hint}>
      {/* incomplete 时仍渲染对比（基于已取数据），顶部给明确警告；与其它视图“仅 ready 才渲染”不同，
          是有意为之：跨市场对比的价值正在于展示已取的多市场数据，不应因 meta.total 滞后而完全空白。 */}
      {status === "incomplete" ? (
        <p
          className="mb-4 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-2.5 text-sm text-[var(--text-detail)]"
          role="alert"
        >
          数据未取齐（已取 {emailTotal} / 预期 {meta.total} 封），以下对比基于已取数据。
        </p>
      ) : null}

      {/* 市场选择：复选框，2 个及以上才对比；0 封市场也列出（可选中看空态）。 */}
      <fieldset className="mb-5">
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
          选择对比市场（至少 2 个）
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {data.markets.map((market) => (
            <label
              key={market}
              className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--text-control)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(market)}
                onChange={() => toggleMarket(market)}
                className="h-4 w-4 accent-[var(--text-control)]"
                aria-label={`对比市场：${data.marketLabels.get(market) ?? market}`}
              />
              {data.marketLabels.get(market) ?? market}（{data.marketTotals.get(market) ?? 0} 封）
            </label>
          ))}
        </div>
      </fieldset>

      {effectiveSelected.length < 2 ? (
        <p className="py-6 text-center text-sm text-slate-500" role="status">
          请至少选择 2 个市场进行对比。
        </p>
      ) : (
        <>
          {/* 品牌 × 市场：邮件数 + 周均；行内最大值高亮，一眼看出该品牌在哪市场最活跃。 */}
          <h3 className="section-title text-slate-900">品牌 × 市场</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <caption className="sr-only">各品牌在选中市场的邮件数与周均</caption>
              <thead>
                <tr className="border-b border-[var(--border-strong)] text-left">
                  <th scope="col" className="px-3 py-2 font-bold text-slate-900">品牌</th>
                  {effectiveSelected.map((market) => (
                    <th key={market} scope="col" className="px-3 py-2 text-right font-bold text-slate-900">
                      {data.marketLabels.get(market) ?? market}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-bold text-slate-900">全市场合计</th>
                </tr>
              </thead>
              <tbody>
                {data.brands.map((brand) => {
                  const counts = effectiveSelected.map(
                    (market) => data.brandMarket.get(brand)?.get(market) ?? 0,
                  );
                  const max = rowMax(counts);
                  const brandTotal = data.brandTotals.get(brand) ?? 0;
                  return (
                    <tr key={brand} className="border-b border-[var(--divider-table)]">
                      <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-900">
                        {brand}
                      </th>
                      {effectiveSelected.map((market, index) => {
                        const count = counts[index];
                        const isMax = max > 0 && count === max;
                        return (
                          <td
                            key={market}
                            className={`px-3 py-2 text-right tabular-nums ${
                              isMax ? "bg-[var(--theme-price-tint)] font-bold text-slate-950" : "text-slate-700"
                            }`}
                          >
                            <span className="font-mono">{count}</span>
                            <span className="ml-1 text-xs text-slate-600">周均 {weeklyAvg(count, data.windowDays)}</span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-bold text-slate-950 tabular-nums">
                        <span className="font-mono">{brandTotal}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">周均 {weeklyAvg(brandTotal, data.windowDays)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)] font-bold text-slate-950">
                  <th scope="row" className="px-3 py-2 text-left">合计</th>
                  {effectiveSelected.map((market) => {
                    const total = data.marketTotals.get(market) ?? 0;
                    return (
                      <td key={market} className="px-3 py-2 text-right tabular-nums">
                        <span className="font-mono">{total}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">周均 {weeklyAvg(total, data.windowDays)}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-mono">{data.grandTotal}</span>
                    <span className="ml-1 text-xs font-normal text-slate-500">周均 {weeklyAvg(data.grandTotal, data.windowDays)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 主题对比：封数 + 占该市场份额；行内最高份额高亮，看主题结构差异（份额比绝对数更有意义，市场总量不同）。 */}
          <h3 className="mt-6 section-title text-slate-900">主题对比</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <caption className="sr-only">各主题在选中市场的封数与占该市场份额</caption>
              <thead>
                <tr className="border-b border-[var(--border-strong)] text-left">
                  <th scope="col" className="px-3 py-2 font-bold text-slate-900">主题</th>
                  {effectiveSelected.map((market) => (
                    <th key={market} scope="col" className="px-3 py-2 text-right font-bold text-slate-900">
                      {data.marketLabels.get(market) ?? market}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-bold text-slate-900">全市场合计</th>
                </tr>
              </thead>
              <tbody>
                {data.themes.map((theme) => {
                  // 份额比较用未四舍五入的原始值（避免 33.33% 与 33% 四舍五入后并列误高亮）；仅显示值四舍五入。
                  const rawShares = effectiveSelected.map((market) => {
                    const count = data.themeMarket.get(theme.key)?.get(market) ?? 0;
                    const marketTotal = data.marketTotals.get(market) ?? 0;
                    return marketTotal > 0 ? count / marketTotal : -1;
                  });
                  const maxShare = Math.max(...rawShares);
                  const themeTotal = data.themeTotals.get(theme.key) ?? 0;
                  return (
                    <tr key={theme.key} className="border-b border-[var(--divider-table)]">
                      <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-900">
                        {theme.labelZh}
                      </th>
                      {effectiveSelected.map((market, index) => {
                        const count = data.themeMarket.get(theme.key)?.get(market) ?? 0;
                        const share = rawShares[index];
                        const isMax = maxShare > 0 && share === maxShare;
                        return (
                          <td
                            key={market}
                            className={`px-3 py-2 text-right tabular-nums ${
                              isMax ? "bg-[var(--theme-price-tint)] font-bold text-slate-950" : "text-slate-700"
                            }`}
                          >
                            <span className="font-mono">{count}</span>
                            <span className="ml-1 text-xs text-slate-600">
                              {share < 0 ? "(—)" : `(${Math.round(share * 100)}%)`}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-bold text-slate-950 tabular-nums">
                        <span className="font-mono">{themeTotal}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          ({data.grandTotal > 0 ? Math.round((themeTotal / data.grandTotal) * 100) : 0}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)] font-bold text-slate-950">
                  <th scope="row" className="px-3 py-2 text-left">合计</th>
                  {effectiveSelected.map((market) => {
                    const total = data.marketTotals.get(market) ?? 0;
                    return (
                      <td key={market} className="px-3 py-2 text-right tabular-nums">
                        <span className="font-mono">{total}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          {total > 0 ? "(100%)" : "(—)"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-mono">{data.grandTotal}</span>
                    <span className="ml-1 text-xs font-normal text-slate-500">(100%)</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 周频率：品牌 × 市场迷你柱状图（7 天一桶），看各品牌在各市场的发送节奏差异。 */}
          <h3 className="mt-6 section-title text-slate-900">周频率</h3>
          <p className="mt-1 text-xs text-slate-500">
            每格为该品牌在该市场的周度分布（{data.weeks.length} 周，7 天一桶；柱高按格内周最大值归一化）。周：{weekFootnote}。
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <caption className="sr-only">各品牌在选中市场的周度邮件分布</caption>
              <thead>
                <tr className="border-b border-[var(--border-strong)] text-left">
                  <th scope="col" className="px-3 py-2 font-bold text-slate-900">品牌</th>
                  {effectiveSelected.map((market) => (
                    <th key={market} scope="col" className="px-3 py-2 text-right font-bold text-slate-900">
                      {data.marketLabels.get(market) ?? market}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.brands.map((brand) => (
                  <tr key={brand} className="border-b border-[var(--divider-table)]">
                    <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-900">
                      {brand}
                    </th>
                    {effectiveSelected.map((market) => {
                      const weekly = data.brandMarketWeekly.get(brand)?.get(market) ?? data.weeks.map(() => 0);
                      const cellMax = Math.max(...weekly, 0);
                      const cellTotal = weekly.reduce((sum, n) => sum + n, 0);
                      return (
                        <td key={market} className="px-3 py-2 text-right">
                          <div
                            className="flex h-10 items-end justify-end gap-[2px]"
                            role="img"
                            aria-label={`${brand} · ${data.marketLabels.get(market) ?? market}周频率：${weekly.map((n, i) => `${data.weeks[i].label} ${n} 封`).join("，")}`}
                          >
                            {weekly.map((count, i) => (
                              <span
                                key={data.weeks[i].label}
                                title={`${data.weeks[i].label} ${data.weeks[i].range}：${count} 封`}
                                className={`w-1 shrink-0 rounded-t-sm ${count > 0 ? "bg-[var(--text-control)]" : "bg-[var(--chart-empty)]"}`}
                                style={{
                                  height: `${cellMax > 0 && count > 0 ? Math.max(4, Math.round((count / cellMax) * 40)) : 2}px`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 tabular-nums">
                            {cellTotal} 封 · 周均 {weeklyAvg(cellTotal, data.windowDays)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
