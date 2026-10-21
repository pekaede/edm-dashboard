import { loadSourceModule } from "./source-module.mjs";
import * as windows from "../src/data-window.ts";
import { aggregateThreeWeek } from "../src/three-week-aggregation.ts";

export const emailData = loadSourceModule("email-data.ts", {
  imports: {
    "./data-window": windows,
    "./supabase": {
      fetchEmailDataset() { throw new Error("纯逻辑测试不应请求网络"); },
      isIncompleteDataError: () => false,
    },
  },
});

export function email(date = "2026-10-01", market = "US", overrides = {}) {
  return { date, market, brand: "Zara", theme: "new", keywords: [], day_seq: 1, source_index: 0, ...overrides };
}

export function loadSiteData({ snapshot, aggregate = aggregateThreeWeek, locale = "zh", label = (market) => market ?? "全部" } = {}) {
  return loadSourceModule("site-data.tsx", {
    expose: ["createSiteDataCache"],
    imports: {
      "./email-data": { ...emailData, useExtendedEmails: () => snapshot },
      "./components/MarketFilter": { getMarketLabel: label },
      "./i18n": { useLocale: () => ({ locale }) },
      "./three-week-aggregation": { aggregateThreeWeek: aggregate },
    },
  });
}
