import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { setTheme, syncThemeColor, THEME_COLOR } from "../src/theme.ts";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const initializer = html.match(/<script id="theme-init">([\s\S]*?)<\/script>/)?.[1];
assert.ok(initializer, "必须保留首屏内联初始化脚本");

describe("首屏脚本同步 theme-color", () => {
  for (const scenario of [
    { name: "保存 dark", saved: "dark", media: false, expected: "#111318" },
    { name: "保存 light", saved: "light", media: true, expected: "#f7f8fa" },
    { name: "无记录跟随系统 dark", saved: null, media: true, expected: "#111318" },
    { name: "无记录跟随系统 light", saved: null, media: false, expected: "#f7f8fa" },
    { name: "无效记录回退系统 dark", saved: "invalid", media: true, expected: "#111318" },
  ]) {
    it(`${scenario.name} 时 meta content 为 ${scenario.expected}`, () => {
      let content = "#f7f8fa";
      const meta = {
        setAttribute(name, value) {
          assert.equal(name, "content");
          content = value;
        },
      };
      const browser = {
        localStorage: { getItem: () => scenario.saved },
        matchMedia: () => ({ matches: scenario.media }),
      };
      runInNewContext(initializer, {
        window: browser,
        document: {
          documentElement: { setAttribute() {} },
          querySelector(selector) {
            assert.equal(selector, 'meta[name="theme-color"]');
            return meta;
          },
        },
      });
      assert.equal(content, scenario.expected);
    });
  }

  it("meta 缺失时首屏脚本不抛错", () => {
    runInNewContext(initializer, {
      window: { localStorage: { getItem: () => "dark" } },
      document: { documentElement: { setAttribute() {} } },
    });
  });
});

describe("运行时 setTheme 同步 theme-color", () => {
  function fakeBrowser(t) {
    const attributes = new Map();
    const meta = {
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
    };
    const stored = new Map();
    const previous = {
      document: Object.getOwnPropertyDescriptor(globalThis, "document"),
      window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    };
    const documentElement = {
      setAttribute: (name, value) => attributes.set(`documentElement:${name}`, value),
      getAttribute: (name) => attributes.get(`documentElement:${name}`) ?? null,
    };
    globalThis.document = {
      documentElement,
      querySelector: (selector) => (selector === 'meta[name="theme-color"]' ? meta : null),
    };
    globalThis.window = {
      localStorage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
      },
    };
    t.after(() => {
      for (const [key, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    });
    return { meta, stored, documentElement };
  }

  it("切换 dark 时 meta 更新为 #111318", (t) => {
    const { meta, documentElement, stored } = fakeBrowser(t);
    setTheme("dark");
    assert.equal(documentElement.getAttribute("data-theme"), "dark");
    assert.equal(meta.getAttribute("content"), THEME_COLOR.dark);
    assert.equal(meta.getAttribute("content"), "#111318");
    assert.equal(stored.get("edm-theme"), "dark");
  });

  it("切换 light 时 meta 更新为 #f7f8fa", (t) => {
    const { meta, documentElement } = fakeBrowser(t);
    setTheme("light");
    assert.equal(documentElement.getAttribute("data-theme"), "light");
    assert.equal(meta.getAttribute("content"), THEME_COLOR.light);
    assert.equal(meta.getAttribute("content"), "#f7f8fa");
  });

  it("双向切换往返一致", (t) => {
    const { meta } = fakeBrowser(t);
    setTheme("dark");
    assert.equal(meta.getAttribute("content"), "#111318");
    setTheme("light");
    assert.equal(meta.getAttribute("content"), "#f7f8fa");
  });

  it("meta 缺失时不抛错、主题仍切换并持久化", (t) => {
    const { documentElement, stored } = fakeBrowser(t);
    globalThis.document.querySelector = () => null;
    setTheme("dark");
    assert.equal(documentElement.getAttribute("data-theme"), "dark");
    assert.equal(stored.get("edm-theme"), "dark");
  });

  it("THEME_COLOR 映射与 tokens.css --surface-page 一致", () => {
    const tokens = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");
    assert.ok(tokens.includes("#f7f8fa"), "浅色 --surface-page 应为 #f7f8fa");
    assert.ok(tokens.includes("#111318"), "深色 --surface-page 应为 #111318");
    assert.equal(THEME_COLOR.light, "#f7f8fa");
    assert.equal(THEME_COLOR.dark, "#111318");
  });

  it("index.html 默认 theme-color 为浅色（与首屏 light 默认一致）", () => {
    assert.ok(html.includes('<meta name="theme-color" content="#f7f8fa" />'));
  });
});

describe("syncThemeColor 独立调用", () => {
  it("meta 缺失时静默通过", (t) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
    globalThis.document = { querySelector: () => null };
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else delete globalThis.document;
    });
    syncThemeColor("dark");
  });
});
