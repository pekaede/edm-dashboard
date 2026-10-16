import { DATA } from "../data";

export const TOTAL = DATA.meta.total;
export const DAYS = 22;
export const PALETTE = ["#312e81", "#4f46e5", "#6366f1", "#64748b", "#334155"];
export const THEME_COLORS: Record<string, string> = {
  price: "#4f46e5",
  behavior: "#0ea5e9",
  new: "#14b8a6",
  lifestyle: "#8b5cf6",
  category: "#64748b",
};

export function pct(n: number) {
  return ((n / TOTAL) * 100).toFixed(1);
}
