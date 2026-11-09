import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIVE_WINDOW } from "../src/data-window.ts";
import { sourceGraph } from "./mounted-source.mjs";
import {
  THREE_WEEK_WINDOW,
  aggregateThreeWeek,
  deriveThreeWeekWeeks,
  windowDays,
} from "../src/three-week-aggregation.ts";

describe("数据窗口边界", () => {
  it("live 窗口固定当前起止，含首尾共 93 天", () => {
    assert.deepEqual(LIVE_WINDOW, { start: "2026-08-08", end: "2026-11-08" });
    assert.equal(windowDays(LIVE_WINDOW), 93);
  });

  it("三周窗口含首尾共 22 天，完全落在 live 窗口内", () => {
    assert.deepEqual(THREE_WEEK_WINDOW, { start: "2026-10-18", end: "2026-11-08" });
    assert.equal(windowDays(THREE_WEEK_WINDOW), 22);
    assert.ok(THREE_WEEK_WINDOW.start >= LIVE_WINDOW.start);
    assert.equal(THREE_WEEK_WINDOW.end, LIVE_WINDOW.end);
  });

  it("按窗口起点派生连续的 7、7、8 天分桶及标签", () => {
    const weeks = deriveThreeWeekWeeks(THREE_WEEK_WINDOW);
    assert.deepEqual(weeks, [
      { id: "W1", label: "Week 1", range: "10/18–10/24", start: "2026-10-18", end: "2026-10-24" },
      { id: "W2", label: "Week 2", range: "10/25–10/31", start: "2026-10-25", end: "2026-10-31" },
      { id: "W3", label: "Week 3", range: "11/1–11/8", start: "2026-11-01", end: "2026-11-08" },
    ]);
    assert.deepEqual(weeks.map(windowDays), [7, 7, 8]);
  });

  it("聚合包含窗口和各周首尾，排除前一天和后一天", () => {
    const dates = [
      "2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25",
      "2026-10-31", "2026-11-01", "2026-11-08", "2026-11-09",
    ];
    const emails = dates.map((date, index) => ({
      date, brand: "Zara", theme: "new", keywords: [], market: "US",
      day_seq: 1, source_index: index,
    }));
    const data = aggregateThreeWeek(emails);
    assert.deepEqual(data.window, THREE_WEEK_WINDOW);
    assert.equal(data.windowDays, 22);
    assert.equal(data.total, 6);
    assert.equal(data.grandTotal, 6);
    assert.deepEqual(data.weekTotals, [2, 2, 2]);
    assert.deepEqual(data.brands.find((brand) => brand.name === "Zara").weekly, [2, 2, 2]);
  });

  it("JSON 回滚完整加载历史快照，并保留历史三周窗口及分桶", async () => {
    const graph = sourceGraph({ env: { VITE_EDM_DATA_SOURCE: "json" } });
    const { EXTENDED_EMAIL_META } = graph.load("email-data.ts");
    assert.equal(EXTENDED_EMAIL_META.windowStart, "2026-07-16");
    assert.equal(EXTENDED_EMAIL_META.windowEnd, "2026-10-15");
    const { emails, expectedTotal } = await graph.load("email-data-json.ts").loadJsonEmailDataset();
    assert.equal(expectedTotal, 770);
    assert.equal(emails.length, expectedTotal);

    const jsonAggregation = graph.load("three-week-aggregation.ts");
    const data = jsonAggregation.aggregateThreeWeek(emails);
    assert.deepEqual(jsonAggregation.THREE_WEEK_WINDOW, { start: "2026-09-24", end: "2026-10-15" });
    assert.deepEqual(data.window, jsonAggregation.THREE_WEEK_WINDOW);
    assert.equal(data.windowDays, 22);
    assert.deepEqual(data.weeks.map(({ start, end }) => ({ start, end })), [
      { start: "2026-09-24", end: "2026-09-30" },
      { start: "2026-10-01", end: "2026-10-07" },
      { start: "2026-10-08", end: "2026-10-15" },
    ]);
    const expected = emails.filter((email) => email.date >= "2026-09-24" && email.date <= "2026-10-15");
    assert.ok(expected.length > 0);
    assert.equal(data.total, expected.length);
    assert.equal(data.weekTotals.reduce((sum, total) => sum + total, 0), expected.length);
  });

  it("滑动窗口跨年时仍按起点分桶", () => {
    const window = { start: "2026-12-25", end: "2027-01-15" };
    assert.equal(windowDays(window), 22);
    assert.deepEqual(
      deriveThreeWeekWeeks(window).map(({ start, end, range }) => ({ start, end, range })),
      [
        { start: "2026-12-25", end: "2026-12-31", range: "12/25–12/31" },
        { start: "2027-01-01", end: "2027-01-07", range: "1/1–1/7" },
        { start: "2027-01-08", end: "2027-01-15", range: "1/8–1/15" },
      ],
    );
  });

  it("接受最短 15 天窗口，拒绝不足 15 天的窗口", () => {
    assert.deepEqual(
      deriveThreeWeekWeeks({ start: "2026-10-01", end: "2026-10-15" }).map(windowDays),
      [7, 7, 1],
    );
    assert.throws(
      () => deriveThreeWeekWeeks({ start: "2026-10-01", end: "2026-10-14" }),
      /至少需要 15 天/,
    );
  });
});
