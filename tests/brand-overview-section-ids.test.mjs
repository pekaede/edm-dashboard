import assert from "node:assert/strict";
import test from "node:test";
import { loadSourceModule } from "./source-module.mjs";

const { brandOverviewSectionIds } = loadSourceModule("components/BrandOverview.tsx", {
  imports: {
    "../i18n": {},
    "../supabase": {},
    "./EmptyState": {},
    "./PageNav": {},
    "./ui/loading-block": {},
  },
});

test("现有六个品牌的锚点保持不变且保留输入顺序", () => {
  const brands = ["Halara", "ALO Yoga", "SHEIN", "Temu", "lululemon", "Zara"];
  const slugs = ["halara", "alo-yoga", "shein", "temu", "lululemon", "zara"];
  assert.deepEqual([...brandOverviewSectionIds(brands)], brands.map((brand, index) => [brand, slugs[index]]));
});

test("slug 冲突时首个品牌保留原值，后续品牌添加后缀", () => {
  assert.deepEqual([...brandOverviewSectionIds(["A B", "A-B"])], [
    ["A B", "a-b"], ["A-B", "a-b-2"],
  ]);
  assert.deepEqual([...brandOverviewSectionIds(["A-B", "A B"])], [
    ["A-B", "a-b"], ["A B", "a-b-2"],
  ]);
});

test("纯中文品牌使用非空且不同的备用锚点", () => {
  assert.deepEqual([...brandOverviewSectionIds(["品牌甲", "品牌乙"])], [
    ["品牌甲", "brand"], ["品牌乙", "brand-2"],
  ]);
});

test("原始 slug 与已分配后缀冲突时仍生成唯一锚点，并跳过已用值", () => {
  const brands = ["A B", "A-B", "A B-2"];
  const ids = brandOverviewSectionIds(brands);
  assert.deepEqual([...ids.values()], ["a-b", "a-b-2", "a-b-2-2"]);
  assert.equal(new Set(ids.values()).size, brands.length);
  assert.deepEqual([...brandOverviewSectionIds(["A B", "A B-2", "A-B"]).values()], [
    "a-b", "a-b-2", "a-b-3",
  ]);
});
