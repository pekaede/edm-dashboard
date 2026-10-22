import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "../i18n";
import { fetchBrandOverview, type BrandOverviewRow } from "../supabase";
import { EmptyState } from "./EmptyState";
import { PageNav } from "./PageNav";
import { LoadingBlock } from "./ui/loading-block";

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

/** Panoramata 90 天卡片里标签后的问号提示圈（版式还原）。 */
function HintMark() {
  return <span aria-hidden className="ml-1 inline-flex h-3.5 w-3.5 translate-y-[1px] items-center justify-center rounded-full border border-[var(--border-default)] text-[9px] leading-none text-[var(--text-secondary)]">?</span>;
}

/** Panoramata 风格的白色统计卡：标题 + 内容区。 */
function PanaCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-5 shadow-[0_1px_2px_rgba(60,50,30,0.05)]">
    <h4 className="mb-4 text-[15px] font-semibold text-[var(--text-heading)]">{title}</h4>
    {children}
  </section>;
}

/** 近 30 天卡片的大数字指标：小灰标签 + 粗体大数字 + 可选的上期对比行（from 上期值 + 涨跌胶囊）。 */
function Stat30({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return <div>
    <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>
    <p className="mt-0.5 text-[26px] font-bold leading-8 tabular-nums text-[var(--text-heading)]">{value}</p>
    {children}
  </div>;
}

/** Panoramata 的上期对比：from X 文案 + 红跌绿涨胶囊（数值与箭头均为 Panoramata 页面原样展示）。 */
function DeltaSub({ prev, delta, formatPrev, fromLabel }: { prev: number | null; delta: number | null; formatPrev: (value: number) => string; fromLabel: string }) {
  if (prev === null && delta === null) return null;
  const down = delta !== null && delta < 0;
  const up = delta !== null && delta > 0;
  return <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] tabular-nums text-[var(--text-secondary)]">
    {prev !== null && <span>{fromLabel} {formatPrev(prev)}</span>}
    {delta !== null && <span className={`rounded-full px-2 py-px text-xs font-semibold ${down ? "bg-[#fee2e2] text-[#b42318]" : up ? "bg-[#d3f8df] text-[#067647]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"}`}>{down ? "↓ " : up ? "↑ " : ""}{delta}%</span>}
  </p>;
}

/** 90 天卡片的指标行：小灰标签（带问号圈）+ 常规字重数值。 */
function MetricRow({ label, children }: { label: string; children: ReactNode }) {
  return <div>
    <p className="text-[13px] text-[var(--text-secondary)]">{label}<HintMark /></p>
    <div className="mt-0.5 text-[15px] font-medium tabular-nums text-[var(--text-heading)]">{children}</div>
  </div>;
}

/** Panoramata 的薄荷绿关键词胶囊。 */
function KeywordChips({ words }: { words: string[] | null }) {
  const list = (words ?? []).filter(Boolean);
  if (list.length === 0) return <span>—</span>;
  return <span className="flex flex-wrap gap-1.5">{list.map((word) => <span key={word} className="rounded-full bg-[#d8f9e6] px-2.5 py-[3px] text-xs font-medium leading-4 text-[#0a6640]">{word}</span>)}</span>;
}

/** Panoramata 邮件健康指示：✅ 正常 / 🔴 异常（主题 10–60 字符、体积 ≤1000 Kb、垃圾评分 <1 视为正常）。 */
function healthDot(kind: "subject" | "size" | "spam", value: number | null): string | null {
  if (value === null) return null;
  const ok = kind === "subject" ? value >= 10 && value <= 60 : kind === "size" ? value <= 1000 : value < 1;
  return ok ? "✅" : "🔴";
}

