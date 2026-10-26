import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sourceGraph } from "./mounted-source.mjs";

// buildAggregatedBrand 的 strategy 是生成型文本，改走注入翻译函数后用真实 i18n 固定 zh 验证。
const graph = sourceGraph();
const { aggregateThreeWeek, buildAggregatedBrand } = graph.load("three-week-aggregation.ts");
const { translateIn } = graph.load("i18n/index.tsx");
const trZh = (key, values) => translateIn("zh", key, values);

describe("品牌 0 收录文案（免责口径）", () => {
  const emails = [
    { date: "2026-10-06", brand: "Zara", theme: "new", keywords: [], market: "US", day_seq: 1, source_index: 0 },
  ];
  const data = aggregateThreeWeek(emails);

  it("窗口内 0 收录的品牌文案声明未收录不等于未发送", () => {
    const brand = buildAggregatedBrand(data, "Temu", trZh);
    assert.equal(brand.total, 0);
    assert.equal(
      brand.strategy,
      "Temu 在当前站点三周窗口内暂未收录到邮件；未收录不代表该品牌未发送，可能存在渠道未覆盖。",
    );
    assert.ok(!brand.strategy.includes("暂无邮件"), "不得再断言品牌未发邮件");
  });

  it("有收录的品牌文案保持收录口径不变", () => {
    const brand = buildAggregatedBrand(data, "Zara", trZh);
    assert.equal(brand.total, 1);
    assert.ok(brand.strategy.includes("三周窗口收录 1 封"));
  });
});
