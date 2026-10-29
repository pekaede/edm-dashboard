import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIVE_WINDOW } from "../src/data-window.ts";
import {
  THREE_WEEK_WINDOW,
  aggregateThreeWeek,
  deriveThreeWeekWeeks,
  windowDays,
} from "../src/three-week-aggregation.ts";

describe("数据窗口边界", () => {
  it("live 窗口固定当前起止，含首尾共 93 天", () => {
    assert.deepEqual(LIVE_WINDOW, { start: "2026-07-28", end: "2026-10-28" });
    assert.equal(windowDays(LIVE_WINDOW), 93);
  });

  it("三周窗口含首尾共 22 天，完全落在 live 窗口内", () => {
    assert.deepEqual(THREE_WEEK_WINDOW, { start: "2026-10-07", end: "2026-10-28" });
    assert.equal(windowDays(THREE_WEEK_WINDOW), 22);
    assert.ok(THREE_WEEK_WINDOW.start >= LIVE_WINDOW.start);
    assert.equal(THREE_WEEK_WINDOW.end, LIVE_WINDOW.end);
  });

  it("按窗口起点派生连续的 7、7、8 天分桶及标签", () => {
    const weeks = deriveThreeWeekWeeks(THREE_WEEK_WINDOW);
    assert.deepEqual(weeks, [
      { id: "W1", label: "Week 1", range: "10/7–10/13", start: "2026-10-07", end: "2026-10-13" },
      { id: "W2", label: "Week 2", range: "10/14–10/20", start: "2026-10-14", end: "2026-10-20" },
      { id: "W3", label: "Week 3", range: "10/21–10/28", start: "2026-10-21", end: "2026-10-28" },
    ]);
    assert.deepEqual(weeks.map(windowDays), [7, 7, 8]);
  });

  it("聚合包含窗口和各周首尾，排除前一天和后一天", () => {
    const dates = [
      "2026-10-06", "2026-10-07", "2026-10-13", "2026-10-14",
      "2026-10-20", "2026-10-21", "2026-10-28", "2026-10-29",
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
