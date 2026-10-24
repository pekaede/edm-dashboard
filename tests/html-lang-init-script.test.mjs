import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { SEO_MARKETS, buildMarketPage, renderMarketDocument } from "../src/seo.ts";

const template = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const localeScript = template.match(/<script id="locale-init">([\s\S]*?)<\/script>/);

// 只执行真实模板中的脚本；不导入 i18n，也不改动进程全局语言。
function runInitializer(getItem) {
  assert.ok(localeScript, "真实模板应包含 locale-init 脚本");
  let lang = "zh-CN";
  const writes = [];
  const document = {
    documentElement: {
      get lang() { return lang; },
      set lang(value) { writes.push(value); lang = value; },
    },
  };
  const reads = [];
  const localStorage = {
    getItem(key) {
      reads.push(key);
      return getItem();
    },
  };
  runInNewContext(localeScript[1], { document, window: { localStorage } });
  assert.deepEqual(reads, ["edm-lang"]);
  return { lang: document.documentElement.lang, writes };
}

describe("首屏 HTML 语言初始化", () => {
  it("真实模板在主题脚本之后、预连接与 head 结束及模块入口之前初始化语言", () => {
    assert.ok(localeScript, "真实模板应包含 locale-init 脚本");
    assert.match(template, /^<!doctype html>\s*<html lang="zh-CN">/);
    const themeScript = template.match(/<script id="theme-init">[\s\S]*?<\/script>/);
    assert.ok(themeScript, "真实模板应包含 theme-init 脚本");
    assert.ok(themeScript.index + themeScript[0].length <= localeScript.index);
    const localeEnd = localeScript.index + localeScript[0].length;
    assert.ok(localeEnd <= template.indexOf('<link rel="preconnect"'));
    assert.ok(localeEnd <= template.indexOf("</head>"));
    assert.ok(localeEnd <= template.indexOf('<script type="module"'));
  });

  for (const stored of ["en", "en-US"]) {
    it(`保存的 ${stored} 在首屏设为 en`, () => {
      assert.deepEqual(runInitializer(() => stored), { lang: "en", writes: ["en"] });
    });
  }

  // 非英文和无键时不显式写回 zh-CN；大写 EN 也不符合 en 前缀。
  for (const stored of ["zh", "zh-CN", "fr", "EN", "", null]) {
    it(`保存的 ${JSON.stringify(stored)} 保持静态 zh-CN 且不写入 lang`, () => {
      assert.deepEqual(runInitializer(() => stored), { lang: "zh-CN", writes: [] });
    });
  }

  it("隐私模式下 getItem 抛错也保持静态 zh-CN 且不写入 lang", () => {
    const result = runInitializer(() => { throw new Error("存储不可读"); });
    assert.deepEqual(result, { lang: "zh-CN", writes: [] });
  });

  it("中文市场页移除语言与模块脚本，并原样保留 data-id 诱饵", () => {
    assert.ok(localeScript, "真实模板应包含 locale-init 脚本");
    // 将诱饵和模块入口放入 head，确保实际覆盖 head 清洗链。
    const decoy = '<script data-id="locale-init">window.localeDecoy = "保留原文";</script>';
    const moduleScript = '<script type="module" src="/assets/index-test.js"></script>';
    const marketTemplate = template.replace("</head>", `${decoy}\n${moduleScript}\n</head>`);
    const page = buildMarketPage(SEO_MARKETS[0], null, "2026-10-24");
    const html = renderMarketDocument(marketTemplate, page);
    assert.match(html, /^<!doctype html>\s*<html lang="zh-CN">/);
    assert.ok(!html.includes('<script id="locale-init">'));
    assert.ok(!html.includes(localeScript[1]));
    assert.ok(html.includes(decoy), "data-id 诱饵脚本必须原文保留");
    assert.doesNotMatch(html, /<script\b[^>]*\stype="module"/);
  });
});
