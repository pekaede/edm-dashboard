import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LIVE_WINDOW } from "../src/data-window.ts";
import { parseHash } from "../src/url-state.ts";
import {
  SEO_BRANDS, SEO_MARKETS, SITE_URL, SITE_TITLE, buildMarketPage,
  fetchMarketCounts, generateSitemap, injectHomePrerender, renderMarketDocument,
} from "../src/seo.ts";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";

const template = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const buildDate = "2026-10-22";
const { SiteIntroduction } = sourceGraph().load("components/SiteIntroduction.tsx");
const introMarkup = () => renderToStaticMarkup(createElement(SiteIntroduction));
const homeDocument = () => injectHomePrerender(template, introMarkup());

describe("SEO 市场页数据与公开只读计数", () => {
  it("8 个市场的国名、品牌、canonical 和邮件深链接完整且唯一", () => {
    assert.deepEqual(SEO_MARKETS.map(({ code }) => code), ["us", "uk", "au", "fr", "de", "it", "es", "nl"]);
    assert.equal(SEO_BRANDS.length, 6);
    const titles = new Set();
    const descriptions = new Set();
    for (const market of SEO_MARKETS) {
      const page = buildMarketPage(market, 1234, buildDate);
      titles.add(page.title);
      descriptions.add(page.description);
      for (const value of [page.title, page.description, page.heading]) assert.ok(value.includes(market.name));
      for (const brand of SEO_BRANDS) assert.ok(page.description.includes(brand));
      assert.equal(page.canonical, `${SITE_URL}/markets/${market.code}/`);
      assert.equal(page.paragraphs.length, 3);
      assert.deepEqual(page.brands, SEO_BRANDS);
      const state = parseHash(page.emailsUrl.slice(1));
      assert.equal(state.view, "emails");
      assert.equal(state.market, market.code.toUpperCase());
      assert.equal(state.marketSpecified, true);
      assert.doesNotMatch(JSON.stringify(page), /Milled|Supabase/i);
    }
    assert.equal(titles.size, 8);
    assert.equal(descriptions.size, 8);
  });

  it("真实正数标注构建日期与现有查询窗口，不冒充品牌全量发送量", () => {
    const sample = buildMarketPage(SEO_MARKETS[0], 1234, buildDate).paragraphs[2];
    for (const text of ["1,234 封", buildDate, LIVE_WINDOW.start, LIVE_WINDOW.end, "不代表品牌全部发送量"]) assert.ok(sample.includes(text));
  });

  it("ES 零样本与所有市场失败/无效计数均持续收录，不输出邮件数量", () => {
    for (const market of SEO_MARKETS) {
      for (const count of [0, null, -1, 1.5, NaN, Infinity, "123", Number.MAX_SAFE_INTEGER + 1]) {
        const sample = buildMarketPage(market, count, buildDate).paragraphs[2];
        assert.match(sample, /持续收录中/);
        assert.doesNotMatch(sample, /\d[\d,]*\s*封/);
      }
    }
  });

  it("8 次 HEAD 用 count=exact、当前窗口与独立市场过滤，包含零值", async () => {
    const calls = [];
    const counts = await fetchMarketCounts({
      baseUrl: "https://readonly.example/", publishableKey: "public-test-key",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const count = url.searchParams.get("market") === "eq.ES" ? 0 : 42;
        return new Response(null, { status: 200, headers: { "Content-Range": count ? `0-0/${count}` : "*/0" } });
      },
    });
    assert.equal(calls.length, 8);
    for (const [index, { url, options }] of calls.entries()) {
      assert.equal(url.pathname, "/rest/v1/emails");
      assert.equal(url.searchParams.get("market"), `eq.${SEO_MARKETS[index].code.toUpperCase()}`);
      assert.deepEqual(url.searchParams.getAll("sent_date"), [`gte.${LIVE_WINDOW.start}`, `lte.${LIVE_WINDOW.end}`]);
      assert.equal(url.searchParams.get("limit"), "1");
      assert.equal(url.searchParams.has("offset"), false);
      assert.equal(options.method, "HEAD");
      assert.deepEqual(options.headers, { apikey: "public-test-key", Prefer: "count=exact" });
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.body, undefined);
    }
    assert.deepEqual(counts.map(({ count }) => count), [42, 42, 42, 42, 42, 42, 0, 42]);
  });

  it("缺失配置或 JSON 回滚模式不查询 live，也不使用冻结计数", async () => {
    for (const config of [{}, { baseUrl: "https://readonly.example" }, { baseUrl: "https://readonly.example", publishableKey: "public", dataSource: "json" }]) {
      const counts = await fetchMarketCounts({ ...config, fetchImpl: () => assert.fail("不应联网") });
      assert.equal(counts.length, 8);
      assert.ok(counts.every(({ count }) => count === null));
    }
  });

  it("单市场 HTTP、网络、超时与未知总数错误不影响其余市场", async () => {
    const counts = await fetchMarketCounts({
      baseUrl: "https://readonly.example", publishableKey: "public",
      fetchImpl: async (url) => {
        const market = url.searchParams.get("market");
        if (market === "eq.US") return new Response(null, { status: 503 });
        if (market === "eq.UK") throw new Error("offline");
        if (market === "eq.AU") throw new DOMException("timeout", "TimeoutError");
        const range = { "eq.FR": "0-0/*", "eq.DE": "0-0/9007199254740992", "eq.IT": "", "eq.ES": "*/0", "eq.NL": "0-0/79" }[market];
        return new Response(null, { headers: { "Content-Range": range } });
      },
    });
    assert.deepEqual(counts.map(({ count }) => count), [null, null, null, null, null, null, 0, 79]);
  });
});

