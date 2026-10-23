import { Check, ChevronDown, RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import { LoadingBlock } from "./ui/loading-block";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useMemo, useRef, useState } from "react";
import {
  validateBannerAnalysis,
  validateSubjectAnalysis,
  type BannerAnalysis,
  type EmailContentAnalysisRow,
  type SubjectAnalysis,
  type TrendTerm,
} from "../email-content-analysis";
import { useEmailContentAnalysis } from "../email-content-analysis-data";
import { EXTENDED_EMAIL_META, getEmailMarket, useExtendedEmails } from "../email-data";
import { getCurrentLocale, translate, useLocale, type DictionaryKey } from "../i18n";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";

export interface ContentAnalysisProps {
  /** 市场代码，如 US / UK / AU / FR / DE / IT / ES / NL；null 表示未选单个市场 */
  site: string | null;
  /**
   * 三周窗口（默认周期），闭区间 [start, end]，格式为 YYYY-MM-DD。
   * 来源是调用方传入的 THREE_WEEK_WINDOW（src/three-week-aggregation.ts）。
   * 组件内可切换到三个月周期，其窗口取数据窗口 EXTENDED_EMAIL_META。
   */
  window: {
    start: string;
    end: string;
  };
}

type AnalysisPeriod = "threeWeeks" | "threeMonths";

interface MetricCount {
  key: string;
  count: number;
  percentage: number;
}

interface SubjectSummary {
  analyzedCount: number;
  tactics: MetricCount[];
  discountFramings: { text: string; count: number }[];
  trendTerms: { term: string; category: string; count: number }[];
  lengthStats: {
    avg: number;
    min: number;
    max: number;
  };
  emojiStats: {
    avgCount: number;
    withEmojiCount: number;
    withEmojiRate: number;
  };
  topCtaVerbs: { verb: string; count: number }[];
  personalizationRate: number;
}

interface BannerSummary {
  analyzedCount: number;
  composition: MetricCount[];
  ctaPositions: MetricCount[];
  textImageRatio: MetricCount[];
  seasonalCues: { cue: string; count: number }[];
}

/** 归一化后的窗口内邮件原始内容（来自 emails 表）。 */
interface WindowEmail {
  market: string;
  brand: string;
  sent_date: string;
  day_seq: number;
  subject: string | null;
  preheader: string | null;
  banner_url: string | null;
}

/** 每封邮件的互斥状态：success 需结果有效且对应最新尝试输入；过期结果单独计数。 */
type AnalysisOutcome = "success" | "queued" | "failed" | "missing" | "skipped" | "expired";

interface EmailAnalysis {
  subject: { outcome: AnalysisOutcome; result: SubjectAnalysis | null };
  banner: { outcome: AnalysisOutcome; result: BannerAnalysis | null };
}

interface Coverage {
  /** 覆盖率分母：同市场同窗口的 emails 样本数（来自 emails 表）。 */
  sample: number;
  collected: number;
  collectionRate: number;
  withSubject: number;
  withPreheader: number;
  withBanner: number;
  subject: Record<AnalysisOutcome, number>;
  banner: Record<AnalysisOutcome, number>;
  subjectSuccessRate: number;
  bannerSuccessRate: number;
  /** Banner 成功率的补充口径：分母仅为有 Banner 图的邮件。 */
  bannerSuccessRateAmongWithBanner: number | null;
}

const TACTIC_LABEL_MAP: Record<string, DictionaryKey> = {
  urgency: "caTacUrgency",
  discount: "caTacDiscount",
  social_proof: "caTacSocialProof",
  newness: "caTacNewness",
  curiosity: "caTacCuriosity",
  personalization: "caTacPersonalization",
  benefit: "caTacBenefit",
  exclusivity: "caTacExclusivity",
  seasonal: "caTacSeasonal",
};

const COMPOSITION_LABEL_MAP: Record<string, DictionaryKey> = {
  "text-poster": "caLayTextPoster",
  "fashion-editorial": "caLayFashionEditorial",
  "single-model": "caLaySingleModel",
  "multi-product": "caLayMultiProduct",
  "group-shot": "caLayGroupShot",
  collage: "caLayCollage",
  "detail-closeup": "caLayDetailCloseup",
  "lifestyle-scene": "caLayLifestyleScene",
};

const RATIO_LABEL_MAP: Record<string, DictionaryKey> = {
  "text-heavy": "caRatioTextHeavy",
  balanced: "caRatioBalanced",
  "image-heavy": "caRatioImageHeavy",
};

const CTA_POSITION_LABEL_MAP: Record<string, DictionaryKey> = {
  top: "caCtaTop",
  center: "caCtaCenter",
  bottom: "caCtaBottom",
  "bottom-right": "caCtaBottomRight",
  none: "caCtaNone",
};

function labelText(map: Record<string, DictionaryKey>, key: string): string {
  const dictKey = map[key];
  return dictKey ? translate(dictKey) : key;
}

function analysisKey(market: string, brand: string, sent_date: string, day_seq: number): string {
  return [market, brand, sent_date, String(day_seq)].join("\u0000");
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * 未启用/未迁移错误识别：分析视图或 emails 新增列不存在时，
 * PostgREST 返回 404 / PGRST205（表/视图不存在）/ PGRST204（列不存在）
 * / "does not exist" 等。这不是网络失败，应显示“尚未启用”而非通用报错。
 */
function isNotEnabledError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /PGRST205|PGRST204|does not exist|Could not find the table|column .* does not exist|schema cache|404/.test(
      message,
    )
  );
}

