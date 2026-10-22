import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { themeLabelKeyOf } from "../src/components/dashboard.ts";
import { sourceGraph } from "./mounted-source.mjs";

describe("主题翻译查表守卫", () => {
  it("已知主题返回原字典键，保持翻译结果不变", () => {
    for (const [theme, expected] of [
      ["price", "themePrice"],
      ["behavior", "themeBehavior"],
      ["new", "themeNew"],
      ["lifestyle", "themeLifestyle"],
      ["category", "themeCategory"],
      ["other", "themeOther"],
    ]) {
      assert.equal(themeLabelKeyOf(theme), expected, theme);
    }
  });

  it("原型属性名返回 undefined，不传入翻译函数", () => {
    for (const theme of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
      assert.equal(themeLabelKeyOf(theme), undefined, theme);
    }
  });

  it("空字符串、普通未知主题与含特殊字符的主题返回 undefined", () => {
    for (const theme of ["", "winback", "a\"b"]) {
      assert.equal(themeLabelKeyOf(theme), undefined, theme);
    }
  });

  // 运行时断言覆盖查表结果；源码契约保证所有组件 helper 用该结果选择翻译或原 fallback。
  for (const [component, helperCount] of [["ThemeDistribution", 1], ["BrandThemeBreakdown", 2]]) {
    it(`源码契约：${component} 的所有主题 helper 先守卫，未命中回落 labelZh`, () => {
      const source = readFileSync(new URL(`../src/components/${component}.tsx`, import.meta.url), "utf8");
      assert.match(source, /import \{ themeLabelKeyOf \} from "\.\/dashboard";/);
      assert.equal(
        [...source.matchAll(/const themeName = \(theme: \{ key: string; labelZh: string \}\) => \{\s*const key = themeLabelKeyOf\(theme\.key\);\s*return key \? t\(key\) : theme\.labelZh;\s*\};/g)].length,
        helperCount,
        "每个 themeName 都必须先守卫，再决定翻译或回落 labelZh",
      );
      assert.doesNotMatch(source, /THEME_LABEL_KEYS\s*\[/);
    });
  }

  it("源码契约：ExtendedEmailFilter 先守卫，未命中回落原主题名", () => {
    const source = readFileSync(new URL("../src/components/ExtendedEmailFilter.tsx", import.meta.url), "utf8");
    assert.match(source, /import \{ themeLabelKeyOf \} from "\.\/dashboard";/);
    assert.match(source, /function themeLabelOf\(theme: string\): string \{\s*const key = themeLabelKeyOf\(theme\);\s*return key \? translate\(key\) : theme;\s*\}/);
    assert.doesNotMatch(source, /THEME_LABEL_KEYS\s*\[/);
  });

  for (const component of ["BrandDetailDialog", "MarketComparison"]) {
    it(`源码契约：${component} 的 toString 等未知主题先守卫，未命中回落 labelZh`, () => {
      const source = readFileSync(new URL(`../src/components/${component}.tsx`, import.meta.url), "utf8");
      assert.match(source, /import \{ themeLabelKeyOf \} from "\.\/dashboard";/);
      assert.match(source, /const themeName = \(theme: \{ key: string; labelZh: string \}\) => \{\s*const key = themeLabelKeyOf\(theme\.key\);\s*return key \? t\(key\) : theme\.labelZh;\s*\};/);
      assert.match(source, /themeName\(theme\)/);
      assert.doesNotMatch(source, /THEME_LABEL_KEYS\s*\[/);
    });
  }

  it("邮件搜索对原型属性名和特殊字符主题不抛异常，按原文忽略大小写匹配", () => {
    const { emailTableColumns } = sourceGraph().load("components/email-table-model.ts");
    const { filterFn } = emailTableColumns.find((column) => column.id === "email");
    const filters = {
      market: null, brand: null, theme: null, dateFrom: "", dateTo: "",
      favoritesOnly: false, favoriteKeys: new Set(), query: "",
    };
    for (const theme of ["toString", "hasOwnProperty", "valueOf", "__proto__", "a\"b"]) {
      const row = { original: {
        brand: "Zara", date: "2026-10-01", theme, keywords: [],
        market: "US", day_seq: 1, source_index: 0,
      } };
      for (const query of [theme, `  ${theme.toUpperCase()}  `]) {
        assert.doesNotThrow(() => {
          assert.equal(filterFn(row, "email", { ...filters, query }), true, `${theme}: ${query}`);
        });
      }
      assert.equal(filterFn(row, "email", { ...filters, query: "no-match" }), false, theme);
    }
    const row = { original: {
      brand: "Zara", date: "2026-10-01", theme: "price", keywords: [],
      market: "US", day_seq: 1, source_index: 0,
    } };
    for (const query of ["价格", "Price"]) {
      assert.equal(filterFn(row, "email", { ...filters, query }), true, query);
    }
  });
});