describe("SEO 首页预渲染与静态文档", () => {
  it("根节点直出 H1、简介、8 个市场链接、6 品牌及视图说明，无冻结邮件总数", () => {
    const html = homeDocument();
    const root = html.match(/<div id="root">([\s\S]*)<\/div>/)?.[1];
    assert.ok(root);
    assert.equal((root.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(root.includes(SITE_TITLE));
    assert.ok(root.includes("覆盖 8 个市场、6 个品牌"));
    for (const { code, name } of SEO_MARKETS) assert.ok(root.includes(`href="/markets/${code}/">${name}</a>`));
    for (const brand of SEO_BRANDS) assert.ok(root.includes(`<li><a href="/#brands/all/${encodeURIComponent(brand)}">${brand}</a></li>`));
    for (const view of ["emails", "dashboard", "report"]) assert.ok(root.includes(`href="/#${view}"`));
    assert.doesNotMatch(root, /\d[\d,]*\s*封|Milled|Supabase/i);
    assert.match(html, /<script type="module" src="\/src\/main.tsx"><\/script>/);
  });

  it("JSON-LD 是可解析的 WebSite + Organization，仅含站点真实字段", () => {
    const html = homeDocument();
    assert.equal((html.match(/application\/ld\+json/g) ?? []).length, 1);
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(json["@context"], "https://schema.org");
    assert.deepEqual(json["@graph"].map((item) => item["@type"]), ["WebSite", "Organization"]);
    assert.equal(json["@graph"][0].url, `${SITE_URL}/`);
    assert.equal(json["@graph"][1].url, `${SITE_URL}/`);
    assert.equal(json["@graph"][0].publisher["@id"], json["@graph"][1]["@id"]);
    assert.doesNotMatch(JSON.stringify(json), /aggregateRating|review|rating|SearchAction/);
  });

  it("模板锚点缺失、重复或已经注入时直接报错，避免静默空页或重复内容", () => {
    assert.throws(() => injectHomePrerender(template.replace('<div id="root"></div>', ""), introMarkup()));
    assert.throws(() => injectHomePrerender(template.replace('<div id="root"></div>', '<div id="root"></div><div id="root"></div>'), introMarkup()));
    assert.throws(() => injectHomePrerender(homeDocument(), introMarkup()));
  });

  it("React 原位替换静态首屏，同一简介组件再次渲染也只有一个 H1 与 8 个市场入口", async (t) => {
    const dom = await mountDOM(t);
    const initial = dom.document.createElement("header");
    const heading = initial.appendChild(dom.document.createElement("h1"));
    heading.textContent = SITE_TITLE;
    dom.container.appendChild(initial);
    assert.equal(descendants(dom.container, (node) => node.nodeName === "H1").length, 1);
    await dom.render(createElement(SiteIntroduction));
    assert.equal(dom.container.contains(initial), false, "React commit 应清除静态旧树");
    for (let i = 0; i < 2; i += 1) {
      await dom.render(createElement(SiteIntroduction));
      assert.equal(descendants(dom.container, (node) => node.nodeName === "H1").length, 1);
      assert.equal(descendants(dom.container, (node) => node.nodeName === "A" && node.getAttribute("href")?.startsWith("/markets/")).length, 8);
    }
  });

  it("市场页复用分享卡与 CSS，移除 SPA 和模块预加载，独立呈现专属内容", () => {
    const builtTemplate = homeDocument().replace("</head>", '<link rel="stylesheet" href="/assets/index-test.css"><link rel="modulepreload" crossorigin href="/assets/vendor.js"></head>');
    for (const market of SEO_MARKETS) {
      const page = buildMarketPage(market, market.code === "es" ? 0 : 23, buildDate);
      const html = renderMarketDocument(builtTemplate, page);
      assert.ok(html.includes(`<title>${page.title}</title>`));
      assert.ok(html.includes(`rel="canonical" href="${page.canonical}"`));
      assert.ok(html.includes(`property="og:url" content="${page.canonical}"`));
      assert.ok(html.includes(`href="${page.emailsUrl}"`));
      assert.ok(html.includes('href="/">返回首页'));
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      assert.equal((html.match(/<p>/g) ?? []).length, 3);
      for (const brand of SEO_BRANDS) assert.ok(html.includes(`<li><a href="/#brands/all/${encodeURIComponent(brand)}">${brand}</a></li>`));
      assert.match(html, /各市场不保证覆盖全部品牌/);
      assert.match(html, /\/assets\/index-test.css/);
      assert.match(html, /application\/ld\+json/);
      assert.doesNotMatch(html, /type="module"|modulepreload|id="root"|preconnect|Milled|Supabase/i);
      if (market.code === "es") { assert.match(html, /持续收录中/); assert.doesNotMatch(html, /0 封/); }
    }
  });

  it("市场页转义文本和属性，模板 head/关键元数据缺失时拒绝生成", () => {
    const page = buildMarketPage(SEO_MARKETS[0], 1, buildDate);
    page.title = '测试 <script> & "标题"';
    page.paragraphs = ["<script>alert('x')</script>"];
    page.emailsUrl = '/#emails/US?x=" onmouseover="bad';
    const html = renderMarketDocument(homeDocument(), page);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&amp; &quot;标题&quot;/);
    assert.match(html, /x=&quot; onmouseover=&quot;bad/);
    assert.doesNotMatch(html, /<script>alert|x=" onmouseover/);
    assert.throws(() => renderMarketDocument("<html></html>", page));
    assert.throws(() => renderMarketDocument(homeDocument().replace(/<title>.*?<\/title>/, ""), page));
  });

  it("首页与市场页的分享大图、尺寸、图标与主题色一致，描述不提来源", () => {
    const documents = [template, ...SEO_MARKETS.map((market) => renderMarketDocument(homeDocument(), buildMarketPage(market, null, buildDate)))];
    for (const html of documents) {
      assert.match(html, /property="og:image" content="https:\/\/edmwatch.com\/og-image.jpg"/);
      assert.match(html, /property="og:image:width" content="2240"/);
      assert.match(html, /property="og:image:height" content="1120"/);
      assert.match(html, /name="twitter:card" content="summary_large_image"/);
      assert.match(html, /name="twitter:image" content="https:\/\/edmwatch.com\/og-image.jpg"/);
      assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32.png"/);
      assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon.png"/);
      assert.match(html, /rel="icon" type="image\/png" href="\/favicon.png"/);
      assert.match(html, /name="theme-color" content="#f7f8fa"/);
      for (const description of html.match(/<meta (?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/g)) assert.doesNotMatch(description, /Milled|Supabase|基于/i);
    }
  });
});

describe("SEO sitemap", () => {
  it("首页 daily、8 市场 weekly，全部 canonical 路径使用传入的构建日", () => {
    const xml = generateSitemap(buildDate);
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => entry);
    assert.equal(entries.length, 9);
    assert.match(entries[0], /<loc>https:\/\/edmwatch.com\/<\/loc>/);
    assert.match(entries[0], /<changefreq>daily<\/changefreq>/);
    for (const [index, { code }] of SEO_MARKETS.entries()) {
      assert.ok(entries[index + 1].includes(`<loc>${SITE_URL}/markets/${code}/</loc>`));
      assert.match(entries[index + 1], /<changefreq>weekly<\/changefreq>/);
    }
    for (const entry of entries) assert.ok(entry.includes(`<lastmod>${buildDate}</lastmod>`));
    assert.equal((generateSitemap("2026-10-23").match(/<lastmod>2026-10-23<\/lastmod>/g) ?? []).length, 9);
  });

  it("拒绝无效日期或 XML 注入", () => {
    for (const date of ["2026-02-30", "bad", "2026-10-22T00:00:00Z", '2026-10-22</lastmod>']) assert.throws(() => generateSitemap(date));
  });
});
