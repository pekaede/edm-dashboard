import { DATA } from "../data";

export const TOTAL = DATA.meta.total;
export const DAYS = 22;
export const PALETTE = ["#111827", "#e85d7a", "#2563eb", "#3fa66a", "#8e7cc3", "#f0a030"];

export function pct(n: number) {
  return ((n / TOTAL) * 100).toFixed(1);
}
