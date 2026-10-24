import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import { pathToFileURL } from "node:url";

const markets = [
  ["us", "美国"], ["uk", "英国"], ["au", "澳大利亚"], ["fr", "法国"],
  ["de", "德国"], ["it", "意大利"], ["es", "西班牙"], ["nl", "荷兰"],
];
const brands = ["Halara", "ALO Yoga", "SHEIN", "Temu", "lululemon", "Zara"];
const brandLinks = brands.map((brand) => `<li><a href="/#brands/all/${encodeURIComponent(brand)}">${brand}</a></li>`).join("");

function page(canonical, title, description, body) {
  return `<html lang="zh-CN"><head>
    <title>${title}</title>
    <link rel="canonical" href="${canonical}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:title" content="${title}">
    <meta name="twitter:title" content="${title}">
    <meta name="description" content="${description}">
    <meta property="og:description" content="${description}">
    <meta name="twitter:description" content="${description}">
    <meta property="og:image" content="https://edmwatch.com/og-image.jpg">
    <meta property="og:image:width" content="2240">
    <meta property="og:image:height" content="1120">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="https://edmwatch.com/og-image.jpg">
    <meta name="theme-color" content="#f7f8fa">
    <link rel="icon" href="/favicon.png">
    <link rel="icon" href="/favicon-32.png" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="stylesheet" href="/assets/site.css">
    <script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"Organization"}]}</script>
  </head><body>${body}</body></html>`;
}

// Run the unchanged verifier entry point in an isolated fixture tree, never the repo's dist.
async function verifyHomepage(t, scripts) {
  const root = mkdtempSync(join(tmpdir(), "verify-seo-module-script-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, content) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  mkdirSync(join(root, "scripts"));
  for (const file of ["verify-seo.mjs", "extract-static-root.mjs"]) {
    copyFileSync(new URL(`../scripts/${file}`, import.meta.url), join(root, "scripts", file));
  }

  write("dist/assets/site.css", ".seo-introduction {} .seo-link-list {} .seo-market {}");
  write("dist/assets/present.js", "export {};\n");
  write("dist/assets/second.js", "export {};\n");
  const marketLinks = markets.map(([code, name]) => `<a href="/markets/${code}/">${name}</a>`).join("");
  const viewLinks = ["emails", "dashboard", "report"].map((view) => `<a href="/#${view}">${view}</a>`).join("");
  write("dist/index.html", page("https://edmwatch.com/", "首页", "邮件营销分析",
    `<div id="root"><h1>邮件营销分析</h1><p>覆盖 8 个市场、6 个品牌</p>${marketLinks}<ul>${brandLinks}</ul>${viewLinks}</div>${scripts}`));

  for (const [code, name] of markets) {
    const title = `${name}市场邮件营销分析`;
    write(`dist/markets/${code}/index.html`, page(`https://edmwatch.com/markets/${code}/`, title, `${title}：${brands.join("、")}`,
      `<h1 class="dashboard-title">${title}</h1><p>市场简介</p><p>品牌简介</p><p>持续收录中</p><ul>${brandLinks}</ul><a href="/">返回首页</a><a href="/#emails/${code.toUpperCase()}">邮件</a>`));
  }
  const urls = ["https://edmwatch.com/", ...markets.map(([code]) => `https://edmwatch.com/markets/${code}/`)];
  write("dist/sitemap.xml", `<urlset>${urls.map((url, index) => `<url><loc>${url}</loc><changefreq>${index === 0 ? "daily" : "weekly"}</changefreq><lastmod>2026-10-24</lastmod></url>`).join("")}</urlset>`);
  for (const file of ["_headers", "robots.txt", "og-image.jpg", "favicon.png", "favicon-32.png", "apple-touch-icon.png"]) {
    const content = file === "robots.txt" ? "Sitemap: https://edmwatch.com/sitemap.xml\n" : "fixture\n";
    write(`dist/${file}`, content);
    write(`public/${file}`, content);
  }

  const output = [];
  const log = t.mock.method(console, "log", (...args) => output.push(args.join(" ")));
  try {
    await import(pathToFileURL(join(root, "scripts/verify-seo.mjs")).href);
    return output.join("\n");
  } finally {
    log.mock.restore();
  }
}

it("AJ18 present homepage module src passes the real verifier", async (t) => {
  const output = await verifyHomepage(t, '<script type="module" src="/assets/present.js"></script>');
  assert.match(output, /SEO dist 自验全部通过/);
});

it("AJ18 multiple present homepage module sources pass", async (t) => {
  const output = await verifyHomepage(t, '<script type="module" src="/assets/present.js"></script><script type="module" src="/assets/second.js"></script>');
  assert.match(output, /SEO dist 自验全部通过/);
});

it("AJ18 nonexistent module src fails despite having type=module", async (t) => {
  await assert.rejects(verifyHomepage(t, '<script type="module" src="/assets/missing.js"></script>'), {
    code: "ERR_ASSERTION",
    message: /\/assets\/missing\.js/,
  });
});

it("AJ18 a present module does not hide a subsequent nonexistent module src", async (t) => {
  await assert.rejects(verifyHomepage(t, '<script type="module" src="/assets/present.js"></script><script type="module" src="/assets/missing.js"></script>'), {
    code: "ERR_ASSERTION",
    message: /\/assets\/missing\.js/,
  });
});

for (const [name, script] of [
  ["no src", '<script type="module"></script>'],
  ["an empty src", '<script type="module" src=""></script>'],
  ["a non-/assets/ src", '<script type="module" src="/favicon.png"></script>'],
  ["an external src", '<script type="module" src="https://example.invalid/assets/present.js"></script>'],
]) {
  it(`AJ18 module script with ${name} fails`, async (t) => {
    await assert.rejects(verifyHomepage(t, script), { code: "ERR_ASSERTION" });
  });
}

it("AJ18 no module script fails even when a classic script src exists", async (t) => {
  await assert.rejects(verifyHomepage(t, '<script src="/assets/present.js"></script>'), { code: "ERR_ASSERTION" });
});
