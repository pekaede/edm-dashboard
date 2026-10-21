import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const tooltip = readFileSync(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
const themeDistribution = readFileSync(new URL("../src/components/ThemeDistribution.tsx", import.meta.url), "utf8");

it("Tooltip 声明可选 anchorRole，默认 img 并用于锚点角色", () => {
  const props = tooltip.match(/export interface TooltipProps\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(props, "必须读取 TooltipProps 声明");
  assert.match(props, /\banchorRole\?\s*:\s*"img"\s*\|\s*"group"\s*;/);

  const parameters = tooltip.match(/export function Tooltip\(\{([\s\S]*?)\}:\s*TooltipProps\)/)?.[1];
  assert.ok(parameters, "必须读取 Tooltip 参数默认值");
  assert.match(parameters, /\banchorRole\s*=\s*"img"/);

  const anchor = tooltip.match(/<div\s+ref=\{anchorRef\}[^>]*?aria-label=\{label\}/)?.[0];
  assert.ok(anchor, "必须读取提示锚点 div");
  assert.match(anchor, /\brole=\{anchorRole\}/);
});

it("主题环图的 Tooltip 使用 group 保留 SVG 切片链接语义", () => {
  assert.match(themeDistribution, /<Tooltip\b[^>]*\banchorRole="group"/);
});
