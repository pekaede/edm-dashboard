// 独立核验最终 dist，不复用生成函数；无需服务、网络或新增依赖。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const markets = [
  ["us", "美国"], ["uk", "英国"], ["au", "澳大利亚"], ["fr", "法国"],
  ["de", "德国"], ["it", "意大利"], ["es", "西班牙"], ["nl", "荷兰"],
];
const brands = ["Halara", "ALO Yoga", "SHEIN", "Temu", "lululemon", "Zara"];
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
const attr = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
function meta(html, key) {
  const matches = tags(html, "meta").filter((tag) => attr(tag, "name") === key || attr(tag, "property") === key);
  assert.equal(matches.length, 1, key);
  return attr(matches[0], "content");
}
function link(html, rel) {
  return tags(html, "link").filter((tag) => attr(tag, "rel") === rel);
}
function verifyShared(html, canonical) {
  assert.match(html, /<html lang="zh-CN">/);
  assert.equal(link(html, "canonical").length, 1);
  assert.equal(attr(link(html, "canonical")[0], "href"), canonical);
  assert.equal(meta(html, "og:url"), canonical);
  assert.equal(meta(html, "og:type"), "website");
  assert.equal(meta(html, "og:locale"), "zh_CN");
  assert.equal(meta(html, "og:image"), "https://edmwatch.com/og-image.jpg");
  assert.equal(meta(html, "og:image:width"), "2240");
  assert.equal(meta(html, "og:image:height"), "1120");
  assert.equal(meta(html, "twitter:card"), "summary_large_image");
  assert.equal(meta(html, "twitter:image"), "https://edmwatch.com/og-image.jpg");
  assert.equal(meta(html, "theme-color"), "#f7f1e8");
  for (const key of ["description", "og:description", "twitter:description"]) {
    assert.doesNotMatch(meta(html, key), /Milled|Supabase/i);
  }
  assert.deepEqual(link(html, "icon").map((tag) => attr(tag, "href")).sort(), ["/favicon-32.png", "/favicon.png"]);
  assert.equal(attr(link(html, "icon").find((tag) => attr(tag, "href") === "/favicon-32.png"), "sizes"), "32x32");
  assert.equal(attr(link(html, "apple-touch-icon")[0], "href"), "/apple-touch-icon.png");
  assert.equal(tags(html, "h1").length, 1);
  const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(data.length, 1);
  assert.deepEqual(JSON.parse(data[0][1])["@graph"].map((item) => item["@type"]), ["WebSite", "Organization"]);
  for (const stylesheet of link(html, "stylesheet")) {
    const href = attr(stylesheet, "href");
    assert.ok(href.startsWith("/assets/"));
    assert.ok(existsSync(new URL(`dist${href}`, root)), href);
    const css = read(`dist${href}`);
    for (const selector of [".seo-introduction", ".seo-link-list", ".seo-market"]) assert.ok(css.includes(selector), selector);
  }
  assert.ok(link(html, "stylesheet").length > 0);
}

const home = read("dist/index.html");
verifyShared(home, "https://edmwatch.com/");
const staticRoot = home.match(/<div id="root">([\s\S]*)<\/div>\s*<\/body>/)?.[1];
assert.ok(staticRoot?.includes("<h1"));
assert.match(staticRoot, /覆盖 8 个市场、6 个品牌/);
assert.doesNotMatch(staticRoot, /\d[\d,]*\s*封/);
assert.equal(tags(staticRoot, "a").filter((tag) => attr(tag, "href").startsWith("/markets/")).length, 8);
for (const brand of brands) assert.ok(staticRoot.includes(`<li>${brand}</li>`));
for (const view of ["emails", "dashboard", "report"]) assert.ok(staticRoot.includes(`href="/#${view}"`));
assert.ok(tags(home, "script").some((tag) => attr(tag, "type") === "module"));
console.log("PASS dist/index.html: root 内 H1 + 简介 + 8 市场入口 + 6 品牌 + 3 视图链接；WebSite/Organization JSON-LD");
console.log("PASS 全站分享标签: og:image=https://edmwatch.com/og-image.jpg (2240×1120), summary_large_image, twitter:image, 3 图标 link, theme-color");

