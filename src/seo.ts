import { LIVE_WINDOW } from "./data-window";

// SEO v1 的生成型文案只提供中文；不参与看板的数据层或 i18n 状态。
export const SITE_URL = "https://edmwatch.com";
export const SITE_TITLE = "品牌营销触达趋势看板";
export const SEO_BRANDS = ["Halara", "ALO Yoga", "SHEIN", "Temu", "lululemon", "Zara"] as const;
export const SEO_MARKETS = [
  { code: "us", name: "美国", focus: "在同一市场内按品牌筛选，观察促销、上新与生活方式主题的分布，并结合日历了解邮件收录节奏。" },
  { code: "uk", name: "英国", focus: "从英国市场的邮件样本出发，按主题和关键词筛选营销内容，结合周分布与日历查看不同品牌的触达节奏。" },
  { code: "au", name: "澳大利亚", focus: "聚焦澳大利亚市场，按日期与品牌查看邮件内容，辅助研究面向当地市场的上新、品类与促销表达。" },
  { code: "fr", name: "法国", focus: "在法国市场下查看邮件主题与关键词，结合品牌筛选和日历，梳理当地市场的内容表达与收录节奏。" },
  { code: "de", name: "德国", focus: "围绕德国市场的邮件样本，按品牌与主题组织研究，结合周分布观察促销、上新及品类内容的变化。" },
  { code: "it", name: "意大利", focus: "针对意大利市场，可按品牌查看邮件样本，使用主题筛选、关键词与日历，研究时尚及运动服饰相关的营销内容。" },
  { code: "es", name: "西班牙", focus: "西班牙市场持续收录中；可进入对应市场查看收录进展，后续结合主题、品牌与日期筛选开展邮件营销研究。" },
  { code: "nl", name: "荷兰", focus: "从荷兰市场的邮件样本切入，按品牌与主题筛选内容，借助日历与 OnePage 报告查看收录节奏及主题分布。" },
] as const;

export type SeoMarket = (typeof SEO_MARKETS)[number];
export interface MarketCount {
  code: string;
  count: number | null;
}
export interface MarketPage {
  code: string;
  name: string;
  title: string;
  description: string;
  canonical: string;
  heading: string;
  paragraphs: string[];
  brands: readonly string[];
  emailsUrl: string;
}

export function buildMarketPage(market: SeoMarket, count: number | null, buildDate: string): MarketPage {
  const hasCount = typeof count === "number" && Number.isSafeInteger(count) && count > 0;
  const sample = hasCount
    ? `构建时（${buildDate}）查询窗口 ${LIVE_WINDOW.start} 至 ${LIVE_WINDOW.end} 内，${market.name}市场收录 ${count.toLocaleString("zh-CN")} 封邮件样本。收录样本不代表品牌全部发送量，进入看板可查看当前窗口与更新后的记录。`
    : `${market.name}市场持续收录中，进入看板可查看当前可用邮件与查询窗口。收录覆盖随市场和品牌而异，样本不代表品牌全部发送量。`;
  return {
    code: market.code,
    name: market.name,
    title: `${market.name}邮件营销分析 · Halara、SHEIN、Zara 等品牌 | ${SITE_TITLE}`,
    description: `查看${market.name}市场 Halara、ALO Yoga、SHEIN、Temu、lululemon、Zara 的邮件营销样本，按品牌与主题分析收录趋势、上新和促销节奏，使用日历、关键词与实时 OnePage 报告开展竞品研究。`,
    canonical: `${SITE_URL}/markets/${market.code}/`,
    heading: `${market.name}市场邮件营销分析`,
    paragraphs: [
      `${SITE_TITLE}的${market.name}市场入口，面向品牌营销与竞品研究，提供邮件样本浏览、主题分布、收录趋势及实时 OnePage 报告。`,
      market.focus,
      sample,
    ],
    brands: SEO_BRANDS,
    emailsUrl: `/#emails/${market.code.toUpperCase()}`,
  };
}

