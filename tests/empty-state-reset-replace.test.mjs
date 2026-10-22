import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../src/components/ExtendedEmailFilter.tsx", import.meta.url), "utf8");

it("空态“重置所有筛选”用 replace 语义写回 URL（后退不退回空结果页）", () => {
  // 只截取 actionLabel 为 efResetFilterSearch 的那个 EmptyState 块：
  // tempered 模式保证匹配不跨越另一个 <EmptyState 实例（如市场空态 stEmptyMarketTitle）。
  const block = source.match(
    /<EmptyState\b(?:(?!<EmptyState)[\s\S])*?actionLabel=\{t\("efResetFilterSearch"\)\}(?:(?!<EmptyState)[\s\S])*?\/>/,
  )?.[0];
  assert.ok(block, "必须读取邮件列表空态（efResetFilterSearch）EmptyState 块");
  assert.match(
    block,
    /setUrlState\(\s*\(current\)\s*=>\s*\(\{\s*\.\.\.current,\s*brand:\s*"all",\s*theme:\s*null,\s*query:\s*"",\s*dateFrom:\s*"",\s*dateTo:\s*""\s*\}\)/,
    "空态重置须清空品牌/主题/搜索/日期并写回 URL",
  );
  assert.match(
    block,
    /setUrlState\([\s\S]*?,\s*\{\s*replace:\s*true\s*\}\s*,?\s*\)/,
    "空态重置必须以 setUrlState 第二参数传 { replace: true }，避免后退死胡同",
  );
});