const titles = new Set();
const descriptions = new Set();
for (const [code, name] of markets) {
  const path = `dist/markets/${code}/index.html`;
  const html = read(path);
  verifyShared(html, `https://edmwatch.com/markets/${code}/`);
  assert.match(staticRoot, new RegExp(`href="/markets/${code}/"`));
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.ok(title.includes(name));
  assert.ok(meta(html, "description").includes(name));
  titles.add(title);
  descriptions.add(meta(html, "description"));
  assert.equal(meta(html, "og:title"), title);
  assert.equal(meta(html, "twitter:title"), title);
  assert.equal(meta(html, "og:description"), meta(html, "description"));
  assert.equal(meta(html, "twitter:description"), meta(html, "description"));
  assert.ok(html.includes(`<h1 class="dashboard-title">${name}市场邮件营销分析</h1>`));
  assert.equal(tags(html, "p").length, 3);
  for (const brand of brands) {
    assert.ok(html.includes(`<li>${brand}</li>`));
    assert.ok(meta(html, "description").includes(brand));
  }
  assert.ok(html.includes('href="/">返回首页'));
  assert.ok(html.includes(`href="/#emails/${code.toUpperCase()}"`));
  assert.doesNotMatch(html, /type="module"|modulepreload|id="root"|Milled|Supabase/i);
  assert.doesNotMatch(html, /(?:^|[^\d])0 封/);
  const sample = [...html.matchAll(/<p>([^<]*)<\/p>/g)].at(-1)?.[1];
  assert.ok(sample);
  assert.match(sample, /封邮件样本|持续收录中/);
  console.log(`PASS ${path}: ${title}; canonical 自身; 3 段说明 + 6 品牌 + /#emails/${code.toUpperCase()}; ${sample.includes("封邮件样本") ? sample : "持续收录中，未输出样本数字"}; 无 SPA 脚本`);
}
assert.equal(titles.size, 8);
assert.equal(descriptions.size, 8);

const sitemap = read("dist/sitemap.xml");
const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => entry);
assert.equal(entries.length, 9);
const expectedUrls = ["https://edmwatch.com/", ...markets.map(([code]) => `https://edmwatch.com/markets/${code}/`)];
const buildDates = new Set();
for (const [index, entry] of entries.entries()) {
  assert.ok(entry.includes(`<loc>${expectedUrls[index]}</loc>`));
  assert.ok(entry.includes(`<changefreq>${index === 0 ? "daily" : "weekly"}</changefreq>`));
  const lastmod = entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
  assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
  buildDates.add(lastmod);
}
assert.equal(buildDates.size, 1);
console.log(`PASS dist/sitemap.xml: 9 URLs; 首页 daily / 市场 weekly; 全部 lastmod=${[...buildDates][0]}`);
for (const path of ["_headers", "robots.txt", "og-image.jpg", "favicon.png", "favicon-32.png", "apple-touch-icon.png"]) {
  assert.deepEqual(readFileSync(new URL(`dist/${path}`, root)), readFileSync(new URL(`public/${path}`, root)), path);
}
assert.match(read("dist/robots.txt"), /Sitemap: https:\/\/edmwatch.com\/sitemap.xml/);
for (const path of ["_redirects", "_worker.js", "404.html"]) assert.equal(existsSync(new URL(`dist/${path}`, root)), false, path);
console.log("PASS Cloudflare 产物: 8 个独立 markets/<code>/index.html；_headers / robots.txt / 4 张素材逐字节一致；未新增回退/重写配置");
console.log(`SEO dist 自验全部通过: ${fileURLToPath(new URL("dist/", root))}`);
