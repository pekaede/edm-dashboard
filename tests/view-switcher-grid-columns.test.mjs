import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// 视图切换器有 4 个链接，列数必须整除 4 才能对称排列（repeat(3) 会让第 4 项单独掉行）。
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const tsx = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

function viewSwitcherRule() {
  const block = css.match(/\.view-switcher\s*{([^}]*)}/)?.[1];
  assert.ok(block, ".view-switcher 规则应存在");
  return block;
}

describe("view switcher grid columns", () => {
  it("窄屏切换器用 2 列（2×2 对称），不用 3 列", () => {
    const block = viewSwitcherRule();
    assert.ok(block.includes("repeat(2, minmax(0, 1fr))"));
    assert.ok(!block.includes("repeat(3,"));
  });

  it("切换器内恰好 4 个链接，列数整除链接数", () => {
    const linkCount = (tsx.match(/view-switcher-link/g) ?? []).length;
    assert.equal(linkCount, 4, "应有 4 个视图链接");
    assert.equal(linkCount % 2, 0, "列数应整除链接数");
  });
});
