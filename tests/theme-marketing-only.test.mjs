import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { aggregateThreeWeek } from "../src/three-week-aggregation.ts";

const source = readFileSync(new URL("../src/components/ThemeDistribution.tsx", import.meta.url), "utf8");
const zh = JSON.parse(readFileSync(new URL("../src/i18n/locales/zh.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));

describe("主题分布「仅营销主题」开关", () => {
  it("开关为 aria-pressed 按钮，文案键中英齐全", () => {
    assert.ok(source.includes("aria-pressed={excludeOther}"), "开关必须暴露 aria-pressed 状态");
    assert.ok(source.includes('t("tdMarketingOnly")'), "开关必须用 tdMarketingOnly 文案键");
    assert.ok(zh.tdMarketingOnly && en.tdMarketingOnly, "tdMarketingOnly 中英必须齐全");
  });

  it("开关旁注明仅本卡生效，文案键中英齐全且组件已引用", () => {
    assert.ok(zh.tdMarketingOnlyScope && en.tdMarketingOnlyScope, "tdMarketingOnlyScope 中英必须齐全");
    assert.ok(source.includes('t("tdMarketingOnlyScope")'), "组件必须在开关附近渲染仅本卡生效注脚");
  });

  it("仅在 0 < other < total 时提供开关，避免分母为 0", () => {
    assert.ok(
      source.includes("const canExcludeOther = otherCount > 0 && otherCount < data.total"),
      "开关可用条件必须守住分母",
    );
    assert.ok(source.includes("const activeTotal = excludeOther ? data.total - otherCount : data.total"));
  });

  it("切片角度与占比都以 activeTotal 为分母，other 被剔出切片", () => {
    assert.ok(source.includes("theme.count / activeTotal * 360"), "切片角度必须用 activeTotal");
    assert.ok(
      source.includes("Math.round((theme.count / activeTotal) * 100)"),
      "剔除后占比必须按 activeTotal 重算",
    );
    assert.ok(source.includes('theme.key !== "other"'), "剔除时必须过滤 other 主题");
  });

  it("按聚合数据验证剔除规则的数学：分母减 other、各主题占比重算", () => {
    const mk = (theme, i) => ({ date: "2026-10-01", brand: "Zara", theme, keywords: [], market: "US", day_seq: 1, source_index: i });
    const emails = [
      ...Array.from({ length: 5 }, (_, i) => mk("price", i)),
      ...Array.from({ length: 3 }, (_, i) => mk("new", 10 + i)),
      ...Array.from({ length: 2 }, (_, i) => mk("other", 20 + i)),
    ];
    const data = aggregateThreeWeek(emails);
    assert.equal(data.total, 10);
    const otherCount = data.themes.find((theme) => theme.key === "other").count;
    assert.equal(otherCount, 2);
    const activeTotal = data.total - otherCount;
    const visible = data.themes.filter((theme) => theme.count > 0 && theme.key !== "other");
    assert.deepEqual(
      visible.map((theme) => ({ key: theme.key, pct: Math.round((theme.count / activeTotal) * 100) })),
      [
        { key: "price", pct: 63 },
        { key: "new", pct: 38 },
      ],
    );
    // 未剔除时 other 占 20%，营销主题被稀释——这正是开关要解决的问题。
    assert.equal(data.themes.find((theme) => theme.key === "other").pct, 20);
    assert.equal(data.themes.find((theme) => theme.key === "price").pct, 50);
  });
});
