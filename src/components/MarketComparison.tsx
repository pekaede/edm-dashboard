import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { DATA } from "../data";
import {
  BRAND_ORDER,
  getEmailMarket,
  useExtendedEmails,
  type EmailRecord,
  type ExtendedEmailMeta,
} from "../email-data";
import { useLocale, type DictionaryKey } from "../i18n";
import { Card } from "./Card";
import { themeLabelKeyOf } from "./dashboard";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";
import { Tooltip } from "./Tooltip";
import { themeColor } from "../three-week-aggregation";

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
 * 过滤、周均、周桶和窗口标注共用数据层 meta 的有效窗口（7 天一桶，含无记录日期）。
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
  /** 当前数据集元数据标注的有效窗口。 */
  windowStart: string;
  windowEnd: string;
  /** 有效窗口的观察天数，用于周均分母。 */
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
function aggregateComparison(
  emails: EmailRecord[],
  { windowStart, windowEnd }: Pick<ExtendedEmailMeta, "windowStart" | "windowEnd">,
): ComparisonData {
  const windowDays =
    Math.round((Date.parse(`${windowEnd}T00:00:00Z`) - Date.parse(`${windowStart}T00:00:00Z`)) / 86_400_000) + 1;

  const weeks: WeekDef[] = [];
  for (let start: string = windowStart, index = 0; start <= windowEnd; start = addDaysISO(start, 7), index += 1) {
    const end = addDaysISO(start, 6) <= windowEnd ? addDaysISO(start, 6) : windowEnd;
    weeks.push({
      index,
      label: `W${index + 1}`,
      range: `${formatDayMonth(start)}–${formatDayMonth(end)}`,
      start,
      end,
    });
  }
  const weekIndex = (date: string): number =>
    Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${windowStart}T00:00:00Z`)) / 86_400_000 / 7);

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
    if (email.date < windowStart || email.date > windowEnd) continue;
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
    windowStart,
    windowEnd,
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

type ComparisonView = "brand" | "theme" | "frequency";

const TASK_VIEWS: readonly { key: ComparisonView; labelKey: DictionaryKey; questionKey: DictionaryKey; descKey: DictionaryKey }[] = [
  { key: "brand", labelKey: "mcViewBrand", questionKey: "mcViewBrandQ", descKey: "mcViewBrandDesc" },
  { key: "theme", labelKey: "mcViewTheme", questionKey: "mcViewThemeQ", descKey: "mcViewThemeDesc" },
  { key: "frequency", labelKey: "mcViewFreq", questionKey: "mcViewFreqQ", descKey: "mcViewFreqDesc" },
];

const FOCUS_CLASS_NAME = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]";

function shareLabel(count: number, total: number): string {
  return total > 0 ? (count / total * 100).toFixed(1) + "%" : "—";
}

function ComparisonMatrix({ data, selected, view }: { data: ComparisonData; selected: string[]; view: "brand" | "theme" }) {
  const { t } = useLocale();
  const themeName = (theme: { key: string; labelZh: string }) => {
    const key = themeLabelKeyOf(theme.key);
    return key ? t(key) : theme.labelZh;
  };
  const isTheme = view === "theme";
  const rows = isTheme ? data.themes.map((theme) => ({ key: theme.key, label: themeName(theme) })) : data.brands.map((brand) => ({ key: brand, label: brand }));
  const countsByRow = isTheme ? data.themeMarket : data.brandMarket;
  const totalsByRow = isTheme ? data.themeTotals : data.brandTotals;
  return (
    <div role="region" aria-label={isTheme ? t("mcMatrixAriaTheme") : t("mcMatrixAriaBrand")} tabIndex={0} className={"mt-4 overflow-x-auto rounded-xl border border-[var(--border-default)] p-1 " + FOCUS_CLASS_NAME}>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">{(isTheme ? t("mcCaptionTheme") : t("mcCaptionBrand")) + t("mcCaptionSuffix")}</caption>
        <thead className="bg-[var(--surface-subtle)] text-[var(--text-heading)]">
          <tr className="border-b border-[var(--border-default)]">
            <th scope="col" className="sticky left-0 z-10 bg-[var(--surface-subtle)] px-3 py-3 text-left shadow-[1px_0_0_0_var(--border-default)]">{isTheme ? t("mcColTheme") : t("mcColBrand")}</th>
            {selected.map((market) => <th key={market} scope="col" className="min-w-40 px-3 py-3 text-left">{getMarketLabel(market)} · {market}<span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{t("mcMarketSample", { n: data.marketTotals.get(market) ?? 0 })}</span></th>)}
            <th scope="col" className="min-w-32 px-3 py-3 text-right">{t("mcColAllMarkets")}<span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{t("mcColAllMarketsSub")}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const counts = selected.map((market) => countsByRow.get(row.key)?.get(market) ?? 0);
            const values = selected.map((market, index) => isTheme ? ((data.marketTotals.get(market) ?? 0) > 0 ? counts[index] / data.marketTotals.get(market)! : -1) : counts[index]);
            const maximum = Math.max(...values);
            const total = totalsByRow.get(row.key) ?? 0;
            return (
              <tr key={row.key} className="border-b border-[var(--divider-table)]">
                <th scope="row" className="sticky left-0 z-10 bg-[var(--surface-card)] px-3 py-3 text-left font-semibold text-[var(--text-heading)] shadow-[1px_0_0_0_var(--border-default)]"><span className="inline-flex items-center gap-2">{isTheme ? <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: themeColor(row.key) }} /> : null}{row.label}</span></th>
                {selected.map((market, index) => {
                  const count = counts[index];
                  const marketTotal = data.marketTotals.get(market) ?? 0;
                  const highest = maximum > 0 && values[index] === maximum;
                  const share = shareLabel(count, marketTotal);
                  const average = weeklyAvg(count, data.windowDays);
                  const width = isTheme ? Math.max(0, values[index]) * 100 : (maximum > 0 ? count / maximum * 100 : 0);
                  return (
                    <td key={market} className={"px-2 py-2 align-top " + (highest ? "bg-[var(--accent-tint)]" : "")}>
                      <Tooltip
                        className={"rounded-lg p-2 hover:ring-2 hover:ring-[var(--control-focus)] " + FOCUS_CLASS_NAME}
                        label={t("mcCellLabel", { label: row.label, market: market, count: count, share: share, avg: average }) + (highest ? t("mcHighestSuffix") : "")}
                        content={<>
                          <div className="font-semibold">{row.label} · {getMarketLabel(market)}（{market}）</div>
                          <div className="mt-1 font-mono font-bold">{t("mcCellLine", { count: count, share: share, avg: average })}</div>
                          <div className="mt-1">{data.windowStart} – {data.windowEnd} · {t("mcMarketDenominator")} {marketTotal} {t("marketUnitEmails", { count: marketTotal })} · {t("mcVisible")}</div>
                        </>}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-1 text-[var(--text-heading)]"><strong className="font-mono tabular-nums">{isTheme ? share : `${count} ${t("marketUnitEmails", { count })}`}</strong>{highest ? <span className="text-xs font-bold text-[var(--accent-ink)]">{t("mcHighest")}</span> : null}</div>
                        <div className="my-2 h-2 overflow-hidden rounded-full bg-[var(--chart-empty)]" aria-hidden="true"><div className="h-full rounded-full" style={{ width: width + "%", backgroundColor: isTheme ? themeColor(row.key) : "var(--control-active-bg)" }} /></div>
                        <div className="text-xs tabular-nums text-[var(--text-secondary)]">{isTheme ? `${count} ${t("marketUnitEmails", { count })} / ${marketTotal} ${t("marketUnitEmails", { count: marketTotal })}` : `${t("mcWeeklyAvg")} ${average} ${t("marketUnitEmails", { count: average })}`}</div>
                      </Tooltip>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--text-heading)]">{total} {t("marketUnitEmails", { count: total })}<span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{isTheme ? shareLabel(total, data.grandTotal) : `${t("mcWeeklyAvg")} ${weeklyAvg(total, data.windowDays)} ${t("marketUnitEmails", { count: weeklyAvg(total, data.windowDays) })}`}</span></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-[var(--surface-subtle)] font-bold text-[var(--text-heading)]">
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-[var(--surface-subtle)] px-3 py-3 text-left shadow-[1px_0_0_0_var(--border-default)]">{t("mcMarketTotal")}</th>
            {selected.map((market) => {
              const total = data.marketTotals.get(market) ?? 0;
              return (
                <td key={market} className="px-3 py-3 font-mono tabular-nums">
                  {total} {t("marketUnitEmails", { count: total })}
                  {!isTheme ? <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{t("mcWeeklyAvg")} {weeklyAvg(total, data.windowDays)} {t("marketUnitEmails", { count: weeklyAvg(total, data.windowDays) })}</span> : null}
                </td>
              );
            })}
            <td className="px-3 py-3 text-right font-mono tabular-nums">
              {data.grandTotal} {t("marketUnitEmails", { count: data.grandTotal })}
              {!isTheme ? <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{t("mcWeeklyAvg")} {weeklyAvg(data.grandTotal, data.windowDays)} {t("marketUnitEmails", { count: weeklyAvg(data.grandTotal, data.windowDays) })}</span> : null}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FrequencyComparison({ data, selected, brand, onBrandChange, id }: { data: ComparisonData; selected: string[]; brand: string; onBrandChange: (brand: string) => void; id: string }) {
  const { t } = useLocale();
  const series = selected.map((market) => ({ market, weekly: data.brandMarketWeekly.get(brand)?.get(market) ?? data.weeks.map(() => 0) }));
  const maximum = Math.max(0, ...series.flatMap((item) => item.weekly));
  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="text-sm font-bold text-[var(--text-heading)]">{t("mcFocusBrand")}</label>
        <select id={id} value={brand} onChange={(event) => onBrandChange(event.target.value)} className={"min-h-11 max-w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-body)] " + FOCUS_CLASS_NAME}>{data.brands.map((name) => <option key={name}>{name}</option>)}</select>
        <span className="text-xs text-[var(--text-secondary)]">{t("mcScaleNote", { max: maximum })}</span>
      </div>
      <div role="region" tabIndex={0} aria-label={t("mcFreqRegionAria", { brand: brand })} className={"overflow-x-auto rounded-xl border border-[var(--border-default)] p-2 " + FOCUS_CLASS_NAME}>
        <div className="space-y-5 p-2" style={{ minWidth: Math.max(480, data.weeks.length * 48) + "px" }}>
          {series.map(({ market, weekly }) => {
            const total = weekly.reduce((sum, count) => sum + count, 0);
            return (
              <section key={market} aria-label={t("mcFreqSectionAria", { brand: brand, market: market })}>
                <h4 className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm font-bold text-[var(--text-heading)]">{getMarketLabel(market)} · {market}<span className="text-xs font-normal text-[var(--text-secondary)]">{total} {t("marketUnitEmails", { count: total })} · {t("mcWeeklyAvg")} {weeklyAvg(total, data.windowDays)} {t("marketUnitEmails", { count: weeklyAvg(total, data.windowDays) })}</span></h4>
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(" + data.weeks.length + ", minmax(0, 1fr))" }}>
                  {weekly.map((count, index) => {
                    const week = data.weeks[index];
                    const highest = maximum > 0 && count === maximum;
                    const days = Math.round((Date.parse(week.end) - Date.parse(week.start)) / 86_400_000) + 1;
                    return (
                      <Tooltip
                        key={week.label}
                        className={"rounded-md px-1 py-2 hover:ring-2 hover:ring-[var(--control-focus)] " + FOCUS_CLASS_NAME}
                        label={t("mcFreqLabel", { brand: brand, market: market, week: week.label, start: week.start, end: week.end, count: count, days: days }) + (highest ? t("mcFreqHighestSuffix") : "")}
                        content={<>
                          <div className="font-semibold">{brand} · {market} · {week.label}（{week.range}）</div>
                          <div className="mt-1 font-mono font-bold">{t("mcFreqLine", { count: count, days: days, perDay: (count / days).toFixed(2) })}</div>
                          <div className="mt-1">{t("mcFreqLine3", { start: week.start, end: week.end, max: maximum })}</div>
                        </>}
                      >
                        <div className={"h-9 text-center font-mono text-xs tabular-nums " + (highest ? "font-bold text-[var(--accent-ink)]" : "text-[var(--text-heading)]")}>{count}<span className="block text-xs">{highest ? t("mcHighest") : ""}</span></div>
                        <div className="flex h-24 items-end justify-center border-b border-[var(--border-default)]" aria-hidden="true"><span className="w-3/4 max-w-7 rounded-t-sm" style={{ height: count > 0 ? count / maximum * 100 + "%" : "2px", backgroundColor: highest ? "var(--accent-ink)" : count > 0 ? "var(--control-active-bg)" : "var(--chart-empty)" }} /></div>
                        <div className="mt-2 text-center font-mono text-xs text-[var(--text-secondary)]">{week.label}</div>
                      </Tooltip>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <div className="grid gap-1 border-t border-[var(--divider)] pt-3" style={{ gridTemplateColumns: "repeat(" + data.weeks.length + ", minmax(0, 1fr))" }} role="group" aria-label={t("mcWeeksAria")}>{data.weeks.map((week) => <div key={week.label} className="text-center text-xs leading-5 text-[var(--text-secondary)]"><strong>{week.label}</strong><br />{formatDayMonth(week.start)}<br />–{formatDayMonth(week.end)}</div>)}</div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t("mcFreqFooter")}</p>
    </div>
  );
}

export function MarketComparison({
  markets,
  onMarketsChange,
}: {
  markets?: string[];
  onMarketsChange?: (markets: string[]) => void;
} = {}) {
  const { t } = useLocale();
  const { status, emails, total: emailTotal, error, retry, meta } = useExtendedEmails();
  const [internalSelected, setInternalSelected] = useState<string[]>(["US", "UK"]);
  // 受控时由调用方（SiteProvider）持有对比多选，切视图/切站点不丢失、不被全局站点覆盖；
  // 未传 props 时保持原内部状态，行为不变。
  const selected = markets ?? internalSelected;
  // 受控模式下用 ref 跟踪最新值：同批次连续更新时，后一次基于前一次的求值结果，
  // 而不是旧 render 闭包里的 selected；父组件未更新（拒绝本次更新）时，下一次
  // 渲染后把 ref 同步回 props，丢弃未被接受的乐观值——无 deps 的 effect 在每次
  // 渲染后运行，因此切换内部 tab 这类仅触发重渲染的操作也会触发回同步。
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  });
  const setSelected = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      if (onMarketsChange) {
        const resolved =
          typeof updater === "function"
            ? (updater as (prev: string[]) => string[])(selectedRef.current)
            : updater;
        // 先记下本次求值结果，供同批次下一次调用基于最新值计算。
        selectedRef.current = resolved;
        onMarketsChange(resolved);
      } else {
        // 非受控：直接把 updater 传给 useState setter，保持函数式更新的排队语义。
        setInternalSelected(
          updater as React.SetStateAction<string[]>,
        );
      }
    },
    [onMarketsChange],
  );
  const [view, setView] = useState<ComparisonView>("brand");
  const [focusedBrand, setFocusedBrand] = useState<string>(BRAND_ORDER[0]);
  const id = useId();
  const { windowStart, windowEnd } = meta;
  const data = useMemo(
    () => emails.length > 0 ? aggregateComparison(emails, { windowStart, windowEnd }) : null,
    [emails, windowStart, windowEnd],
  );
  const hint = data
    ? t("mcHint", { start: data.windowStart, end: data.windowEnd, total: data.grandTotal })
    : t("mcHintFallback");

  if (status === "ready" && !data) return <Card title={t("mcTitle")} hint={hint}><p className="py-6 text-center text-sm text-[var(--text-secondary)]" role="status">{t("mcEmpty")}</p></Card>;
  if (status === "loading" || status === "error" || !data) return <Card title={t("mcTitle")} hint={hint}><ExtendedEmailsState status={status} total={emailTotal} error={error} retry={retry} meta={meta} /></Card>;

  const effectiveSelected = data.markets.filter((market) => selected.includes(market));
  const task = TASK_VIEWS.find((item) => item.key === view)!;
  const selectedTotal = effectiveSelected.reduce((sum, market) => sum + (data.marketTotals.get(market) ?? 0), 0);
  const brand = data.brands.includes(focusedBrand) ? focusedBrand : data.brands[0];

  return (
    <Card title={t("mcTitle")} hint={hint}>
      {status === "incomplete" ? <p className="mb-4 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning)]" role="alert">{t("mcIncomplete", { got: emailTotal, expected: meta.total })}</p> : null}
      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-bold text-[var(--text-heading)]">{t("mcSelectLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {data.markets.map((market) => <label key={market} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-body)] hover:border-[var(--control-hover-border)]"><input type="checkbox" checked={selected.includes(market)} onChange={() => setSelected((previous) => previous.includes(market) ? previous.filter((code) => code !== market) : [...previous, market])} className={"size-4 accent-[var(--control-active-bg)] " + FOCUS_CLASS_NAME} />{getMarketLabel(market)} · {market}<span className="text-xs text-[var(--text-secondary)]">{data.marketTotals.get(market) ?? 0} {t("marketUnitEmails", { count: data.marketTotals.get(market) ?? 0 })}</span></label>)}
        </div>
      </fieldset>
      <div role="tablist" aria-label={t("mcTablistAria")} className="mb-4 flex flex-wrap gap-2 rounded-xl bg-[var(--surface-subtle)] p-2">
        {TASK_VIEWS.map((item, index) => (
          <button key={item.key} id={id + "-tab-" + item.key} type="button" role="tab" aria-selected={view === item.key} aria-controls={id + "-panel"} tabIndex={view === item.key ? 0 : -1} onClick={() => setView(item.key)} onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % TASK_VIEWS.length;
            else if (event.key === "ArrowLeft") next = (index + TASK_VIEWS.length - 1) % TASK_VIEWS.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = TASK_VIEWS.length - 1;
            else return;
            event.preventDefault();
            setView(TASK_VIEWS[next].key);
            document.getElementById(id + "-tab-" + TASK_VIEWS[next].key)?.focus();
          }} className={"min-h-11 flex-1 rounded-lg border px-4 py-2 text-sm font-bold " + FOCUS_CLASS_NAME + " " + (view === item.key ? "border-[var(--control-active-border)] bg-[var(--control-active-bg)] text-[var(--control-active-text)]" : "border-[var(--control-border)] bg-[var(--control-bg)] text-[var(--control-text)] hover:bg-[var(--control-hover-bg)]")}>{t(item.labelKey)}</button>
        ))}
      </div>
      <section id={id + "-panel"} role="tabpanel" aria-labelledby={id + "-tab-" + view} tabIndex={0} className={"rounded-lg p-1 " + FOCUS_CLASS_NAME}>
        <h3 className="text-base font-bold text-[var(--text-heading)]">{t(task.questionKey)}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t(task.descKey)}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]" role="status">{t("mcStatusLine", { n: effectiveSelected.length, sample: selectedTotal, total: data.grandTotal, days: data.windowDays })}</p>
        {effectiveSelected.length < 2 ? <p className="py-6 text-sm text-[var(--text-secondary)]" role="status">{t("mcNeedTwo")}</p> : <>
          <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{t("mcHighestNote")}</p>
          {view === "frequency" ? <FrequencyComparison data={data} selected={effectiveSelected} brand={brand} onBrandChange={setFocusedBrand} id={id + "-brand"} /> : <ComparisonMatrix data={data} selected={effectiveSelected} view={view} />}
        </>}
      </section>
    </Card>
  );
}
