import { DATA } from "../data";
import type { CSSProperties } from "react";

export const TOTAL = DATA.meta.total;
export const DAYS = 22;
export const PALETTE = [
  "#e85d75",
  "#f2a93b",
  "#39a96b",
  "#8b6bd6",
  "#55a6e8",
  "#cf4965",
  "#d98d20",
  "#258b55",
  "#7152bb",
  "#368ac8",
];
export const THEME_COLORS: Record<string, string> = {
  price: "#e55f47",
  behavior: "#c38a24",
  new: "#568d72",
  lifestyle: "#8069a3",
  category: "#558b97",
};
export const THEME_TINTS: Record<string, string> = {
  price: "#fff0eb",
  behavior: "#fff7e2",
  new: "#edf7f1",
  lifestyle: "#f4f0f9",
  category: "#edf6f7",
};
export const THEME_LABEL_COLORS: Record<string, string> = {
  price: "#171411",
  behavior: "#171411",
  new: "#171411",
  lifestyle: "#ffffff",
  category: "#171411",
};

export const DASHBOARD_THEME_STYLE = {
  "--theme-price": THEME_COLORS.price,
  "--theme-behavior": THEME_COLORS.behavior,
  "--theme-new": THEME_COLORS.new,
  "--theme-lifestyle": THEME_COLORS.lifestyle,
  "--theme-category": THEME_COLORS.category,
  "--theme-category-tint": THEME_TINTS.category,
} as CSSProperties;
