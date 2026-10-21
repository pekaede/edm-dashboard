import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DATA } from "../src/data.ts";
import * as windows from "../src/data-window.ts";
import { loadSourceModule } from "./source-module.mjs";
import { email, emailData } from "./site-data-fixtures.mjs";

// 开放组件的私有纯函数，传入真实窗口参数；不修改聚合实现。
function loadComparison() {
  return loadSourceModule("components/MarketComparison.tsx", {
    expose: ["aggregateComparison", "weeklyAvg"],
    imports: {
      "../data": { DATA },
      "../email-data": emailData,
      "../i18n": {}, "./Card": {}, "./dashboard": {}, "./ExtendedEmailsState": {},
      "./MarketFilter": {}, "./Tooltip": {}, "../three-week-aggregation": {},
    },
  });
}

const snapshotMeta = { windowStart: windows.SNAPSHOT_WINDOW.start, windowEnd: windows.SNAPSHOT_WINDOW.end };

describe("MarketComparison 周桶纯逻辑", () => {
  it("给定窗口只统计首尾以内的邮件，跨周边界及最后不足七天的桶不丢计数", () => {
    const { aggregateComparison } = loadComparison();
    const dates = ["2026-07-15", "2026-07-16", "2026-07-22", "2026-07-23",
      "2026-10-14", "2026-10-15", "2026-10-16"];
    const data = aggregateComparison(dates.map((date, index) => email(date, "US", { source_index: index })), snapshotMeta);
    assert.equal(data.grandTotal, 5);
    assert.equal(data.marketTotals.get("US"), 5);
    assert.equal(data.brandTotals.get("Zara"), 5);
    assert.equal(data.themeTotals.get("new"), 5);
    assert.equal(data.brandMarket.get("Zara").get("US"), 5);
    assert.equal(data.themeMarket.get("new").get("US"), 5);
    assert.equal(data.windowStart, snapshotMeta.windowStart);
    assert.equal(data.windowEnd, snapshotMeta.windowEnd);
    assert.equal(data.weeks.length, 14);
    assert.deepEqual(data.weeks[0], { index: 0, label: "W1", range: "7/16–7/22", start: "2026-07-16", end: "2026-07-22" });
    assert.deepEqual(data.weeks.at(-1), { index: 13, label: "W14", range: "10/15–10/15", start: "2026-10-15", end: "2026-10-15" });
    assert.deepEqual(data.brandMarketWeekly.get("Zara").get("US"), [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
  });

  it("稀疏样本的周均分母取完整快照窗口 92 天，不能取 14 桶或样本跨度", () => {
    const { aggregateComparison, weeklyAvg } = loadComparison();
    const data = aggregateComparison([email("2026-08-20"), email("2026-08-21")], snapshotMeta);
    assert.equal(data.windowDays, 92);
    assert.equal(data.weeks.length, 14);
    assert.equal(data.windowStart, snapshotMeta.windowStart);
    assert.equal(data.windowEnd, snapshotMeta.windowEnd);
    assert.equal(weeklyAvg(92, data.windowDays), "7.0");
    assert.equal(weeklyAvg(100, data.windowDays), "7.6");
    assert.equal(weeklyAvg(data.grandTotal, data.windowDays), "0.2");
    assert.equal(weeklyAvg(0, data.windowDays), "0.0");
    assert.equal(weeklyAvg(1, 0), "0.0");
    assert.equal(weeklyAvg(1, -1), "0.0");
  });

  it("窗口外全部排除，空周保留且不同市场的周计数相互隔离", () => {
    const { aggregateComparison } = loadComparison();
    const meta = { windowStart: "2026-12-29", windowEnd: "2027-01-06" };
    const data = aggregateComparison([
      email("2026-12-28"), email("2026-12-29"), email("2027-01-04", "UK"),
      email("2027-01-05", "UK"), email("2027-01-06"), email("2027-01-07", "UK"),
    ], meta);
    assert.equal(data.windowDays, 9);
    assert.equal(data.grandTotal, 4);
    assert.deepEqual(data.brandMarketWeekly.get("Zara").get("US"), [1, 1]);
    assert.deepEqual(data.brandMarketWeekly.get("Zara").get("UK"), [1, 1]);
    const excluded = aggregateComparison([email("2026-12-28"), email("2027-01-07")], meta);
    assert.equal(excluded.grandTotal, 0);
    assert.equal(excluded.marketTotals.size, 0);
    assert.equal(excluded.brandMarketWeekly.size, 0);
    assert.equal(excluded.weeks.length, 2);
  });

  it("真实 JSON 快照经原适配器加载后，在快照窗口保留全部 770 封，周均使用 92 天", async () => {
    const jsonEmailData = loadSourceModule("email-data.ts", {
      env: { VITE_EDM_DATA_SOURCE: "json" },
      imports: { "./data-window": windows, "./supabase": {} },
    });
    const { loadJsonEmailDataset } = loadSourceModule("email-data-json.ts", {
      imports: { "./email-data": jsonEmailData },
      importMeta: {
        glob(patterns) {
          return Object.fromEntries(patterns.map((path) => [path, async () =>
            JSON.parse(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"))]));
        },
      },
    });
    const { emails, expectedTotal } = await loadJsonEmailDataset();
    assert.equal(expectedTotal, 770);
    const { aggregateComparison, weeklyAvg } = loadComparison();
    const data = aggregateComparison(emails, jsonEmailData.EXTENDED_EMAIL_META);
    assert.equal(data.grandTotal, 770);
    assert.equal(data.marketTotals.get("US"), 770);
    assert.equal(data.windowDays, 92);
    assert.equal(weeklyAvg(data.grandTotal, data.windowDays), "58.6");
    const bucketTotal = [...data.brandMarketWeekly.values()].flatMap((markets) => [...markets.values()])
      .reduce((total, weekly) => total + weekly.reduce((sum, count) => sum + count, 0), 0);
    assert.equal(bucketTotal, 770);
  });
});