function HealthValue({ dot, children }: { dot: string | null; children: ReactNode }) {
  return <>{dot && <span aria-hidden className="mr-1.5">{dot}</span>}{children}</>;
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
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";
  const fmtInt = (value: number | null) => value === null ? "—" : value.toLocaleString(localeTag, { maximumFractionDigits: 0 });
  const fmtDec = (value: number | null) => value === null ? "—" : value.toLocaleString(localeTag, { maximumFractionDigits: 2 });
  const fmtPct1 = (value: number | null) => value === null ? "—" : `${value.toLocaleString(localeTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const hasWords = (words: string[] | null) => (words ?? []).some(Boolean);
  return <div className="min-w-0 space-y-6">
    <h1 className="card-title text-[var(--text-heading)]">{t("viewBrands")}</h1>
    <p className="text-sm text-[var(--text-secondary)]">{t("boHint")}</p>
    <PageNav sections={brands.map((brand) => ({ id: `brand-overview-${brandOverviewSlug(brand)}`, label: brand }))} />
    {brands.map((brand) => {
      const brandRows = groups.get(brand)!;
      const sum = (key: "emails_archived" | "total_ads" | "landing_pages_tracked") => brandRows.reduce((acc, row) => acc + (row[key] ?? 0), 0);
      const latestCaptured = brandRows.map((row) => row.captured_at).filter(Boolean).sort().at(-1) ?? null;
      const sourceUrl = brandRows.find((row) => row.source_page_url)?.source_page_url ?? null;
      return <div key={brand} id={`brand-overview-${brandOverviewSlug(brand)}`} className={`scroll-mt-20 min-w-0 rounded-[var(--card-radius)] transition-shadow duration-500 ${highlight === brandOverviewSlug(brand) ? "ring-2 ring-[var(--accent-ink)] ring-offset-4 ring-offset-[var(--surface-page)]" : ""}`}>
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
          <div>
            <h2 className="text-[22px] font-bold leading-7 text-[var(--text-heading)]">{brand}</h2>
            <p className="mt-1 text-[13px] tabular-nums text-[var(--text-secondary)]">
              {t("bo_emails_archived")} {fmtInt(sum("emails_archived"))} · {t("bo_total_ads")} {fmtInt(sum("total_ads"))} · {t("bo_landing_pages_tracked")} {fmtInt(sum("landing_pages_tracked"))} · {brandRows.length} {t("boMarketsUnit")} · {t("boDataAsOf")} {displayDate(latestCaptured, locale)}
            </p>
          </div>
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[var(--accent-ink)] underline underline-offset-2">Panoramata ↗</a>}
        </header>
        {brandRows.map((row) => {
          // 无数据的指标不展示；整张卡片无数据时整卡不展示（与 Panoramata 页面行为一致）。
          const stats30: ReactNode[] = [];
          if (row.new_emails_sent_30d !== null) stats30.push(<Stat30 key="emails" label={t("bo_new_emails_sent_30d")} value={fmtInt(row.new_emails_sent_30d)}>
            <DeltaSub prev={row.prev_new_emails_sent_30d} delta={row.delta_new_emails_sent_30d_pct} formatPrev={(v) => fmtInt(v)} fromLabel={t("boFromPrev")} />
          </Stat30>);
          if (row.new_ads_30d !== null) stats30.push(<Stat30 key="ads" label={t("bo_new_ads_30d")} value={fmtInt(row.new_ads_30d)}>
            <DeltaSub prev={row.prev_new_ads_30d} delta={row.delta_new_ads_30d_pct} formatPrev={(v) => fmtInt(v)} fromLabel={t("boFromPrev")} />
          </Stat30>);
          if (row.avg_email_scoring_pct !== null) stats30.push(<Stat30 key="scoring" label={t("boAvgScoringPlain")} value={`${fmtDec(row.avg_email_scoring_pct)}%`}>
            <DeltaSub prev={row.prev_avg_email_scoring_pct} delta={row.delta_avg_email_scoring_pct} formatPrev={(v) => `${fmtDec(v)}%`} fromLabel={t("boFromPrev")} />
          </Stat30>);
          if (row.unique_copy_30d !== null) stats30.push(<Stat30 key="copy" label={t("bo_unique_copy_30d")} value={fmtInt(row.unique_copy_30d)}>
            <DeltaSub prev={row.prev_unique_copy_30d} delta={row.delta_unique_copy_30d_pct} formatPrev={(v) => fmtInt(v)} fromLabel={t("boFromPrev")} />
          </Stat30>);
          const emailLeft: ReactNode[] = [];
          if (row.avg_subject_length !== null) emailLeft.push(<MetricRow key="subject" label={t("boSubjectPlain")}><HealthValue dot={healthDot("subject", row.avg_subject_length)}>{`${fmtDec(row.avg_subject_length)} ${t("boUnitChars")}`}</HealthValue></MetricRow>);
          if (row.avg_email_size_kb !== null) emailLeft.push(<MetricRow key="size" label={t("boSizePlain")}><HealthValue dot={healthDot("size", row.avg_email_size_kb)}>{`${fmtDec(row.avg_email_size_kb)} Kb`}</HealthValue></MetricRow>);
          if (row.avg_spam_score !== null) emailLeft.push(<MetricRow key="spam" label={t("boSpamPlain")}><HealthValue dot={healthDot("spam", row.avg_spam_score)}>{fmtDec(row.avg_spam_score)}</HealthValue></MetricRow>);
          if (row.sending_provider) emailLeft.push(<MetricRow key="provider" label={t("boProvider")}>{row.sending_provider}</MetricRow>);
          const emailRight: ReactNode[] = [];
          if (hasWords(row.email_top_keywords)) emailRight.push(<MetricRow key="words" label={t("boEmailWords")}><KeywordChips words={row.email_top_keywords} /></MetricRow>);
          const adsLeft: ReactNode[] = [];
          if (row.avg_ad_live_days !== null) adsLeft.push(<MetricRow key="live" label={t("boAvgLivePlain")}>{`${fmtDec(row.avg_ad_live_days)} ${t("boUnitDays")}`}</MetricRow>);
          if (row.video_share_pct !== null) {
            const imagesPct = Math.round((100 - row.video_share_pct) * 10) / 10;
            adsLeft.push(<MetricRow key="media" label={t("boMediaSplit")}>{`${fmtPct1(imagesPct)} ${t("boImagesWord")} | ${fmtPct1(row.video_share_pct)} ${t("boVideosWord")}`}</MetricRow>);
          }
          if (row.new_ads_90d !== null && row.new_copy_90d !== null) adsLeft.push(<MetricRow key="newvs" label={t("boNewVsCopy")}>{`${fmtInt(row.new_ads_90d)} ${t("boNewAdsWord")} / ${fmtInt(row.new_copy_90d)} ${t("boNewCopyWord")}`}</MetricRow>);
          const adsRight: ReactNode[] = [];
          if (hasWords(row.top_keywords)) adsRight.push(<MetricRow key="words" label={t("boAdWords")}><KeywordChips words={row.top_keywords} /></MetricRow>);
          if (row.emoji_use_pct !== null) adsRight.push(<MetricRow key="emoji" label={t("boEmojiPlain")}>{fmtPct1(row.emoji_use_pct)}</MetricRow>);
          const showStats = stats30.length > 0;
          const showEmails = emailLeft.length + emailRight.length > 0;
          const showAds = adsLeft.length + adsRight.length > 0;
          return <div key={row.market} className="mb-8 last:mb-0">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
              <h3 className="text-[15px] font-bold text-[var(--text-heading)]">{row.market}</h3>
              {row.company_name && row.company_name !== brand && <span className="text-[13px] text-[var(--text-secondary)]">{row.company_name}</span>}
              {row.tracked_site_url && <a href={row.tracked_site_url} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--accent-ink)] underline underline-offset-2">{row.tracked_site_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
              <span className="text-xs tabular-nums text-[var(--text-secondary)]">{t("bo_emails_archived")} {fmtInt(row.emails_archived)} · {t("bo_total_ads")} {fmtInt(row.total_ads)} · {t("bo_landing_pages_tracked")} {fmtInt(row.landing_pages_tracked)}{row.latest_activity_date ? ` · ${t("boLatest")} ${row.latest_activity_date}` : ""}</span>
            </div>
            {(showStats || showEmails || showAds) && <div className="space-y-4">
              {showStats && <PanaCard title={t("boStats30Title")}>
                <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">{stats30}</div>
              </PanaCard>}
              {showEmails && <PanaCard title={t("boEmails90Title")}>
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                  {emailLeft.length > 0 && <div className={`space-y-4 ${emailRight.length === 0 ? "md:col-span-2" : ""}`}>{emailLeft}</div>}
                  {emailRight.length > 0 && <div className={`space-y-4 ${emailLeft.length === 0 ? "md:col-span-2" : ""}`}>{emailRight}</div>}
                </div>
              </PanaCard>}
              {showAds && <PanaCard title={t("boAds90Title")}>
                <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                  {adsLeft.length > 0 && <div className={`space-y-4 ${adsRight.length === 0 ? "md:col-span-2" : ""}`}>{adsLeft}</div>}
                  {adsRight.length > 0 && <div className={`space-y-4 ${adsLeft.length === 0 ? "md:col-span-2" : ""}`}>{adsRight}</div>}
                </div>
              </PanaCard>}
            </div>}
          </div>;
        })}
      </div>;
    })}
  </div>;
}
