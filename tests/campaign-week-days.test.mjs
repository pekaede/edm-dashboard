import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  THREE_WEEK_WINDOW,
  deriveThreeWeekWeeks,
  windowDays,
} from "../src/three-week-aggregation.ts";

const source = readFileSync(new URL("../src/components/CampaignOverview.tsx", import.meta.url), "utf8");
const zh = JSON.parse(readFileSync(new URL("../src/i18n/locales/zh.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));

describe("周覆盖天数标注（W3 天数不对等）", () => {
  it("三周窗口各周天数为 7/7/8，组件按 windowDays 逐周标注", () => {
    const weeks = deriveThreeWeekWeeks(THREE_WEEK_WINDOW);
    assert.deepEqual(weeks.map(windowDays), [7, 7, 8]);
    assert.ok(source.includes("windowDays"), "CampaignOverview 必须用 windowDays 计算每周天数");
    assert.ok(
      source.includes('t("campaignWeekDays", { days: windowDays(w) })'),
      "表头每周列必须渲染覆盖天数",
    );
  });

  it("单元格 tooltip 给出按本天数折算的日均", () => {
    assert.ok(source.includes("const perDay = days > 0 ? (n / days).toFixed(1)"), "日均必须以本格周天数为分母");
    assert.ok(source.includes('t("campaignTooltipPerDay")'), "tooltip 必须含日均行");
  });

  it("新增文案键中英齐全且带 days 参数", () => {
    for (const dict of [zh, en]) {
      assert.ok(dict.campaignWeekDays?.includes("{days}"), "campaignWeekDays 必须带 {days} 参数");
      assert.ok(typeof dict.campaignTooltipPerDay === "string" && dict.campaignTooltipPerDay.length > 0);
    }
  });
});
