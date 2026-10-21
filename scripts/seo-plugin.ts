import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadEnv, type Plugin, type ResolvedConfig } from "vite";
import { SiteIntroduction } from "../src/components/SiteIntroduction";
import {
  SEO_MARKETS, buildMarketPage, fetchMarketCounts, generateSitemap,
  injectHomePrerender, renderMarketDocument,
} from "../src/seo";

export function seoPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "edm-static-seo",
    apply: "build",
    enforce: "post",
    configResolved(resolved) { config = resolved; },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const intro = renderToStaticMarkup(createElement(SiteIntroduction));
        const markup = `<div class="dashboard-shell min-h-screen font-sans text-[var(--text-body)] antialiased"><header class="dashboard-header dashboard-container flex flex-col gap-[var(--card-padding)] py-[var(--card-padding)] sm:gap-[var(--card-padding-sm)] sm:py-[var(--card-padding-sm)]">${intro}</header></div>`;
        return injectHomePrerender(html, markup);
      },
    },
    async generateBundle(_options, bundle) {
      const home = bundle["index.html"];
      if (!home || home.type !== "asset") throw new Error("SEO 构建缺少 index.html");
      const buildDate = new Date().toISOString().slice(0, 10);
      const env = loadEnv(config.mode, config.envDir, "VITE_");
      const counts = await fetchMarketCounts({
        baseUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        dataSource: env.VITE_EDM_DATA_SOURCE,
      });
      for (const market of SEO_MARKETS) {
        const count = counts.find(({ code }) => code === market.code)?.count ?? null;
        this.emitFile({
          type: "asset", fileName: `markets/${market.code}/index.html`,
          source: renderMarketDocument(String(home.source), buildMarketPage(market, count, buildDate)),
        });
      }
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: generateSitemap(buildDate) });
      const summary = counts.map(({ code, count }) => `${code.toUpperCase()}: ${count ?? "unavailable (omitted)"}`).join(", ");
      config.logger.info(`[seo] ${buildDate} — ${summary}`);
    },
  };
}
