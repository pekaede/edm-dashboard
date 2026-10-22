import { useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { fetchBrandOverview, type BrandOverviewRow } from "../supabase";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { PageNav } from "./PageNav";
import { LoadingBlock } from "./ui/loading-block";

const metrics = [
  "emails_archived",
  "total_ads",
  "new_ads_30d",
  "unique_copy_30d",
  "new_ads_90d",
  "new_copy_90d",
  "avg_ad_live_days",
  "video_share_pct",
  "emoji_use_pct",
  "landing_pages_tracked",
  "new_emails_sent_30d",
  "avg_email_scoring_pct",
  "avg_subject_length",
  "avg_email_size_kb",
  "avg_spam_score",
] as const;

/** 品牌锚点 id：小写连字符 slug（Halara→halara、ALO Yoga→alo-yoga），供深链接与页内导航共用。 */
export function brandOverviewSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function displayDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { timeZone: "UTC" }) : "—";
}

export function BrandOverview({ focusBrand }: { focusBrand?: string | null }) {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<BrandOverviewRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setFailed(false);
    void fetchBrandOverview(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setRows(data); },
      () => { if (!controller.signal.aborted) setFailed(true); },
    );
    return () => controller.abort();
  }, [attempt]);
  // 深链接聚焦：URL 带品牌段（如 #brands/all/Halara）时，数据就绪后滚动到该品牌区块并短暂高亮。
  useEffect(() => {
    if (!rows || !focusBrand) return;
    const wanted = focusBrand.trim().toLowerCase();
    const target = rows.find((row) => row.brand.toLowerCase() === wanted)?.brand;
    if (!target) return;
    const slug = brandOverviewSlug(target);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`brand-overview-${slug}`)?.scrollIntoView({ block: "start" });
      setHighlight(slug);
    }, 60);
    const clearTimer = window.setTimeout(() => setHighlight(null), 2200);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer); };
  }, [rows, focusBrand]);
  if (failed) return <EmptyState title={t("boError")} actionLabel={t("ebRetry")} onAction={() => setAttempt((n) => n + 1)} />;
  if (!rows) return <LoadingBlock label={t("loading")} />;
  if (rows.length === 0) return <EmptyState title={t("boEmpty")} />;
  const groups = new Map<string, BrandOverviewRow[]>();
  for (const row of rows) groups.set(row.brand, [...(groups.get(row.brand) ?? []), row]);
  const brands = [...groups.keys()];
  const format = (value: number | null) => value === null ? "—" : value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 });
  return <div className="min-w-0 space-y-6">
    <h1 className="card-title text-[var(--text-heading)]">{t("viewBrands")}</h1>
    <p className="text-sm text-[var(--text-secondary)]">{t("boHint")}</p>
    <PageNav sections={brands.map((brand) => ({ id: `brand-overview-${brandOverviewSlug(brand)}`, label: brand }))} />
    {brands.map((brand) => <div key={brand} id={`brand-overview-${brandOverviewSlug(brand)}`} className={`scroll-mt-20 min-w-0 rounded-[var(--card-radius)] transition-shadow duration-500 ${highlight === brandOverviewSlug(brand) ? "ring-2 ring-[var(--accent-ink)] ring-offset-4 ring-offset-[var(--surface-page)]" : ""}`}>
      <Card title={brand}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{brand} · {t("viewBrands")}</caption>
            <thead><tr className="border-b border-[var(--border-default)] bg-[var(--surface-subtle)]">
              {[t("boMarket"), ...metrics.map((key) => t(`bo_${key}`)), t("boProvider"), t("boAdWords"), t("boEmailWords"), t("boLatest"), t("boSource"), t("boCaptured")].map((label) => <th key={label} scope="col" className="min-w-28 p-3 text-left font-semibold">{label}</th>)}
            </tr></thead>
            <tbody>{groups.get(brand)!.map((row, rowIndex) => <tr key={`${row.market}-${rowIndex}`} className="border-b border-[var(--border-default)] align-top">
              <th scope="row" className="p-3 text-left">{row.market}</th>
              {metrics.map((key) => <td key={key} className="p-3 tabular-nums">{format(row[key])}</td>)}
              <td className="p-3">{row.sending_provider || "—"}</td>
              <td className="min-w-48 p-3">{row.top_keywords?.filter(Boolean).join(" · ") || "—"}</td>
              <td className="min-w-48 p-3">{row.email_top_keywords?.filter(Boolean).join(" · ") || "—"}</td>
              <td className="whitespace-nowrap p-3">{row.latest_activity_date && Number.isFinite(Date.parse(row.latest_activity_date)) ? row.latest_activity_date : "—"}</td>
              <td className="p-3">{row.source || "—"}</td>
              <td className="min-w-48 p-3">{displayDate(row.captured_at, locale)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>)}
  </div>;
}