// 只调用公开客户端接口的 HEAD，不下载邮件、不使用写入或 service-role 权限。
export async function fetchMarketCounts({
  baseUrl, publishableKey, dataSource, fetchImpl = fetch,
}: {
  baseUrl?: string;
  publishableKey?: string;
  dataSource?: string;
  fetchImpl?: typeof fetch;
}): Promise<MarketCount[]> {
  return Promise.all(SEO_MARKETS.map(async ({ code }) => {
    if (!baseUrl || !publishableKey || dataSource === "json") return { code, count: null };
    try {
      const endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/emails`);
      endpoint.searchParams.set("select", "market");
      endpoint.searchParams.set("market", `eq.${code.toUpperCase()}`);
      endpoint.searchParams.append("sent_date", `gte.${LIVE_WINDOW.start}`);
      endpoint.searchParams.append("sent_date", `lte.${LIVE_WINDOW.end}`);
      endpoint.searchParams.set("limit", "1");
      const response = await fetchImpl(endpoint, {
        method: "HEAD",
        headers: { apikey: publishableKey, Prefer: "count=exact" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return { code, count: null };
      const match = response.headers.get("Content-Range")?.match(/^(?:\*|\d+-\d+)\/(\d+)$/);
      const count = match ? Number(match[1]) : NaN;
      return { code, count: Number.isSafeInteger(count) && count >= 0 ? count : null };
    } catch {
      return { code, count: null };
    }
  }));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function renderJsonLd(): string {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_TITLE, inLanguage: "zh-CN", publisher: { "@id": `${SITE_URL}/#organization` } },
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "EDM Watch", url: `${SITE_URL}/` },
    ],
  }).replace(/</g, "\\u003c")}</script>`;
}

function replaceOnce(html: string, pattern: RegExp, replacement: string): string {
  const matches = html.match(new RegExp(pattern.source, "g"));
  if (matches?.length !== 1) throw new Error(`SEO 模板必须恰有一个 ${pattern.source}`);
  return html.replace(pattern, () => replacement);
}

export function injectHomePrerender(html: string, markup: string): string {
  const withRoot = replaceOnce(html, /<div id="root">\s*<\/div>/, `<div id="root">${markup}</div>`);
  return replaceOnce(withRoot, /<\/head>/, `    ${renderJsonLd()}\n  </head>`);
}

export function renderMarketDocument(homeHtml: string, page: MarketPage): string {
  const head = homeHtml.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  if (!head) throw new Error("SEO 模板缺少 head");
  // 复用 Vite 产出的 CSS 与分享/图标标签，去掉应用入口，静态市场页不启动 SPA。
  let marketHead = head
    .replace(/<script\b(?=[^>]*\btype="module")[^>]*>[\s\S]*?<\/script>\s*/g, "")
    // 市场页正文恒中文、无 React 纠正，返回模板 lang 硬编码 zh-CN。
    // 移除语言初始化，避免 edm-lang=en 将 /markets/<code>/ 的 lang 改为 en，与 JSON-LD inLanguage zh-CN 矛盾。
    // id 前必须是空白，避免误删 data-id="locale-init" 脚本。
    .replace(/<script\b(?=[^>]*\sid="locale-init")[^>]*>[\s\S]*?<\/script>\s*/g, "")
    .replace(/<link\b(?=[^>]*\brel="(?:modulepreload|preconnect)")[^>]*>\s*/g, "");
  marketHead = replaceOnce(marketHead, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  marketHead = replaceOnce(marketHead, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`);
  for (const [attribute, key, value] of [
    ["name", "description", page.description],
    ["property", "og:url", page.canonical],
    ["property", "og:title", page.title],
    ["property", "og:description", page.description],
    ["name", "twitter:title", page.title],
    ["name", "twitter:description", page.description],
  ]) {
    marketHead = replaceOnce(marketHead, new RegExp(`<meta ${attribute}="${key}"[^>]*>`), `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`);
  }
  const body = `<main class="dashboard-container seo-market">
      <a href="/">返回首页</a>
      <h1 class="dashboard-title">${escapeHtml(page.heading)}</h1>
      ${page.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n      ")}
      <section aria-labelledby="brands-title">
        <h2 id="brands-title" class="section-title">关注品牌</h2>
        <ul class="seo-link-list">${page.brands.map((brand) => `<li><a href="/#brands/all/${encodeURIComponent(brand)}">${escapeHtml(brand)}</a></li>`).join("")}</ul>
        <small>全站关注品牌列表，各市场不保证覆盖全部品牌。</small>
      </section>
      <nav aria-label="进入看板"><a href="${escapeHtml(page.emailsUrl)}">进入${escapeHtml(page.name)}市场看板 · 邮件视图</a></nav>
    </main>`;
  return `<!doctype html>\n<html lang="zh-CN">\n  <head>${marketHead}</head>\n  <body class="dashboard-shell min-h-screen font-sans text-[var(--text-body)] antialiased">\n    ${body}\n  </body>\n</html>\n`;
}

export function generateSitemap(buildDate: string): string {
  const date = new Date(buildDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(buildDate) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== buildDate) {
    throw new Error("sitemap 构建日期必须为有效的 YYYY-MM-DD");
  }
  const entries = [
    { path: "/", changefreq: "daily" },
    ...SEO_MARKETS.map(({ code }) => ({ path: `/markets/${code}/`, changefreq: "weekly" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ path, changefreq }) => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${buildDate}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n  </url>`).join("\n")}\n</urlset>\n`;
}
