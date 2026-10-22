import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SEO_BRANDS, SEO_MARKETS, SITE_TITLE } from "../src/seo.ts";
import { sourceGraph } from "./mounted-source.mjs";

const source = readFileSync(new URL("../src/components/SiteIntroduction.tsx", import.meta.url), "utf8");
const zh = JSON.parse(readFileSync(new URL("../src/i18n/locales/zh.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));

const MARKET_KEYS = SEO_MARKETS.map(({ code }) => `introMarket${code.toUpperCase()}`);
const INTRO_KEYS = [
  "introTitle", "introLead", "introMarketsLabel", "introBrandsLabel",
  ...MARKET_KEYS,
  "introOutroA", "introOutroEmails", "introOutroB", "introOutroDashboard",
  "introOutroC", "introOutroReport", "introOutroD",
];

describe("SiteIntroduction i18n 接入", () => {
  it("zh/en 键集完全一致（parity），intro* 键两语齐全且非空", () => {
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
    for (const key of INTRO_KEYS) {
      assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh 缺 ${key}`);
      assert.ok(typeof en[key] === "string" && en[key].length > 0, `en 缺 ${key}`);
    }
  });

  it("zh 文案与改版前逐字一致：标题、市场名、介绍段与入口句", () => {
    assert.equal(zh.introTitle, SITE_TITLE);
    for (const [index, market] of SEO_MARKETS.entries()) assert.equal(zh[MARKET_KEYS[index]], market.name);
    assert.ok(zh.introLead.startsWith("覆盖 8 个市场、6 个品牌"));
    const outro = ["introOutroA", "introOutroEmails", "introOutroB", "introOutroDashboard", "introOutroC", "introOutroReport", "introOutroD"]
      .map((key) => zh[key]).join("");
    assert.equal(outro, "进入邮件视图筛选品牌与主题，或查看数据看板中的日历与词云，以及OnePage 报告。各市场收录覆盖可能不同。");
    // 英文入口句同理可完整拼出，不丢信息。
    const outroEn = ["introOutroA", "introOutroEmails", "introOutroB", "introOutroDashboard", "introOutroC", "introOutroReport", "introOutroD"]
      .map((key) => en[key]).join("");
    assert.equal(outroEn, "Open the email view to filter by brand and topic, explore the calendar and word cloud on the dashboard, or read the OnePage report. Collection coverage may vary by market.");
  });

  it("组件文案走 i18n 键，源码里没有写死的用户可见中文文案", () => {
    assert.ok(source.includes("useLocale"), "组件必须用 useLocale 取词");
    for (const key of ["introTitle", "introLead", "introMarketsLabel", "introBrandsLabel"]) {
      assert.ok(source.includes(`t("${key}")`), `组件必须引用 ${key}`);
    }
    for (const key of MARKET_KEYS) assert.ok(source.includes(`"${key}"`), `市场名键 ${key} 必须被映射引用`);
    for (const text of [SITE_TITLE, "覆盖 8 个市场、6 个品牌", "筛选品牌与主题，或查看", "各市场收录覆盖可能不同", ...SEO_MARKETS.map(({ name }) => name)]) {
      assert.ok(!source.includes(text), `源码不应写死文案：${text}`);
    }
  });

  it("默认 zh 渲染与改版前一致；切 EN 后介绍区无残留中文（品牌名除外）", async () => {
    const graph = sourceGraph();
    const { SiteIntroduction } = graph.load("components/SiteIntroduction.tsx");
    const i18n = graph.load("i18n/index.tsx").default;

    const zhMarkup = renderToStaticMarkup(createElement(SiteIntroduction));
    assert.ok(zhMarkup.includes(`<h1 class="dashboard-title seo-intro-title text-[var(--text-heading)]">${SITE_TITLE}</h1>`));
    for (const { code, name } of SEO_MARKETS) assert.ok(zhMarkup.includes(`href="/markets/${code}/">${name}</a>`));
    for (const brand of SEO_BRANDS) assert.ok(zhMarkup.includes(`<li>${brand}</li>`));
    for (const view of ["emails", "dashboard", "report"]) assert.ok(zhMarkup.includes(`href="/#${view}"`));

    await i18n.changeLanguage("en");
    try {
      const enMarkup = renderToStaticMarkup(createElement(SiteIntroduction));
      assert.ok(enMarkup.includes("Brand Marketing Reach Trend Dashboard"));
      assert.ok(enMarkup.includes("Covering 8 markets and 6 brands"));
      for (const name of ["United States", "United Kingdom", "Australia", "France", "Germany", "Italy", "Spain", "Netherlands"]) {
        assert.ok(enMarkup.includes(`>${name}</a>`), `EN 缺市场名 ${name}`);
      }
      assert.ok(enMarkup.includes("Open the "));
      assert.doesNotMatch(enMarkup, /品牌营销|覆盖 8 个市场|邮件视图|数据看板|市场入口|关注品牌|美国|英国|澳大利亚|法国|德国|意大利|西班牙|荷兰/);
      // 品牌专名与副标题两语一致，保留原文。
      for (const brand of SEO_BRANDS) assert.ok(enMarkup.includes(`<li>${brand}</li>`));
      assert.ok(enMarkup.includes("Email Marketing Intelligence"));
      for (const { code } of SEO_MARKETS) assert.ok(enMarkup.includes(`href="/markets/${code}/"`));
    } finally {
      await i18n.changeLanguage("zh");
    }
  });

  it("市场链接为胶囊样式且 href 不变，品牌 li 无属性（样式走父级）", () => {
    assert.ok(source.includes('className="seo-market-pill"'), "市场链接必须带胶囊类");
    assert.ok(source.indexOf('className="seo-market-pill"') < source.indexOf("href={`/markets/"), "class 须在 href 之前，保证预渲染字面形态");
    assert.ok(source.includes('className="seo-link-list seo-brand-list"'), "品牌列表须走 seo-brand-list 父级样式");
    assert.ok(source.includes("{SEO_BRANDS.map((brand) => <li key={brand}>{brand}</li>)}"), "品牌 li 不得带 class 等属性");
  });
});