function subjectOutcome(row: EmailContentAnalysisRow | undefined): EmailAnalysis["subject"] {
  if (!row) return { outcome: "missing", result: null };
  if (row.status === "pending" || row.status === "processing") {
    return { outcome: "queued", result: null };
  }
  if (row.status === "skipped") return { outcome: "skipped", result: null };
  if (row.status === "failed") return { outcome: "failed", result: null };
  if (row.status === "success" && row.result !== null && validateSubjectAnalysis(row.result)) {
    // 回退到其他输入的成功，或缺少成功时间：待更新，不参与当前覆盖率、聚合和展开。
    if (row.is_stale !== false || row.analyzed_at == null) return { outcome: "expired", result: null };
    return { outcome: "success", result: row.result };
  }
  // success 标记但结果缺失/校验失败：不能当成成功，按失败计，不静默丢弃。
  return { outcome: "failed", result: null };
}

function bannerOutcome(row: EmailContentAnalysisRow | undefined): EmailAnalysis["banner"] {
  if (!row) return { outcome: "missing", result: null };
  if (row.status === "pending" || row.status === "processing") {
    return { outcome: "queued", result: null };
  }
  if (row.status === "skipped") return { outcome: "skipped", result: null };
  if (row.status === "failed") return { outcome: "failed", result: null };
  if (row.status === "success" && row.result !== null && validateBannerAnalysis(row.result)) {
    if (row.is_stale !== false || row.analyzed_at == null) return { outcome: "expired", result: null };
    return { outcome: "success", result: row.result };
  }
  return { outcome: "failed", result: null };
}

