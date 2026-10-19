import { THEME_COLORS, THEME_LABEL_COLORS, THEME_TINTS } from "./components/dashboard";
import { DATA, type Brand } from "./data";
import type { EmailRecord } from "./email-data";

// 3 周窗口：实时聚合从 emails 表逐封过滤，滑动 = 改这两个日期。
// 默认 2026-09-26 至 2026-10-17（含首尾）共 22 天；周按窗口起算：
// W1 = 起始日起 7 天，W2 = 接下来 7 天，W3 = 剩余天数至窗口末。
//
export interface ThreeWeekWindow {
  start: string;
  end: string;
}

export const THREE_WEEK_WINDOW: ThreeWeekWindow = {
  start: "2026-09-26",
  end: "2026-10-17",
};

export interface ThreeWeekWeekDef {
  id: string;
  label: string;
  range: string;
  start: string;
  end: string;
}

export interface ThreeWeekAggregatedTheme {
  key: string;
  labelZh: string;
  count: number;
  pct: number;
}

export interface ThreeWeekAggregatedBrand {
  name: string;
  weekly: [number, number, number];
  total: number;
  // 全部 DATA 主题键 + 窗口内出现的未知主题键（如 other），缺失记 0。
  themes: Record<string, number>;
}

export interface ThreeWeekAggregatedData {
  window: ThreeWeekWindow;
  windowDays: number;
  weeks: ThreeWeekWeekDef[];
  brands: ThreeWeekAggregatedBrand[];
  weekTotals: [number, number, number];
  grandTotal: number;
  themes: ThreeWeekAggregatedTheme[];
  total: number;
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

export function formatWindowRange(window: ThreeWeekWindow): string {
  return `${window.start} – ${window.end}`;
}

export function windowDays(window: ThreeWeekWindow): number {
  const startMs = Date.parse(`${window.start}T00:00:00Z`);
  const endMs = Date.parse(`${window.end}T00:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

// 由窗口起止推导 3 周定义（标签 / 日期范围），默认窗口下与静态 DATA.weeks 一致。
// 窗口 < 15 天时 W2/W3 会越界或重叠（W3 起始日超出窗口末），直接抛错拒绝静默产出错误标签，
// 而不是钳制出重叠周：滑动窗口时须保持至少 15 天。
export function deriveThreeWeekWeeks(window: ThreeWeekWindow): ThreeWeekWeekDef[] {
  if (windowDays(window) < 15) {
    throw new Error(
      `3 周窗口至少需要 15 天，当前 ${windowDays(window)} 天（${window.start} – ${window.end}）。`,
    );
  }
  const defs: Array<[string, string, string, string]> = [
    ["W1", "Week 1", window.start, addDaysISO(window.start, 6)],
    ["W2", "Week 2", addDaysISO(window.start, 7), addDaysISO(window.start, 13)],
    ["W3", "Week 3", addDaysISO(window.start, 14), window.end],
  ];
  return defs.map(([id, label, start, end]) => ({
    id,
    label,
    range: `${formatDayMonth(start)}–${formatDayMonth(end)}`,
    start,
    end,
  }));
}

// 用 defineProperty 写主题计数：直接赋值会在 key 为 "__proto__" 时触发原型 setter
// （非对象值被忽略），导致计数变成字符串；defineProperty 绕过 setter，建立真正的自有属性。
// 读计数用 hasOwnProperty，避免命中 Object.prototype（如 constructor / toString）。
function setOwnCount(record: Record<string, number>, key: string, value: number): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function getOwnCount(record: Record<string, number>, key: string): number {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : 0;
}

// 安全取主题色 / 标签色：直接索引会在 key 为 constructor / toString / __proto__
// 时命中 Object.prototype（函数/对象，非 nullish，?? 回退不触发），导致非法 CSS。
// 只认自有属性，否则回退中性色。
export function themeColor(key: string): string {
  return Object.prototype.hasOwnProperty.call(THEME_COLORS, key) ? THEME_COLORS[key] : "var(--theme-other)";
}

export function themeLabelColor(key: string): string {
  return Object.prototype.hasOwnProperty.call(THEME_LABEL_COLORS, key)
    ? THEME_LABEL_COLORS[key]
    : "var(--theme-other-label)";
}

export function themeTint(key: string): string {
  return Object.prototype.hasOwnProperty.call(THEME_TINTS, key)
    ? THEME_TINTS[key]
    : "var(--theme-other-tint)";
}

// 实时聚合：对 emails 表逐封过滤窗口 + 分组计数，不读快照表。
// 品牌按静态 DATA.brands 顺序，主题按 DATA.themes 顺序；窗口内出现的未知品牌/主题
// （如 other）追加在后，不静默丢弃。pct 按现有渲染逻辑 Math.round(count / total * 100)。
export function aggregateThreeWeek(
  emails: EmailRecord[],
  window: ThreeWeekWindow = THREE_WEEK_WINDOW,
): ThreeWeekAggregatedData {
  const weeks = deriveThreeWeekWeeks(window);
  const days = windowDays(window);
  const inWindow = emails.filter(
    (email) => email.date >= window.start && email.date <= window.end,
  );

  const weekIndex = (date: string): number => {
    if (date <= weeks[0].end) return 0;
    if (date <= weeks[1].end) return 1;
    return 2;
  };

  const themeOrder = new Map(DATA.themes.map((theme, index) => [theme.key, index]));
  const themeLabelZh = new Map(DATA.themes.map((theme) => [theme.key, theme.labelZh]));

  const brandByName = new Map<string, ThreeWeekAggregatedBrand>();
  const brandOrder = new Map(DATA.brands.map((brand, index) => [brand.name, index]));
  for (const brand of DATA.brands) {
    const themes: Record<string, number> = {};
    for (const theme of DATA.themes) themes[theme.key] = 0;
    brandByName.set(brand.name, { name: brand.name, weekly: [0, 0, 0], total: 0, themes });
  }

  const themeCounts = new Map<string, number>();
  for (const theme of DATA.themes) themeCounts.set(theme.key, 0);

  const weekTotals: [number, number, number] = [0, 0, 0];

  for (const email of inWindow) {
    let brand = brandByName.get(email.brand);
    if (!brand) {
      const themes: Record<string, number> = {};
      for (const theme of DATA.themes) themes[theme.key] = 0;
      brand = { name: email.brand, weekly: [0, 0, 0], total: 0, themes };
      brandByName.set(email.brand, brand);
    }
    const wi = weekIndex(email.date);
    brand.weekly[wi] += 1;
    brand.total += 1;
    weekTotals[wi] += 1;
    setOwnCount(brand.themes, email.theme, getOwnCount(brand.themes, email.theme) + 1);
    themeCounts.set(email.theme, (themeCounts.get(email.theme) ?? 0) + 1);
  }

  // 补齐：每个品牌的 themes 字典拥有窗口内全部主题的自有属性（缺失记 0），
  // 避免下游用动态 key 索引时命中 Object.prototype（如 constructor）。
  for (const brand of brandByName.values()) {
    for (const themeKey of themeCounts.keys()) {
      if (!Object.prototype.hasOwnProperty.call(brand.themes, themeKey)) {
        setOwnCount(brand.themes, themeKey, 0);
      }
    }
  }

  const brands = [...brandByName.values()].sort(
    (a, b) => (brandOrder.get(a.name) ?? DATA.brands.length) - (brandOrder.get(b.name) ?? DATA.brands.length),
  );

  const total = inWindow.length;
  const themes: ThreeWeekAggregatedTheme[] = [...themeCounts.entries()]
    .sort((a, b) => {
      const orderA = themeOrder.get(a[0]) ?? DATA.themes.length;
      const orderB = themeOrder.get(b[0]) ?? DATA.themes.length;
      if (orderA !== orderB) return orderA - orderB;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map(([key, count]) => ({
      key,
      labelZh: themeLabelZh.get(key) ?? (key === "other" ? "其他" : key),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

  return {
    window,
    windowDays: days,
    weeks,
    brands,
    weekTotals,
    grandTotal: total,
    themes,
    total,
  };
}

export function buildSiteInsights(data: ThreeWeekAggregatedData): string[] {
  if (data.total === 0) return ["该站点在三周窗口内暂无邮件，不推断主题偏好或触达策略。"];
  const leadingBrand = [...data.brands].sort((left, right) => right.total - left.total)[0];
  const leadingTheme = [...data.themes].sort((left, right) => right.count - left.count)[0];
  const peakIndex = data.weekTotals.indexOf(Math.max(...data.weekTotals));
  return [
    `当前站点三周收录 ${data.total} 封，覆盖 ${data.windowDays} 天，日均 ${(data.total / data.windowDays).toFixed(1)} 封；这是可见收录量，不是实际全量发送。`,
    `${leadingBrand.name} 收录最多：${leadingBrand.total} 封，占当前站点三周样本 ${(leadingBrand.total / data.total * 100).toFixed(1)}%。`,
    `${leadingTheme.labelZh}是当前主要主题：${leadingTheme.count} 封，占 ${(leadingTheme.count / data.total * 100).toFixed(1)}%；含服务/法务通知的其他主题不等于营销。`,
    `${data.weeks[peakIndex].label}（${data.weeks[peakIndex].range}）收录 ${data.weekTotals[peakIndex]} 封；各桶覆盖天数可能不同，不能仅凭总量判断营销效果。`,
  ];
}

export function buildAggregatedBrand(data: ThreeWeekAggregatedData, brandName: string): Brand {
  const aggregatedBrand = data.brands.find((brand) => brand.name === brandName);
  if (!aggregatedBrand) {
    throw new Error(`聚合结果中缺少品牌 ${brandName}。`);
  }
  return {
    name: brandName,
    weekly: [...aggregatedBrand.weekly],
    total: aggregatedBrand.total,
    perDay:
      data.windowDays > 0
        ? Math.round((aggregatedBrand.total / data.windowDays) * 10) / 10
        : 0,
    strategy: aggregatedBrand.total > 0
      ? `${brandName} 在当前站点三周窗口收录 ${aggregatedBrand.total} 封；下列主题和周分布均为实时聚合，不代表营销效果。`
      : `${brandName} 在当前站点三周窗口暂无邮件。`,
    themes: { ...aggregatedBrand.themes },
    campaigns: data.weeks.map((week, index) => `当前站点 ${week.range} 收录 ${aggregatedBrand.weekly[index]} 封邮件。`),
    // 聚合周标签（m1）：弹窗周标签用此处 weeks，不再用静态 DATA.weeks。
    weeks: data.weeks.map((week) => ({ id: week.id, label: week.label, range: week.range })),
  };
}
