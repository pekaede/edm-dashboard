import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");
const declarations = (body) => Object.fromEntries(
  [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);
const light = declarations(css.split('[data-theme="dark"] {')[0]);
const darkOverrides = declarations(css.split('[data-theme="dark"] {')[1]);
const dark = { ...light, ...darkOverrides };

function resolve(tokens, name) {
  const value = tokens[name];
  assert.ok(value, `未定义 token ${name}`);
  const variable = value.match(/^var\((--[\w-]+)\)$/);
  return variable ? resolve(tokens, variable[1]) : value;
}

function contrast(first, second) {
  const luminance = (color) => {
    assert.match(color, /^#[\da-f]{6}$/i);
    const channels = color.slice(1).match(/../g).map((hex) => {
      const sRGB = parseInt(hex, 16) / 255;
      return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function check(foreground, background, minimum = 4.5) {
  const ratio = contrast(resolve(dark, `--${foreground}`), resolve(dark, `--${background}`));
  assert.ok(ratio >= minimum, `${foreground} / ${background}: ${ratio.toFixed(2)} < ${minimum}`);
}

it("深色块覆盖全部背景、文字、边框、分隔线、控件、状态、热力与阴影语义 token", () => {
  const semantic = /^--(?:surface-|text-|border-|divider|chart-|accent|word-|status-|control-|calendar-heat-|shadow-|card-(?:border|shadow|report-shadow)|filter-chart-hover|selection-bg|scrollbar-thumb)/;
  for (const name of Object.keys(declarations(css.match(/:root\s*{([\s\S]*?)}/)[1]))) {
    if (semantic.test(name)) assert.ok(Object.hasOwn(darkOverrides, name), `深色覆盖遗漏 ${name}`);
  }
  for (const name of ["price", "behavior", "new", "lifestyle", "category", "other"]) {
    assert.equal(resolve(dark, `--theme-${name}`), resolve(light, `--theme-${name}`), "数据色保持语义");
  }
});

it("邮件列表实际表头的文字与背景在深浅两种模式下至少 4.5:1", () => {
  const source = readFileSync(new URL("../src/components/ExtendedEmailFilter.tsx", import.meta.url), "utf8");
  const header = source.match(/<thead\b[^>]*\bclassName="([^"]*)"/)?.[1];
  assert.ok(header, "必须读取组件实际表头的 className");
  const foreground = header.match(/\btext-\[var\((--[\w-]+)\)\]/)?.[1];
  const background = header.match(/\bbg-\[var\((--[\w-]+)\)\]/)?.[1];
  assert.ok(foreground && background, "表头必须使用文字和背景 CSS 变量");
  for (const [mode, tokens] of [["light", light], ["dark", dark]]) {
    const ratio = contrast(resolve(tokens, foreground), resolve(tokens, background));
    assert.ok(ratio >= 4.5, `${mode} 表头 ${foreground} / ${background}: ${ratio.toFixed(2)} < 4.5`);
  }
});

for (const [mode, tokens] of [["浅色", light], ["深色", dark]]) {
  it(`语言激活按钮的实际文字与柔和背景在${mode}模式下至少 4.5:1`, () => {
    const source = readFileSync(new URL("../src/i18n/LanguageToggle.tsx", import.meta.url), "utf8");
    const active = source.match(/\bisActive\s*\?\s*"([^"]+)"/)?.[1];
    assert.ok(active, "必须读取组件实际激活分支的 className");
    const classes = active.split(/\s+/);
    const foreground = classes.map((name) => name.match(/^text-\[var\((--[\w-]+)\)\]$/)?.[1]).find(Boolean);
    const background = classes.map((name) => name.match(/^bg-\[var\((--[\w-]+)\)\]$/)?.[1]).find(Boolean);
    assert.ok(foreground && background, "语言激活项必须使用文字和背景 CSS 变量");
    const ratio = contrast(resolve(tokens, foreground), resolve(tokens, background));
    assert.ok(ratio >= 4.5, `${mode} 语言激活项 ${foreground} / ${background}: ${ratio.toFixed(2)} < 4.5`);
  });
}

it("深色文字、词云、控件和六档热力标签至少 4.5:1，数据图形至少 3:1", () => {
  for (const background of ["surface-page", "surface-card", "surface-raised", "surface-subtle", "surface-table-hover"]) {
    for (const foreground of ["text-primary", "text-body", "text-heading", "text-secondary", "text-muted", "text-description", "text-caption"]) {
      check(foreground, background);
    }
  }
  for (const name of ["label", "control", "detail", "email-intro", "email-table", "email-brand", "notice"]) {
    check(`text-${name}`, "surface-card");
  }
  for (const name of ["heading", "secondary", "muted", "outside", "label"]) {
    check(`text-calendar-${name}`, "surface-calendar");
  }
  for (const name of ["category", "promotion", "style", "audience", "other"]) {
    check(`word-${name}`, "surface-raised");
    check(`word-${name}`, "surface-wordcloud-hover");
  }
  for (const name of ["price", "behavior", "new", "lifestyle", "category", "other"]) {
    check(`theme-${name}-text`, `theme-${name}-tint`);
    check(`theme-${name}-label`, `theme-${name}`);
    check(`theme-${name}`, "surface-card", 3);
  }
  for (const name of ["success", "warning", "error"]) check(`status-${name}`, `status-${name}-bg`);
  check("control-text", "control-bg");
  check("control-hover-text", "control-hover-bg");
  check("control-active-text", "control-active-bg");
  check("control-active-text", "control-active-hover-bg");
  check("control-filter-active-text", "control-filter-active-bg");
  check("control-active-bg", "chart-empty", 3);
  check("accent-ink", "surface-card");
  check("accent-ink", "chart-empty", 3);
  check("text-inverse", "surface-tooltip");
  check("calendar-heat-empty-text", "calendar-heat-empty");
  for (let level = 1; level <= 5; level++) {
    check(level >= 4 ? "calendar-heat-strong-text" : "calendar-heat-text", `calendar-heat-${level}`);
  }
});
