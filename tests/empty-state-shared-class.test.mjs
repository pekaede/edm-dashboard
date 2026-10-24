import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const componentNames = [
  "WordCloud",
  "MarkdownReport",
  "ThemeDistribution",
  "CalendarView",
  "CampaignOverview",
  "BrandThemeBreakdown",
  "KpiGrid",
];
const componentSources = componentNames.map((name) => ({
  name,
  source: readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8"),
}));
const sharedSource = readFileSync(
  new URL("../src/components/empty-state-class.ts", import.meta.url),
  "utf8",
);

// 提取前逐一核对过的 7 处完整字符串，作为固定基准防止样式漂移。
const originalClassName =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--control-active-bg)] [&_button]:text-[var(--control-active-text)] [&_button:hover]:bg-[var(--control-active-hover-bg)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

describe("shared empty state class", () => {
  it("removes local EMPTY_STATE_CLASS_NAME definitions from all seven components", () => {
    for (const { name, source } of componentSources) {
      assert.doesNotMatch(source, /^\s*const\s+EMPTY_STATE_CLASS_NAME\b/m, name);
    }
  });

  it("imports EMPTY_STATE_CLASS_NAME from the shared module in all seven components", () => {
    for (const { name, source } of componentSources) {
      assert.match(
        source,
        /^import\s*\{\s*EMPTY_STATE_CLASS_NAME\s*\}\s*from\s*"\.\/empty-state-class";/m,
        name,
      );
    }
  });

  it("exports the complete original class string without any changes", () => {
    const definition = sharedSource.match(
      /^export const EMPTY_STATE_CLASS_NAME\s*=\s*("[^"\r\n]*");$/m,
    );
    assert.ok(definition, "shared module must export the string literal");
    assert.equal(definition[1], JSON.stringify(originalClassName));
  });
});
