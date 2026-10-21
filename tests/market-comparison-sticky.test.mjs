import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const source = readFileSync(new URL("../src/components/MarketComparison.tsx", import.meta.url), "utf8");

function findTh(tag) {
  const match = source.match(new RegExp("<th\\s+scope=\"" + tag + "\"\\s+className=\"([^\"]*)\""))?.[1];
  assert.ok(match, "必须读取 scope=\"" + tag + "\" 的 th className");
  return match;
}

it("对比矩阵表头首列横滚时吸附固定", () => {
  const className = findTh("col");
  for (const cls of ["sticky", "left-0", "z-10", "bg-[var(--surface-subtle)]", "shadow-[1px_0_0_0_var(--border-default)]"]) {
    assert.ok(className.includes(cls), "表头首列必须含 " + cls + "，实际：" + className);
  }
});

it("对比矩阵行首列与合计行首列横滚时吸附固定且底色不透明", () => {
  const rows = [...source.matchAll(/<th\s+scope="row"\s+className="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(rows.length >= 2, "必须找到行首列与合计行首列");
  for (const className of rows) {
    for (const cls of ["sticky", "left-0", "z-10", "shadow-[1px_0_0_0_var(--border-default)]"]) {
      assert.ok(className.includes(cls), "行首列必须含 " + cls + "，实际：" + className);
    }
    assert.ok(/bg-\[var\(--surface-(card|subtle)\)\]/.test(className), "行首列必须有不透明底色，实际：" + className);
  }
});