/** 纯函数：标题分析聚合。分布类分母仅含当前输入的 success；过期/缺失行不计入“无 CTA/零 Emoji”。 */
function aggregateSubjectAnalysis(results: SubjectAnalysis[]): SubjectSummary {
  const analyzedCount = results.length;
  if (analyzedCount === 0) {
    return {
      analyzedCount: 0,
      tactics: [],
      discountFramings: [],
      trendTerms: [],
      lengthStats: { avg: 0, min: 0, max: 0 },
      emojiStats: { avgCount: 0, withEmojiCount: 0, withEmojiRate: 0 },
      topCtaVerbs: [],
      personalizationRate: 0,
    };
  }

  const tacticCountMap = new Map<string, number>();
  const discountMap = new Map<string, { text: string; count: number }>();
  const trendMap = new Map<string, { term: string; category: string; count: number }>();
  let minLength = Infinity;
  let maxLength = -Infinity;
  let totalLength = 0;
  let totalEmojis = 0;
  let withEmojiCount = 0;
  const verbCountMap = new Map<string, number>();
  let personalizationCount = 0;

  for (const s of results) {
    if (Array.isArray(s.tactics)) {
      // 同一封邮件内归一化后重复的策略只计一次，避免单封 ["discount"," Discount "] 产出 200% 占比。
      const seenTactics = new Set<string>();
      for (const t of s.tactics) {
        const cleanT = t.trim().toLowerCase();
        if (!cleanT || seenTactics.has(cleanT)) continue;
        seenTactics.add(cleanT);
        tacticCountMap.set(cleanT, (tacticCountMap.get(cleanT) ?? 0) + 1);
      }
    }
    if (s.discount_framing) {
      const framing = s.discount_framing.trim();
      if (framing) {
        // 大小写变体合并计数，展示保留首次出现的原文写法。
        const key = framing.toLowerCase();
        const prev = discountMap.get(key);
        if (prev) prev.count += 1;
        else discountMap.set(key, { text: framing, count: 1 });
      }
    }
    if (Array.isArray(s.trend_terms)) {
      for (const item of s.trend_terms as TrendTerm[]) {
        const term = item.term?.trim();
        if (!term) continue;
        const key = term.toLowerCase();
        const prev = trendMap.get(key);
        if (prev) prev.count += 1;
        else trendMap.set(key, { term, category: item.category, count: 1 });
      }
    }
    const len = typeof s.length_chars === "number" ? s.length_chars : 0;
    totalLength += len;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    const emojis = typeof s.emoji_count === "number" ? s.emoji_count : 0;
    totalEmojis += emojis;
    if (emojis > 0) withEmojiCount += 1;
    if (Array.isArray(s.cta_verbs)) {
      // 同一封邮件内归一化后重复的动词只计一次（与策略同理）。
      const seenVerbs = new Set<string>();
      for (const v of s.cta_verbs) {
        const cleanVerb = v.trim().toLowerCase();
        if (!cleanVerb || seenVerbs.has(cleanVerb)) continue;
        seenVerbs.add(cleanVerb);
        verbCountMap.set(cleanVerb, (verbCountMap.get(cleanVerb) ?? 0) + 1);
      }
    }
    if (s.personalization) personalizationCount += 1;
  }

  return {
    analyzedCount,
    tactics: Array.from(tacticCountMap.entries())
      .map(([key, count]) => ({
        key,
        count,
        percentage: Math.round((count / analyzedCount) * 100),
      }))
      .sort((a, b) => b.count - a.count),
    discountFramings: Array.from(discountMap.values())
      .map(({ text, count }) => ({ text, count }))
      .sort((a, b) => b.count - a.count),
    trendTerms: Array.from(trendMap.values()).sort(
      (a, b) => b.count - a.count || a.term.localeCompare(b.term),
    ),
    lengthStats: {
      avg: Math.round(totalLength / analyzedCount),
      min: minLength === Infinity ? 0 : minLength,
      max: maxLength === -Infinity ? 0 : maxLength,
    },
    emojiStats: {
      avgCount: Number((totalEmojis / analyzedCount).toFixed(1)),
      withEmojiCount,
      withEmojiRate: Math.round((withEmojiCount / analyzedCount) * 100),
    },
    topCtaVerbs: Array.from(verbCountMap.entries())
      .map(([verb, count]) => ({ verb, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    personalizationRate: Math.round((personalizationCount / analyzedCount) * 100),
  };
}

/** 纯函数：Banner 视觉分析聚合（构图、CTA 位置、图文比、季节元素）。 */
function aggregateBannerAnalysis(results: BannerAnalysis[]): BannerSummary {
  const analyzedCount = results.length;
  if (analyzedCount === 0) {
    return {
      analyzedCount: 0,
      composition: [],
      ctaPositions: [],
      textImageRatio: [],
      seasonalCues: [],
    };
  }

  const compositionMap = new Map<string, number>();
  const positionMap = new Map<string, number>();
  const ratioMap = new Map<string, number>();
  const cueMap = new Map<string, number>();

  for (const b of results) {
    if (b.composition) {
      const comp = b.composition.trim().toLowerCase();
      if (comp) compositionMap.set(comp, (compositionMap.get(comp) ?? 0) + 1);
    }
    const posKey = b.cta_position?.trim().toLowerCase() || "none";
    positionMap.set(posKey, (positionMap.get(posKey) ?? 0) + 1);
    if (b.text_image_ratio) {
      const ratio = b.text_image_ratio.trim().toLowerCase();
      if (ratio) ratioMap.set(ratio, (ratioMap.get(ratio) ?? 0) + 1);
    }
    if (Array.isArray(b.seasonal_cues)) {
      for (const cue of b.seasonal_cues) {
        const cleanCue = cue.trim();
        if (cleanCue) cueMap.set(cleanCue, (cueMap.get(cleanCue) ?? 0) + 1);
      }
    }
  }

  const toMetric = (map: Map<string, number>): MetricCount[] =>
    Array.from(map.entries())
      .map(([key, count]) => ({
        key,
        count,
        percentage: Math.round((count / analyzedCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

  return {
    analyzedCount,
    composition: toMetric(compositionMap),
    ctaPositions: toMetric(positionMap),
    textImageRatio: toMetric(ratioMap),
    seasonalCues: Array.from(cueMap.entries())
      .map(([cue, count]) => ({ cue, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function HorizontalProgressBar({
  label,
  count,
  percentage,
  total,
}: {
  label: string;
  count: number;
  percentage: number;
  total: number;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--text-body)] truncate" title={label}>
          {label}
        </span>
        <span className="tabular-nums text-[var(--text-secondary)] shrink-0 ml-2">
          {count} {t("marketUnitEmails", { count })} ({percentage}%)
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[var(--control-active-bg)] transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

function StatPill({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 shadow-xs">
      <p className="text-xs text-[var(--text-secondary)]">{title}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-heading)]">{value}</p>
      {subtext ? (
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtext}</p>
      ) : null}
    </div>
  );
}

function OutcomeBreakdown({
  label,
  counts,
  sample,
  extra,
}: {
  label: string;
  counts: Coverage["subject"];
  sample: number;
  extra?: string;
}) {
  const { t, locale } = useLocale();
  const pct = (n: number) => (sample > 0 ? `${Math.round((n / sample) * 100)}%` : "—");
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-[var(--text-heading)]">{label}</p>
      <p className="text-[var(--text-secondary)]">
        {t("caOutcomeLine", { s: counts.success, sp: pct(counts.success), q: counts.queued, qp: pct(counts.queued), f: counts.failed, fp: pct(counts.failed), m: counts.missing, mp: pct(counts.missing), sk: counts.skipped, skp: pct(counts.skipped) })}
      </p>
      <p className="text-[var(--text-secondary)]">
        {locale === "en"
          ? `Stale / awaiting update ${counts.expired} (${pct(counts.expired)})`
          : `过期/待更新 ${counts.expired} 封 (${pct(counts.expired)})`}
        {extra ? ` · ${extra}` : ""}
      </p>
    </div>
  );
}

const TREND_CATEGORY_LABEL_MAP: Record<string, DictionaryKey> = {
  fashion: "caTrendFashion",
  trend: "caTrendTrend",
  hotspot: "caTrendHotspot",
  seasonal: "caTrendSeasonal",
  marketing: "caTrendMarketing",
};

/** 展开列表里的一封邮件（标题/副标题原文）。 */
interface SubjectListItem {
  brand: string;
  sent_date: string;
  subject: string;
  preheader: string | null;
}

interface PatternGroup {
  template: string;
  count: number;
  /** 代表例（同模板中日期最新的一封的原标题）。 */
  example: string;
  firstSeen: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 标题 → 句式模板：品牌名、价格、百分比、数字抽象为占位符后归一，
 * 同一模板即同一句式。例："Up to 50% Off + Free Shipping" → "up to {n}% off + free shipping"。
 */
function toSubjectTemplate(subject: string, brand: string): string {
  let s = subject.trim();
  if (brand) s = s.replace(new RegExp(escapeRegExp(brand), "gi"), "{brand}");
  s = s.replace(/[$£€]\s?\d[\d,]*(?:\.\d{1,2})?/g, "{price}");
  s = s.replace(/\d+(?:\.\d+)?\s*%/g, "{n}%");
  s = s.replace(/\d[\d,]*(?:\.\d+)?/g, "{n}");
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** 聚合只保留语义占位符，展示时随当前语言翻译。 */
function displaySubjectTemplate(template: string): string {
  return getCurrentLocale() === "en"
    ? template
    : template.replaceAll("{brand}", "{品牌}").replaceAll("{price}", "{价格}");
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 句式挖掘（纯前端确定性算法）：常用句式 = 出现 ≥2 次的模板（按次数降序取前 6）；
 * 新句式 = 首次出现日期落在样本最近 7 天内、且未进常用榜的模板（按首见日期降序取前 6）。
 */
function minePatterns(items: SubjectListItem[]): { common: PatternGroup[]; fresh: PatternGroup[] } {
  const map = new Map<string, PatternGroup & { exampleDate: string }>();
  for (const item of items) {
    const template = toSubjectTemplate(item.subject, item.brand);
    if (!template) continue;
    const prev = map.get(template);
    if (prev) {
      prev.count += 1;
      if (item.sent_date < prev.firstSeen) prev.firstSeen = item.sent_date;
      if (item.sent_date > prev.exampleDate) {
        prev.exampleDate = item.sent_date;
        prev.example = item.subject;
      }
    } else {
      map.set(template, { template, count: 1, example: item.subject, firstSeen: item.sent_date, exampleDate: item.sent_date });
    }
  }
  const groups = Array.from(map.values());
  const common = groups
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || a.template.localeCompare(b.template))
    .slice(0, 6);
  const maxDate = items.reduce((m, i) => (i.sent_date > m ? i.sent_date : m), "");
  const cutoff = maxDate ? addDays(maxDate, -6) : "";
  const commonKeys = new Set(common.map((g) => g.template));
  const fresh = groups
    .filter((g) => g.firstSeen >= cutoff && !commonKeys.has(g.template))
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.count - a.count)
    .slice(0, 6);
  const strip = ({ template, count, example, firstSeen }: PatternGroup & { exampleDate: string }): PatternGroup => ({
    template,
    count,
    example,
    firstSeen,
  });
  return { common: common.map(strip), fresh: fresh.map(strip) };
}

/** 展开区共用：某分类/词条下的全部标题/副标题列表（可滚动）。 */
function SubjectEmailList({ items }: { items: SubjectListItem[] }) {
  const { t } = useLocale();
  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-secondary)] italic">{t("caNoSubjects")}</p>;
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {items.map((item, idx) => (
        <li
          key={`${item.brand}|${item.sent_date}|${idx}`}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {item.brand} · {item.sent_date}
          </p>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-[var(--text-heading)]">{item.subject}</p>
          {item.preheader ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{item.preheader}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ContentAnalysis({ site, window: dateWindow }: ContentAnalysisProps) {
  const { t } = useLocale();
  const [period, setPeriod] = useState<AnalysisPeriod>("threeWeeks");
  const [selectedBrands, setSelectedBrands] = useState<ReadonlySet<string>>(new Set());
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const tacticChipRefs = useRef(new Map<string, HTMLButtonElement>());
  const trendChipRefs = useRef(new Map<string, HTMLButtonElement>());
  // 当前周期窗口：三周用调用方传入的 THREE_WEEK_WINDOW；三个月用数据窗口。
  const activeWindow =
    period === "threeWeeks"
      ? dateWindow
      : { start: EXTENDED_EMAIL_META.windowStart, end: EXTENDED_EMAIL_META.windowEnd };
  const emailData = useExtendedEmails();
  const analysisData = useEmailContentAnalysis({
    source: emailData.meta.dataSource,
    market: site,
    start: activeWindow.start,
    end: activeWindow.end,
  });
  const loading = emailData.status === "loading" || analysisData.status === "loading";
  const error = emailData.error ?? analysisData.error?.message ??
    (emailData.status === "incomplete" ? t("stIncompleteDescPlain") : null);
  const notEnabledDetail = emailData.error && isNotEnabledError(emailData.error)
    ? t("caNotEnabledCol", { detail: emailData.error })
    : analysisData.error && isNotEnabledError(analysisData.error)
      ? t("caNotEnabledView", { detail: analysisData.error })
      : null;
  const analysisRows = analysisData.rows;
  const emails = useMemo<WindowEmail[] | null>(() => {
    if (emailData.status !== "ready") return null;
    return emailData.emails
      .filter((row) => getEmailMarket(row) === site && row.date >= activeWindow.start && row.date <= activeWindow.end)
      .map((row) => ({
        market: getEmailMarket(row),
        brand: row.brand,
        sent_date: row.date,
        day_seq: row.day_seq,
        subject: asNullableText(row.subject),
        preheader: asNullableText(row.preheader),
        banner_url: asNullableText(row.banner_url),
      }));
  }, [emailData.status, emailData.emails, site, activeWindow.start, activeWindow.end]);

  // 品牌多选筛选：选项来自当前市场+窗口的 emails 样本；未选任何品牌即全部；
  // 选中的品牌不在当前样本中时自动忽略（切市场/周期后不悬空）。
  const brandOptions = useMemo(() => {
    if (emails === null) return [];
    return [...new Set(emails.map((e) => e.brand))].sort();
  }, [emails]);
  const effectiveBrands = useMemo(
    () => brandOptions.filter((b) => selectedBrands.has(b)),
    [brandOptions, selectedBrands],
  );
  const brandFilterActive = effectiveBrands.length > 0;
  const toggleBrand = (name: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const joined = useMemo(() => {
    if (emails === null) return null;
    const byKey = new Map<string, { subject?: EmailContentAnalysisRow; banner?: EmailContentAnalysisRow }>();
    for (const row of analysisRows ?? []) {
      const key = analysisKey(row.market, row.brand, row.sent_date, row.day_seq);
      const slot = byKey.get(key) ?? {};
      if (row.analysis_type === "subject" && !slot.subject) slot.subject = row;
      if (row.analysis_type === "banner" && !slot.banner) slot.banner = row;
      byKey.set(key, slot);
    }
    const visibleEmails = brandFilterActive ? emails.filter((e) => effectiveBrands.includes(e.brand)) : emails;
    return visibleEmails.map((email) => {
      const slot = byKey.get(analysisKey(email.market, email.brand, email.sent_date, email.day_seq));
      return {
        email,
        analysis: {
          subject: subjectOutcome(slot?.subject),
          banner: bannerOutcome(slot?.banner),
        } as EmailAnalysis,
      };
    });
  }, [emails, analysisRows, effectiveBrands, brandFilterActive]);

  const coverage = useMemo<Coverage | null>(() => {
    if (joined === null) return null;
    const sample = joined.length;
    let collected = 0;
    let withSubject = 0;
    let withPreheader = 0;
    let withBanner = 0;
    let bannerSuccessWithBanner = 0;
    const subject: Coverage["subject"] = { success: 0, queued: 0, failed: 0, missing: 0, skipped: 0, expired: 0 };
    const banner: Coverage["banner"] = { success: 0, queued: 0, failed: 0, missing: 0, skipped: 0, expired: 0 };
    for (const { email, analysis } of joined) {
      if (email.subject !== null || email.preheader !== null || email.banner_url !== null) collected += 1;
      if (email.subject !== null) withSubject += 1;
      if (email.preheader !== null) withPreheader += 1;
      if (email.banner_url !== null) withBanner += 1;
      if (email.banner_url !== null && analysis.banner.outcome === "success") bannerSuccessWithBanner += 1;
      // 六种状态互斥，合计等于样本数；过期结果不重复计入成功。
      subject[analysis.subject.outcome] += 1;
      banner[analysis.banner.outcome] += 1;
    }
    return {
      sample,
      collected,
      collectionRate: sample > 0 ? Math.round((collected / sample) * 100) : 0,
      withSubject,
      withPreheader,
      withBanner,
      subject,
      banner,
      subjectSuccessRate: sample > 0 ? Math.round((subject.success / sample) * 100) : 0,
      bannerSuccessRate: sample > 0 ? Math.round((banner.success / sample) * 100) : 0,
      bannerSuccessRateAmongWithBanner:
        withBanner > 0 ? Math.round((bannerSuccessWithBanner / withBanner) * 100) : null,
    };
  }, [joined]);

  const subjectSummary = useMemo(() => {
    if (!joined) return null;
    return aggregateSubjectAnalysis(
      joined.map((j) => j.analysis.subject.result).filter((r): r is SubjectAnalysis => r !== null),
    );
  }, [joined]);

  // 策略分类展开：选中值不在当前样本（切市场/周期/品牌后）时自动失效，避免悬空展开。
  const effectiveTactic =
    selectedTactic !== null && (subjectSummary?.tactics.some((t) => t.key === selectedTactic) ?? false)
      ? selectedTactic
      : null;
  const tacticDetail = useMemo(() => {
    if (!joined || effectiveTactic === null) return null;
    const items: SubjectListItem[] = [];
    for (const { email, analysis } of joined) {
      const result = analysis.subject.result;
      if (analysis.subject.outcome !== "success" || !result || !email.subject) continue;
      const tactics = Array.isArray(result.tactics)
        ? result.tactics.map((t) => t.trim().toLowerCase())
        : [];
      if (!tactics.includes(effectiveTactic)) continue;
      items.push({
        brand: email.brand,
        sent_date: email.sent_date,
        subject: email.subject,
        preheader: email.preheader,
      });
    }
    items.sort((a, b) => b.sent_date.localeCompare(a.sent_date) || a.brand.localeCompare(b.brand));
    return { items, patterns: minePatterns(items) };
  }, [joined, effectiveTactic]);

  // 趋势词展开：点词条看抽到该词的全部邮件。
  const effectiveTrend =
    selectedTrend !== null &&
    (subjectSummary?.trendTerms.some((t) => t.term.toLowerCase() === selectedTrend) ?? false)
      ? selectedTrend
      : null;
  const trendDetail = useMemo(() => {
    if (!joined || effectiveTrend === null) return null;
    const items: SubjectListItem[] = [];
    for (const { email, analysis } of joined) {
      const result = analysis.subject.result;
      if (analysis.subject.outcome !== "success" || !result || !email.subject) continue;
      const hit = (result.trend_terms ?? []).some((t) => t.term.trim().toLowerCase() === effectiveTrend);
      if (!hit) continue;
      items.push({
        brand: email.brand,
        sent_date: email.sent_date,
        subject: email.subject,
        preheader: email.preheader,
      });
    }
    items.sort((a, b) => b.sent_date.localeCompare(a.sent_date) || a.brand.localeCompare(b.brand));
    return items;
  }, [joined, effectiveTrend]);

  const bannerSummary = useMemo(() => {
    if (!joined) return null;
    return aggregateBannerAnalysis(
      joined.map((j) => j.analysis.banner.result).filter((r): r is BannerAnalysis => r !== null),
    );
  }, [joined]);

  // 周期切换（与词云同款式）：默认三周，可切三个月（数据窗口）。
  const periodToggle = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold text-[var(--text-control)]">{t("caRangeLabel")}</span>
      <div
        role="group"
        aria-label={t("caRangeAria")}
        className="grid grid-cols-2 rounded-full border border-[var(--border-wordcloud-control)] bg-[var(--surface-raised)] p-1"
      >
        {([
          ["threeWeeks", "caPeriod3w"],
          ["threeMonths", "caPeriod3m"],
        ] as const).map(([value, labelKey]) => {
          const isSelected = period === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setPeriod(value)}
              className={`min-h-10 rounded-full px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-control)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                isSelected
                  ? "bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-sm"
                  : "text-[var(--text-label)] hover:bg-[var(--surface-wordcloud-hover)] hover:text-[var(--text-control)]"
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );

  // 选项仍取当前样本；effectiveBrands 为空时回落全部，切市场/周期不悬空。
  const brandSelect = brandOptions.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-[var(--text-control)]">{t("efColBrand")}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label={t("caBrandAria")} className="rounded-full">
            <span className="max-w-64 truncate">
              {!brandFilterActive ? t("caAllBrands") : effectiveBrands.length <= 3
                ? effectiveBrands.join(" · ") : t("caBrandsSelectedCount", { n: effectiveBrands.length })}
            </span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] p-2" aria-label={t("caBrandAria")}>
          <div role="group" aria-label={t("caBrandAria")} className="max-h-72 space-y-1 overflow-y-auto">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" aria-pressed={!brandFilterActive} onClick={() => setSelectedBrands(new Set())}>
              <Check aria-hidden="true" className={!brandFilterActive ? "" : "invisible"} />
              {t("caAllBrands")}
            </Button>
            {brandOptions.map((brand) => {
              const isSelected = effectiveBrands.includes(brand);
              return (
                <Button key={brand} type="button" variant="ghost" size="sm" role="checkbox" aria-checked={isSelected} className="w-full justify-start" onClick={() => toggleBrand(brand)}>
                  <Check aria-hidden="true" className={isSelected ? "" : "invisible"} />
                  {brand}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ) : null;

  // 0. 未选单个市场：覆盖率分母是同市场样本，多市场聚合无意义，提示选市场而非报错。
  if (site === null) {
    return (
      <div
        className="flex min-h-[12rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-8 text-center shadow-xs"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-base font-semibold text-[var(--text-heading)]">{t("caPickMarketTitle")}</h3>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("caPickMarketDesc")}
        </p>
      </div>
    );
  }

  // 1. 加载中状态
  if (loading) {
    return (
      <LoadingBlock className="min-h-[18rem]" label={t("caLoading", { site })}>
        <p className="mt-4 text-sm font-medium text-[var(--text-body)]">{t("caLoading", { site })}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {t("caWindowLine", { start: activeWindow.start, end: activeWindow.end })}
        </p>
      </LoadingBlock>
    );
  }

  // 2. 未启用/未迁移状态（与网络失败区分：不展示为报错）
  if (notEnabledDetail !== null) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <h3 className="text-base font-semibold">{t("caNotEnabledTitle")}</h3>
        <p className="mt-2 text-xs leading-relaxed opacity-90 break-words">
          {t("caNotEnabledDesc", { detail: notEnabledDetail })}
        </p>
        <button
          type="button"
          onClick={emailData.retry}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-800 transition"
        >
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          {t("caRetryBtn")}
        </button>
      </div>
    );
  }

  // 3. 错误状态（请求失败重试）
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        <h3 className="text-base font-semibold">{t("caFailedTitle")}</h3>
        <p className="mt-2 text-xs leading-relaxed opacity-90 break-words">{error}</p>
        <button
          type="button"
          onClick={emailData.retry}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-800 transition"
        >
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          {t("caRetryBtn")}
        </button>
      </div>
    );
  }

  // 4. 零行空态：窗口内无邮件（与“有邮件但未采集”区分，后者走覆盖率面板）。
  if (!coverage || coverage.sample === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-5 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {periodToggle}
            {brandSelect}
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            {t("caMetaWindow", { start: activeWindow.start, end: activeWindow.end })}
          </span>
        </div>
        <EmptyState
          title={t("caEmptyWindowTitle")}
          description={t("caEmptyWindowDesc", { site: site, start: activeWindow.start, end: activeWindow.end })}
        />
      </div>
    );
  }

  const totalEmails = coverage.sample;

  return (
    <div className="space-y-6">
      {/* 头部元数据栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-5 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
            {t("caMetaMarket", { site: site })}
          </span>
          {brandFilterActive && (
            <span className="inline-flex items-center rounded-md border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              {t("caMetaBrand", {
                brand:
                  effectiveBrands.length <= 3
                    ? effectiveBrands.join(" · ")
                    : t("caBrandsSelectedCount", { n: effectiveBrands.length }),
              })}
            </span>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            {t("caMetaWindow", { start: activeWindow.start, end: activeWindow.end })}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {t(brandFilterActive ? "caMetaSampleBrand" : "caMetaSampleAll", { n: totalEmails })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {periodToggle}
          {brandSelect}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span>
            {t("caCovCollected")}
            <strong className="text-[var(--text-heading)]">{coverage.collectionRate}%</strong>
          </span>
          <span className="text-[var(--border-default)]">|</span>
          <span>
            {t("caCovSubject")}
            <strong className="text-[var(--text-heading)]">{coverage.subjectSuccessRate}%</strong>
          </span>
          <span className="text-[var(--border-default)]">|</span>
          <span>
            {t("caCovBanner")}
            <strong className="text-[var(--text-heading)]">{coverage.bannerSuccessRate}%</strong>
          </span>
        </div>
      </div>

      {/* 覆盖率：三个率分开显示，分母统一为 emails 样本数；缺失不算成“无 CTA”“零 Emoji”。 */}
      <Card
        title={t("caCovTitle")}
        hint={t("caCovHint", { n: totalEmails })}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatPill
              title={t("caCovCollectedTitle")}
              value={`${coverage.collectionRate}%`}
              subtext={t("caCovCollectedSub", { c: coverage.collected, n: totalEmails })}
            />
            <StatPill
              title={t("caCovSubjectTitle")}
              value={`${coverage.subjectSuccessRate}%`}
              subtext={t("caCovSubjectSub", { c: coverage.subject.success, n: totalEmails })}
            />
            <StatPill
              title={t("caCovBannerTitle")}
              value={`${coverage.bannerSuccessRate}%`}
              subtext={t("caCovBannerSub", { c: coverage.banner.success, n: totalEmails })}
            />
          </div>
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)]">
              {t("caRawLine", { a: coverage.withSubject, b: coverage.withPreheader, c: coverage.withBanner, d: totalEmails - coverage.collected })}
            </p>
            <OutcomeBreakdown label={t("caOutcomeSubject")} counts={coverage.subject} sample={totalEmails} />
            <OutcomeBreakdown
              label={t("caOutcomeBanner")}
              counts={coverage.banner}
              sample={totalEmails}
              extra={`${t("caOutcomeBannerExtra", { n: totalEmails - coverage.withBanner })}${
                coverage.bannerSuccessRateAmongWithBanner !== null
                  ? t("caOutcomeBannerRate", { r: coverage.bannerSuccessRateAmongWithBanner })
                  : ""
              }`}
            />
          </div>
        </div>
      </Card>

      {/* 两大核心板块 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= (a) 主副标题分析 ================= */}
        <div className="min-w-0 lg:h-[860px] lg:[&_.dashboard-card-content]:min-h-0 lg:[&_.dashboard-card-content]:overflow-y-auto lg:[&_.dashboard-card-content]:pr-1">
        <Card
          title={t("caSubjectTitle")}
          hint={t("caAnalyzedHint", { n: subjectSummary?.analyzedCount ?? 0 })}
        >
          {subjectSummary && subjectSummary.analyzedCount > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatPill
                  title={t("caLenTitle")}
                  value={subjectSummary.lengthStats.avg}
                  subtext={t("caLenRange", { min: subjectSummary.lengthStats.min, max: subjectSummary.lengthStats.max })}
                />
                <StatPill
                  title={t("caEmojiAvgTitle")}
                  value={subjectSummary.emojiStats.avgCount}
                  subtext={t("caEmojiRate", { r: subjectSummary.emojiStats.withEmojiRate })}
                />
                <StatPill
                  title={t("caPersTitle")}
                  value={`${subjectSummary.personalizationRate}%`}
                  subtext={t("caPersSub")}
                />
                <StatPill
                  title={t("caEmojiCountTitle")}
                  value={subjectSummary.emojiStats.withEmojiCount}
                  subtext={t("caAnalyzedSamples", { n: subjectSummary.analyzedCount })}
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  {t("caTacticsHeading")}
                </h3>
                <p className="mb-3 text-[11px] text-[var(--text-secondary)]">
                  {t("caTacticsHint")}
                </p>
                {subjectSummary.tactics.length > 0 ? (
                  <div className="space-y-1">
                    {subjectSummary.tactics.map((item) => {
                      const isSelected = effectiveTactic === item.key;
                      return (
                        <button
                          key={item.key}
                          ref={(el) => {
                            if (el) tacticChipRefs.current.set(item.key, el);
                            else tacticChipRefs.current.delete(item.key);
                          }}
                          type="button"
                          aria-expanded={isSelected}
                          aria-controls="ca-tactic-detail"
                          onClick={() => setSelectedTactic(isSelected ? null : item.key)}
                          className={`block w-full rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-control)] ${
                            isSelected
                              ? "bg-[var(--surface-subtle)]"
                              : "hover:bg-[var(--surface-subtle)]"
                          }`}
                        >
                          <HorizontalProgressBar
                            label={labelText(TACTIC_LABEL_MAP, item.key)}
                            count={item.count}
                            percentage={item.percentage}
                            total={subjectSummary.analyzedCount}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoTactics")}
                  </p>
                )}
                {tacticDetail && effectiveTactic !== null ? (
                  <div id="ca-tactic-detail" className="mt-4 space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-heading)]">
                        {labelText(TACTIC_LABEL_MAP, effectiveTactic)}
                        <span className="ml-2 font-normal text-[var(--text-secondary)]">
                          {t("caDetailCount", { n: tacticDetail.items.length })}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTactic(null);
                          const k = effectiveTactic;
                          if (k) tacticChipRefs.current.get(k)?.focus();
                        }}
                        className="shrink-0 rounded-md px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--text-heading)]"
                      >
                        {t("efCollapse")}
                      </button>
                    </div>
                    {tacticDetail.patterns.common.length > 0 ? (
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          {t("caCommonPatterns")}
                        </h4>
                        <ul className="space-y-1.5">
                          {tacticDetail.patterns.common.map((g) => (
                            <li key={g.template} className="text-xs leading-relaxed">
                              <span className="font-medium text-[var(--text-heading)]">{displaySubjectTemplate(g.template)}</span>
                              <span className="ml-1.5 text-[var(--text-secondary)]">×{g.count}</span>
                              <span className="block truncate text-[11px] text-[var(--text-secondary)]" title={g.example}>
                                {t("caExamplePrefix")}{g.example}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {tacticDetail.patterns.fresh.length > 0 ? (
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          {t("caNewPatterns")}
                        </h4>
                        <ul className="space-y-1.5">
                          {tacticDetail.patterns.fresh.map((g) => (
                            <li key={g.template} className="text-xs leading-relaxed">
                              <span className="font-medium text-[var(--text-heading)]">{displaySubjectTemplate(g.template)}</span>
                              <span className="ml-1.5 text-[var(--text-secondary)]">{t("caFirstSeen", { d: g.firstSeen })}</span>
                              <span className="block truncate text-[11px] text-[var(--text-secondary)]" title={g.example}>
                                {t("caExamplePrefix")}{g.example}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {tacticDetail.patterns.common.length === 0 && tacticDetail.patterns.fresh.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)] italic">
                        {t("caFewSamples")}
                      </p>
                    ) : null}
                    <div>
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        {t("caAllSubjectsHeading")}
                      </h4>
                      <SubjectEmailList items={tacticDetail.items} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  {t("caCtaVerbsHeading")}
                </h3>
                {subjectSummary.topCtaVerbs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subjectSummary.topCtaVerbs.map(({ verb, count }) => (
                      <span
                        key={verb}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-heading)]"
                      >
                        <span className="font-semibold">{verb}</span>
                        <span className="rounded-full bg-[var(--surface-card)] px-1.5 py-0.2 text-[10px] text-[var(--text-secondary)]">
                          {count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoCtaVerbs")}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  {t("caDiscountHeading")}
                </h3>
                {subjectSummary.discountFramings.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                    {subjectSummary.discountFramings.map(({ text, count }) => (
                      <span
                        key={text}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-200"
                        title={t("caOccurTitle", { n: count })}
                      >
                        <span>{text}</span>
                        {count > 1 ? (
                          <span className="text-[10px] opacity-75">×{count}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoDiscount")}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  {t("caTrendHeading")}
                </h3>
                {subjectSummary.trendTerms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subjectSummary.trendTerms.map(({ term, category, count }) => {
                      const key = term.toLowerCase();
                      const isSelected = effectiveTrend === key;
                      return (
                        <button
                          key={key}
                          ref={(el) => {
                            if (el) trendChipRefs.current.set(key, el);
                            else trendChipRefs.current.delete(key);
                          }}
                          type="button"
                          aria-expanded={isSelected}
                          aria-controls="ca-trend-detail"
                          onClick={() => setSelectedTrend(isSelected ? null : key)}
                          className={`relative before:absolute before:-inset-1 before:content-[""] inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-control)] ${
                            isSelected
                              ? "border-[var(--control-active-border)] bg-[var(--control-active-bg)] text-[var(--control-active-text)]"
                              : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-body)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
                          }`}
                          title={t("caTrendChipTitle", { n: count })}
                        >
                          <span className={`rounded-sm px-1 text-[10px] font-semibold ${
                            isSelected
                              ? "bg-[var(--control-active-text)]/10 text-[var(--control-active-text)]"
                              : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
                          }`}>
                            {labelText(TREND_CATEGORY_LABEL_MAP, category)}
                          </span>
                          <span>{term}</span>
                          {count > 1 ? <span className="text-[10px] opacity-75">×{count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoTrend")}
                  </p>
                )}
                {trendDetail && effectiveTrend !== null ? (
                  <div id="ca-trend-detail" className="mt-3 space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-heading)]">
                        {subjectSummary.trendTerms.find((tt) => tt.term.toLowerCase() === effectiveTrend)?.term ??
                          effectiveTrend}
                        <span className="ml-2 font-normal text-[var(--text-secondary)]">
                          {t("caDetailCount", { n: trendDetail.length })}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrend(null);
                          const k = effectiveTrend;
                          if (k) trendChipRefs.current.get(k)?.focus();
                        }}
                        className="shrink-0 rounded-md px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--text-heading)]"
                      >
                        {t("efCollapse")}
                      </button>
                    </div>
                    <SubjectEmailList items={trendDetail} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              {t("caNoSubjectResults", { n: totalEmails })}
            </div>
          )}
        </Card>
        </div>

        {/* ================= (b) Banner 视觉分析 ================= */}
        <div className="min-w-0 lg:h-[860px] lg:[&_.dashboard-card-content]:min-h-0 lg:[&_.dashboard-card-content]:overflow-y-auto lg:[&_.dashboard-card-content]:pr-1">
        <Card
          title={t("caBannerTitle")}
          hint={t("caAnalyzedHint", { n: bannerSummary?.analyzedCount ?? 0 })}
        >
          {bannerSummary && bannerSummary.analyzedCount > 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  {t("caCompositionHeading")}
                </h3>
                {bannerSummary.composition.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.composition.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={labelText(COMPOSITION_LABEL_MAP, item.key)}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoComposition")}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  {t("caRatioHeading")}
                </h3>
                {bannerSummary.textImageRatio.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.textImageRatio.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={labelText(RATIO_LABEL_MAP, item.key)}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoRatio")}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  {t("caCtaPlacementHeading")}
                </h3>
                {bannerSummary.ctaPositions.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.ctaPositions.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={labelText(CTA_POSITION_LABEL_MAP, item.key)}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoCtaPlacement")}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  {t("caSeasonalHeading")}
                </h3>
                {bannerSummary.seasonalCues.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {bannerSummary.seasonalCues.map(({ cue, count }) => (
                      <span
                        key={cue}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                      >
                        <span>{cue}</span>
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.2 text-[10px] text-emerald-700 dark:text-emerald-300">
                          {count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    {t("caNoSeasonal")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              {t("caNoBannerResults", { n: totalEmails })}
            </div>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}

export default ContentAnalysis;
