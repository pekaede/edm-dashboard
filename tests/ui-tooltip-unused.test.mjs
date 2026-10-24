import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const srcPath = fileURLToPath(new URL("../src/", import.meta.url));
const radixTooltipPath = join(srcPath, "components/ui/tooltip.tsx");
const customTooltipPath = join(srcPath, "components/Tooltip.tsx");

function typeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function importsFile(file, target) {
  const source = readFileSync(file, "utf8");
  const imports = source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["']([^"']+)["']/g);
  return [...imports].some(([, specifier]) =>
    specifier.startsWith(".") &&
    resolve(dirname(file), specifier).replace(/\.tsx?$/, "") === target.replace(/\.tsx?$/, ""),
  );
}

it("零调用方的 Radix Tooltip 封装已删除", () => {
  assert.equal(existsSync(radixTooltipPath), false);
});

it("src 下没有 TypeScript 文件导入已删除的 Radix Tooltip 封装", () => {
  const callers = typeScriptFiles(srcPath)
    .filter((file) => importsFile(file, radixTooltipPath))
    .map((file) => relative(srcPath, file));
  assert.deepEqual(callers, [], "不应存在 Radix Tooltip 封装调用方");
});

it("自定义 Tooltip 仍存在且被组件导入", () => {
  assert.equal(existsSync(customTooltipPath), true);
  const callers = typeScriptFiles(join(srcPath, "components"))
    .filter((file) => file !== customTooltipPath && importsFile(file, customTooltipPath));
  assert.ok(callers.length > 0, "至少一个组件必须继续导入自定义 Tooltip");
});
