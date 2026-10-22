import { SEO_BRANDS, SEO_MARKETS } from "../seo";
import { useLocale, type DictionaryKey } from "../i18n";

/** 市场链接显示名走 intro* 键：zh 与改版前 SEO_MARKETS.name 一致，预渲染产物不变。 */
const MARKET_LABEL_KEYS = {
  us: "introMarketUS",
  uk: "introMarketUK",
  au: "introMarketAU",
  fr: "introMarketFR",
  de: "introMarketDE",
  it: "introMarketIT",
  es: "introMarketES",
  nl: "introMarketNL",
} as const satisfies Record<string, DictionaryKey>;

/** 构建期预渲染与浏览器共用首屏内容；文案走 i18n，构建期默认中文保证 SEO 产物与历史一致。副标题为英文专名，两语相同，保留常量。 */
export function SiteIntroduction() {
  const { t } = useLocale();
  return (
    <div className="seo-introduction">
      <div className="seo-intro-heading">
        <h1 className="dashboard-title seo-intro-title text-[var(--text-heading)]">{t("introTitle")}</h1>
        <p className="seo-subtitle">Email Marketing Intelligence</p>
      </div>
      <p className="seo-intro-lead">{t("introLead")}</p>
      <nav aria-label={t("introMarketsLabel")}>
        <ul className="seo-link-list seo-market-list">
          {SEO_MARKETS.map(({ code }) => (
            <li key={code}>
              <a className="seo-market-pill" href={`/markets/${code}/`}>{t(MARKET_LABEL_KEYS[code])}</a>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="seo-link-list seo-brand-list" aria-label={t("introBrandsLabel")}>
        {SEO_BRANDS.map((brand) => (
          <li key={brand}>
            <a href={`/#brands/all/${encodeURIComponent(brand)}`}>{brand}</a>
          </li>
        ))}
      </ul>
      <p>
        {t("introOutroA")}<a href="/#emails">{t("introOutroEmails")}</a>{t("introOutroB")}<a href="/#dashboard">{t("introOutroDashboard")}</a>{t("introOutroC")}<a href="/#report">{t("introOutroReport")}</a>{t("introOutroD")}
      </p>
    </div>
  );
}
