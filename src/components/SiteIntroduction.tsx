import { SEO_BRANDS, SEO_MARKETS, SITE_TITLE } from "../seo";

/** 构建期与浏览器共用首屏内容；生成型中文文案暂不参与语言切换。 */
export function SiteIntroduction() {
  return (
    <div className="seo-introduction">
      <h1 className="dashboard-title text-[var(--text-heading)]">{SITE_TITLE}</h1>
      <p className="seo-subtitle">Email Marketing Intelligence</p>
      <p>覆盖 8 个市场、6 个品牌，按市场分析邮件收录趋势、主题分布与营销节奏，结合日历、关键词和实时 OnePage 报告开展竞品研究。</p>
      <nav aria-label="市场入口">
        <ul className="seo-link-list">
          {SEO_MARKETS.map(({ code, name }) => <li key={code}><a href={`/markets/${code}/`}>{name}</a></li>)}
        </ul>
      </nav>
      <ul className="seo-link-list" aria-label="关注品牌">
        {SEO_BRANDS.map((brand) => <li key={brand}>{brand}</li>)}
      </ul>
      <p>进入<a href="/#emails">邮件视图</a>筛选品牌与主题，或查看<a href="/#dashboard">数据看板</a>中的日历与词云，以及<a href="/#report">OnePage 报告</a>。各市场收录覆盖可能不同。</p>
    </div>
  );
}
