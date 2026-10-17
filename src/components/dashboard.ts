// 冻结快照常量 TOTAL / DAYS 已删除（B2）：KPI 不再用 DATA.meta.total = 196，
// 改由 KpiGrid 对 emails 表做 3 周实时聚合（默认窗口全市场 211，日均 211/22）。
export const THEME_COLORS: Record<string, string> = {
  price: "var(--theme-price)",
  behavior: "var(--theme-behavior)",
  new: "var(--theme-new)",
  lifestyle: "var(--theme-lifestyle)",
  category: "var(--theme-category)",
  other: "var(--theme-other)",
};
export const THEME_TINTS: Record<string, string> = {
  price: "var(--theme-price-tint)",
  behavior: "var(--theme-behavior-tint)",
  new: "var(--theme-new-tint)",
  lifestyle: "var(--theme-lifestyle-tint)",
  category: "var(--theme-category-tint)",
  other: "var(--theme-other-tint)",
};
export const THEME_LABEL_COLORS: Record<string, string> = {
  price: "var(--theme-price-label)",
  behavior: "var(--theme-behavior-label)",
  new: "var(--theme-new-label)",
  lifestyle: "var(--theme-lifestyle-label)",
  category: "var(--theme-category-label)",
  other: "var(--theme-other-label)",
};
