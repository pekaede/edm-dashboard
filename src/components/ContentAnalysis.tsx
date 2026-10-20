import { useEffect, useMemo, useState } from "react";
import {
  fetchContentAnalysis,
  validateBannerAnalysis,
  validateSubjectAnalysis,
  type BannerAnalysis,
  type EmailContentAnalysisRow,
  type SubjectAnalysis,
} from "../email-content-analysis";
import { fetchEmailDataset } from "../supabase";
import { EXTENDED_EMAIL_META } from "../email-data";
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
  label: string;
  count: number;
  percentage: number;
}

interface SubjectSummary {
  analyzedCount: number;
  tactics: MetricCount[];
  discountFramings: { text: string; count: number }[];
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
  dominantColors: { label: string; hex: string | null; count: number; percentage: number }[];
  composition: MetricCount[];
  ctaPresenceRate: number;
  ctaPresenceCount: number;
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

/** 每封邮件的分析结论：success 需同时通过结果校验，否则按失败计。 */
type AnalysisOutcome = "success" | "queued" | "failed" | "missing" | "skipped";

interface EmailAnalysis {
  subject: { outcome: AnalysisOutcome; expired: boolean; result: SubjectAnalysis | null };
  banner: { outcome: AnalysisOutcome; expired: boolean; result: BannerAnalysis | null };
}

interface Coverage {
  /** 覆盖率分母：同市场同窗口的 emails 样本数（来自 emails 表）。 */
  sample: number;
  collected: number;
  collectionRate: number;
  withSubject: number;
  withPreheader: number;
  withBanner: number;
  subject: Record<AnalysisOutcome, number> & { expired: number };
  banner: Record<AnalysisOutcome, number> & { expired: number };
  subjectSuccessRate: number;
  bannerSuccessRate: number;
  /** Banner 成功率的补充口径：分母仅为有 Banner 图的邮件。 */
  bannerSuccessRateAmongWithBanner: number | null;
}

const TACTIC_LABEL_MAP: Record<string, string> = {
  urgency: "紧迫感 (Urgency)",
  discount: "折扣促销 (Discount)",
  social_proof: "社会认同 (Social Proof)",
  newness: "新品上架 (Newness)",
  curiosity: "好奇悬念 (Curiosity)",
  personalization: "个性化 (Personalization)",
  benefit: "利益承诺 (Benefit)",
  exclusivity: "专享特权 (Exclusivity)",
  seasonal: "节日时效 (Seasonal)",
};

const COMPOSITION_LABEL_MAP: Record<string, string> = {
  centered: "居中对称 (Centered)",
  "left-aligned": "左侧对齐 (Left-aligned)",
  "split-layout": "左右/图文分栏 (Split)",
  "full-bleed": "满版全屏 (Full-bleed)",
  grid: "网格拼贴 (Grid)",
};

const RATIO_LABEL_MAP: Record<string, string> = {
  "text-heavy": "文字主导 (Text-heavy)",
  balanced: "图文均衡 (Balanced)",
  "image-heavy": "图片主导 (Image-heavy)",
};

const CTA_POSITION_LABEL_MAP: Record<string, string> = {
  top: "顶部 (Top)",
  center: "居中 (Center)",
  bottom: "底部 (Bottom)",
  "bottom-right": "右下角 (Bottom-right)",
  none: "未标明/无明显按钮 (None)",
};

const REQUEST_TIMEOUT_MS = 60_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}请求超时（${ms / 1000} 秒）。`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function subjectOutcome(row: EmailContentAnalysisRow | undefined): EmailAnalysis["subject"] {
  if (!row) return { outcome: "missing", expired: false, result: null };
  if (row.status === "pending" || row.status === "processing") {
    return { outcome: "queued", expired: false, result: null };
  }
  if (row.status === "skipped") return { outcome: "skipped", expired: false, result: null };
  if (row.status === "failed") return { outcome: "failed", expired: false, result: null };
  if (row.status === "success" && row.result !== null && validateSubjectAnalysis(row.result)) {
    // 结果过期口径：success 但 analyzed_at 为空，无法证明新鲜度，计入过期（仍计入成功）。
    return { outcome: "success", expired: row.analyzed_at == null, result: row.result };
  }
  // success 标记但结果缺失/校验失败：不能当成成功，按失败计，不静默丢弃。
  return { outcome: "failed", expired: false, result: null };
}

function bannerOutcome(row: EmailContentAnalysisRow | undefined): EmailAnalysis["banner"] {
  if (!row) return { outcome: "missing", expired: false, result: null };
  if (row.status === "pending" || row.status === "processing") {
    return { outcome: "queued", expired: false, result: null };
  }
  if (row.status === "skipped") return { outcome: "skipped", expired: false, result: null };
  if (row.status === "failed") return { outcome: "failed", expired: false, result: null };
  if (row.status === "success" && row.result !== null && validateBannerAnalysis(row.result)) {
    return { outcome: "success", expired: row.analyzed_at == null, result: row.result };
  }
  return { outcome: "failed", expired: false, result: null };
}

/** 纯函数：标题分析聚合。分布类占比的分母是已分析（success）封数；缺失行不计入“无 CTA/零 Emoji”。 */
function aggregateSubjectAnalysis(results: SubjectAnalysis[]): SubjectSummary {
  const analyzedCount = results.length;
  if (analyzedCount === 0) {
    return {
      analyzedCount: 0,
      tactics: [],
      discountFramings: [],
      lengthStats: { avg: 0, min: 0, max: 0 },
      emojiStats: { avgCount: 0, withEmojiCount: 0, withEmojiRate: 0 },
      topCtaVerbs: [],
      personalizationRate: 0,
    };
  }

  const tacticCountMap = new Map<string, number>();
  const discountMap = new Map<string, number>();
  let minLength = Infinity;
  let maxLength = -Infinity;
  let totalLength = 0;
  let totalEmojis = 0;
  let withEmojiCount = 0;
  const verbCountMap = new Map<string, number>();
  let personalizationCount = 0;

  for (const s of results) {
    if (Array.isArray(s.tactics)) {
      for (const t of s.tactics) {
        const cleanT = t.trim().toLowerCase();
        if (cleanT) tacticCountMap.set(cleanT, (tacticCountMap.get(cleanT) ?? 0) + 1);
      }
    }
    if (s.discount_framing) {
      const framing = s.discount_framing.trim();
      if (framing) discountMap.set(framing, (discountMap.get(framing) ?? 0) + 1);
    }
    const len = typeof s.length_chars === "number" ? s.length_chars : 0;
    totalLength += len;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    const emojis = typeof s.emoji_count === "number" ? s.emoji_count : 0;
    totalEmojis += emojis;
    if (emojis > 0) withEmojiCount += 1;
    if (Array.isArray(s.cta_verbs)) {
      for (const v of s.cta_verbs) {
        const cleanVerb = v.trim().toLowerCase();
        if (cleanVerb) verbCountMap.set(cleanVerb, (verbCountMap.get(cleanVerb) ?? 0) + 1);
      }
    }
    if (s.personalization) personalizationCount += 1;
  }

  return {
    analyzedCount,
    tactics: Array.from(tacticCountMap.entries())
      .map(([key, count]) => ({
        key,
        label: TACTIC_LABEL_MAP[key] || key,
        count,
        percentage: Math.round((count / analyzedCount) * 100),
      }))
      .sort((a, b) => b.count - a.count),
    discountFramings: Array.from(discountMap.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count),
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

/**
 * 纯函数：Banner 视觉分析聚合。dominant_colors 口径是色族标签；
 * 渲染仍兼容旧 Hex（显示色块），色族显示文字标签，两者都计数；
 * 新校验已拒绝 Hex（见 validateBannerAnalysis），Hex 分支仅为历史数据兼容。
 */
function aggregateBannerAnalysis(results: BannerAnalysis[]): BannerSummary {
  const analyzedCount = results.length;
  if (analyzedCount === 0) {
    return {
      analyzedCount: 0,
      dominantColors: [],
      composition: [],
      ctaPresenceRate: 0,
      ctaPresenceCount: 0,
      ctaPositions: [],
      textImageRatio: [],
      seasonalCues: [],
    };
  }

  const colorMap = new Map<string, { hex: string | null; count: number }>();
  const compositionMap = new Map<string, number>();
  let ctaPresenceCount = 0;
  const positionMap = new Map<string, number>();
  const ratioMap = new Map<string, number>();
  const cueMap = new Map<string, number>();

  for (const b of results) {
    if (Array.isArray(b.dominant_colors)) {
      for (const raw of b.dominant_colors) {
        const value = raw.trim();
        if (!value) continue;
        if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) {
          const hex = value.toUpperCase();
          const prev = colorMap.get(hex) ?? { hex, count: 0 };
          prev.count += 1;
          colorMap.set(hex, prev);
        } else {
          const label = value.toLowerCase();
          const prev = colorMap.get(label) ?? { hex: null, count: 0 };
          prev.count += 1;
          colorMap.set(label, prev);
        }
      }
    }
    if (b.composition) {
      const comp = b.composition.trim().toLowerCase();
      if (comp) compositionMap.set(comp, (compositionMap.get(comp) ?? 0) + 1);
    }
    if (b.cta_presence) ctaPresenceCount += 1;
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

  const toMetric = (map: Map<string, number>, labels: Record<string, string>): MetricCount[] =>
    Array.from(map.entries())
      .map(([key, count]) => ({
        key,
        label: labels[key] || key,
        count,
        percentage: Math.round((count / analyzedCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

  return {
    analyzedCount,
    dominantColors: Array.from(colorMap.entries())
      .map(([label, { hex, count }]) => ({
        label,
        hex,
        count,
        percentage: Math.round((count / analyzedCount) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    composition: toMetric(compositionMap, COMPOSITION_LABEL_MAP),
    ctaPresenceRate: Math.round((ctaPresenceCount / analyzedCount) * 100),
    ctaPresenceCount,
    ctaPositions: toMetric(positionMap, CTA_POSITION_LABEL_MAP),
    textImageRatio: toMetric(ratioMap, RATIO_LABEL_MAP),
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
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--text-body)] truncate" title={label}>
          {label}
        </span>
        <span className="tabular-nums text-[var(--text-secondary)] shrink-0 ml-2">
          {count} 封 ({percentage}%)
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label} 占比`}
      >
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
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
  const pct = (n: number) => (sample > 0 ? `${Math.round((n / sample) * 100)}%` : "—");
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-[var(--text-heading)]">{label}</p>
      <p className="text-[var(--text-secondary)]">
        成功 {counts.success} 封 ({pct(counts.success)}) · 排队中 {counts.queued} 封 (
        {pct(counts.queued)}) · 失败 {counts.failed} 封 ({pct(counts.failed)}) · 未采集{" "}
        {counts.missing} 封 ({pct(counts.missing)}) · 已跳过 {counts.skipped} 封 (
        {pct(counts.skipped)})
      </p>
      <p className="text-[var(--text-secondary)]">
        其中结果过期（成功但无分析时间）{counts.expired} 封
        {extra ? ` · ${extra}` : ""}
      </p>
    </div>
  );
}

export function ContentAnalysis({ site, window: dateWindow }: ContentAnalysisProps) {
  const [period, setPeriod] = useState<AnalysisPeriod>("threeWeeks");
  const [brand, setBrand] = useState<string | null>(null);
  // 当前周期窗口：三周用调用方传入的 THREE_WEEK_WINDOW；三个月用数据窗口。
  const activeWindow =
    period === "threeWeeks"
      ? dateWindow
      : { start: EXTENDED_EMAIL_META.windowStart, end: EXTENDED_EMAIL_META.windowEnd };
  const [emails, setEmails] = useState<WindowEmail[] | null>(null);
  const [analysisRows, setAnalysisRows] = useState<EmailContentAnalysisRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notEnabledDetail, setNotEnabledDetail] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  useEffect(() => {
    if (site === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotEnabledDetail(null);

    (async () => {
      const [emailsResult, analysisResult] = await Promise.allSettled([
        withTimeout(fetchEmailDataset(), REQUEST_TIMEOUT_MS, "邮件"),
        withTimeout(
          fetchContentAnalysis({ market: site, start: activeWindow.start, end: activeWindow.end, signal: controller.signal }),
          REQUEST_TIMEOUT_MS,
          "内容分析",
        ),
      ]);
      // 取消后不回写状态（AbortController 已触发或组件已卸载）。
      if (cancelled || controller.signal.aborted) return;

      if (emailsResult.status === "rejected" && isNotEnabledError(emailsResult.reason)) {
        setNotEnabledDetail(`emails 表缺少 subject / preheader / banner_url 列，迁移尚未执行：${String(emailsResult.reason)}`);
        setLoading(false);
        return;
      }
      if (analysisResult.status === "rejected" && isNotEnabledError(analysisResult.reason)) {
        setNotEnabledDetail(
          `内容分析视图 email_content_analysis_current 不存在或未迁移：${String(analysisResult.reason)}`,
        );
        setLoading(false);
        return;
      }
      if (emailsResult.status === "rejected") {
        setError(emailsResult.reason instanceof Error ? emailsResult.reason.message : String(emailsResult.reason));
        setLoading(false);
        return;
      }
      if (analysisResult.status === "rejected") {
        setError(analysisResult.reason instanceof Error ? analysisResult.reason.message : String(analysisResult.reason));
        setLoading(false);
        return;
      }

      const rows = emailsResult.value.rows.filter(
        (row) => row.market === site && row.sent_date >= activeWindow.start && row.sent_date <= activeWindow.end,
      );
      setEmails(
        rows.map((row) => ({
          market: row.market,
          brand: row.brand,
          sent_date: row.sent_date,
          day_seq: row.day_seq,
          subject: asNullableText(row.subject),
          preheader: asNullableText(row.preheader),
          banner_url: asNullableText(row.banner_url),
        })),
      );
      setAnalysisRows(
        analysisResult.value.filter(
          (row) => row.market === site && row.sent_date >= activeWindow.start && row.sent_date <= activeWindow.end,
        ),
      );
      setLoading(false);
    })().catch((err) => {
      if (!cancelled && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [site, activeWindow.start, activeWindow.end, retryKey]);

  // 品牌筛选：选项来自当前市场+窗口的 emails 样本；选中的品牌不在样本中时回落全部品牌。
  const brandOptions = useMemo(() => {
    if (emails === null) return [];
    return [...new Set(emails.map((e) => e.brand))].sort();
  }, [emails]);
  const activeBrand = brand !== null && brandOptions.includes(brand) ? brand : null;

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
    const visibleEmails = activeBrand === null ? emails : emails.filter((e) => e.brand === activeBrand);
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
  }, [emails, analysisRows, activeBrand]);

  const coverage = useMemo<Coverage | null>(() => {
    if (joined === null) return null;
    const sample = joined.length;
    let collected = 0;
    let withSubject = 0;
    let withPreheader = 0;
    let withBanner = 0;
    const subject: Coverage["subject"] = { success: 0, queued: 0, failed: 0, missing: 0, skipped: 0, expired: 0 };
    const banner: Coverage["banner"] = { success: 0, queued: 0, failed: 0, missing: 0, skipped: 0, expired: 0 };
    for (const { email, analysis } of joined) {
      if (email.subject !== null || email.preheader !== null || email.banner_url !== null) collected += 1;
      if (email.subject !== null) withSubject += 1;
      if (email.preheader !== null) withPreheader += 1;
      if (email.banner_url !== null) withBanner += 1;
      subject[analysis.subject.outcome] += 1;
      banner[analysis.banner.outcome] += 1;
      if (analysis.subject.expired) subject.expired += 1;
      if (analysis.banner.expired) banner.expired += 1;
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
        withBanner > 0 ? Math.round((banner.success / withBanner) * 100) : null,
    };
  }, [joined]);

  const subjectSummary = useMemo(() => {
    if (!joined) return null;
    return aggregateSubjectAnalysis(
      joined.map((j) => j.analysis.subject.result).filter((r): r is SubjectAnalysis => r !== null),
    );
  }, [joined]);

  const bannerSummary = useMemo(() => {
    if (!joined) return null;
    return aggregateBannerAnalysis(
      joined.map((j) => j.analysis.banner.result).filter((r): r is BannerAnalysis => r !== null),
    );
  }, [joined]);

  // 周期切换（与词云同款式）：默认三周，可切三个月（数据窗口）。
  const periodToggle = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold text-[var(--text-control)]">时间范围</span>
      <div
        role="group"
        aria-label="选择内容分析统计周期"
        className="grid grid-cols-2 rounded-full border border-[var(--border-wordcloud-control)] bg-[var(--surface-raised)] p-1"
      >
        {([
          ["threeWeeks", "三周"],
          ["threeMonths", "三个月"],
        ] as const).map(([value, label]) => {
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
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // 品牌筛选：默认全部品牌；选项随当前市场+窗口样本变化。
  const brandSelect =
    brandOptions.length > 0 ? (
      <label className="flex flex-wrap items-center gap-3 text-sm font-bold text-[var(--text-control)]">
        品牌
        <select
          aria-label="选择品牌"
          value={activeBrand ?? ""}
          onChange={(e) => setBrand(e.target.value === "" ? null : e.target.value)}
          className="min-h-10 rounded-full border border-[var(--border-wordcloud-control)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-bold text-[var(--text-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-control)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
        >
          <option value="">全部品牌</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  // 0. 未选单个市场：覆盖率分母是同市场样本，多市场聚合无意义，提示选市场而非报错。
  if (site === null) {
    return (
      <div
        className="flex min-h-[12rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-8 text-center shadow-xs"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-base font-semibold text-[var(--text-heading)]">请选择单个市场查看内容 AI 分析</h3>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
          覆盖率按同市场同窗口的 emails 样本计算；当前为全部市场视图，请先在顶部站点选择器选一个市场。
        </p>
      </div>
    );
  }

  // 1. 加载中状态
  if (loading) {
    return (
      <div
        className="flex min-h-[18rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-8 text-center shadow-xs"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-[var(--text-body)]">
          正在加载 {site} 市场内容 AI 分析数据...
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          窗口范围：{activeWindow.start} 至 {activeWindow.end}
        </p>
      </div>
    );
  }

  // 2. 未启用/未迁移状态（与网络失败区分：不展示为报错）
  if (notEnabledDetail !== null) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <h3 className="text-base font-semibold">内容 AI 分析尚未启用</h3>
        <p className="mt-2 text-xs leading-relaxed opacity-90 break-words">
          {notEnabledDetail}完成迁移后刷新即可查看；已有原始内容仍按未采集计入覆盖率。
        </p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-800 transition"
        >
          重新尝试
        </button>
      </div>
    );
  }

  // 3. 错误状态（请求失败重试）
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        <h3 className="text-base font-semibold">内容 AI 分析数据拉取失败</h3>
        <p className="mt-2 text-xs leading-relaxed opacity-90 break-words">{error}</p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-800 transition"
        >
          重新尝试
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
            日期窗口：{activeWindow.start} ~ {activeWindow.end}
          </span>
        </div>
        <EmptyState
          title="窗口内无邮件"
          description={`市场 ${site} 在所选日期窗口（${activeWindow.start} ~ ${activeWindow.end}）内暂无邮件样本，无法计算覆盖率。`}
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
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            市场：{site}
          </span>
          {activeBrand !== null && (
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              品牌：{activeBrand}
            </span>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            日期窗口：{activeWindow.start} ~ {activeWindow.end}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            （同市场同窗口{activeBrand !== null ? "同品牌" : ""} emails 样本：{totalEmails} 封）
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {periodToggle}
          {brandSelect}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span>
            采集覆盖：
            <strong className="text-[var(--text-heading)]">{coverage.collectionRate}%</strong>
          </span>
          <span className="text-[var(--border-default)]">|</span>
          <span>
            标题成功：
            <strong className="text-[var(--text-heading)]">{coverage.subjectSuccessRate}%</strong>
          </span>
          <span className="text-[var(--border-default)]">|</span>
          <span>
            Banner 成功：
            <strong className="text-[var(--text-heading)]">{coverage.bannerSuccessRate}%</strong>
          </span>
        </div>
      </div>

      {/* 覆盖率：三个率分开显示，分母统一为 emails 样本数；缺失不算成“无 CTA”“零 Emoji”。 */}
      <Card
        title="覆盖率"
        hint={`分母统一为同市场同窗口 emails 样本 ${totalEmails} 封；标题/Banner 分布占比的分母是各自已分析封数，缺失行不计入分布。`}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatPill
              title="采集覆盖率"
              value={`${coverage.collectionRate}%`}
              subtext={`${coverage.collected} / ${totalEmails} 封已采集任一原始内容`}
            />
            <StatPill
              title="标题成功率"
              value={`${coverage.subjectSuccessRate}%`}
              subtext={`${coverage.subject.success} / ${totalEmails} 封标题分析成功`}
            />
            <StatPill
              title="Banner 成功率"
              value={`${coverage.bannerSuccessRate}%`}
              subtext={`${coverage.banner.success} / ${totalEmails} 封 Banner 分析成功`}
            />
          </div>
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)]">
              原始内容采集：有标题 {coverage.withSubject} 封 · 有副标题 {coverage.withPreheader} 封 ·
              有 Banner 图 {coverage.withBanner} 封 · 无任一原始内容 {totalEmails - coverage.collected} 封
              （未采集的邮件不进入分析，标题成功率也不把它们算成“无 CTA”）。
            </p>
            <OutcomeBreakdown label="标题分析状态" counts={coverage.subject} sample={totalEmails} />
            <OutcomeBreakdown
              label="Banner 分析状态"
              counts={coverage.banner}
              sample={totalEmails}
              extra={`无 Banner 图 ${totalEmails - coverage.withBanner} 封${
                coverage.bannerSuccessRateAmongWithBanner !== null
                  ? ` · 在有 Banner 图的邮件中成功率 ${coverage.bannerSuccessRateAmongWithBanner}%`
                  : ""
              }`}
            />
          </div>
        </div>
      </Card>

      {/* 两大核心板块 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ================= (a) 主副标题分析 ================= */}
        <Card
          title="主副标题策略分析"
          hint={`已分析 ${subjectSummary?.analyzedCount ?? 0} 封（分布占比按已分析计） · 未采集/排队/失败见覆盖率`}
        >
          {subjectSummary && subjectSummary.analyzedCount > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatPill
                  title="标题平均字符"
                  value={subjectSummary.lengthStats.avg}
                  subtext={`范围 ${subjectSummary.lengthStats.min} ~ ${subjectSummary.lengthStats.max}`}
                />
                <StatPill
                  title="平均 Emoji"
                  value={subjectSummary.emojiStats.avgCount}
                  subtext={`含 Emoji 占比 ${subjectSummary.emojiStats.withEmojiRate}%`}
                />
                <StatPill
                  title="个性化元素"
                  value={`${subjectSummary.personalizationRate}%`}
                  subtext="强信号：模板变量/为你定制"
                />
                <StatPill
                  title="含 Emoji 封数"
                  value={subjectSummary.emojiStats.withEmojiCount}
                  subtext={`共 ${subjectSummary.analyzedCount} 封已分析样本`}
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  标题策略分布 (Tactics)
                </h3>
                {subjectSummary.tactics.length > 0 ? (
                  <div className="space-y-3">
                    {subjectSummary.tactics.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={item.label}
                        count={item.count}
                        percentage={item.percentage}
                        total={subjectSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    暂未标记任何策略标签
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  CTA 高频动词 Top
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
                    已分析样本中无提取到的行动召唤动词（未分析行不计入）
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  折扣促销话术 (去重收录)
                </h3>
                {subjectSummary.discountFramings.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                    {subjectSummary.discountFramings.map(({ text, count }) => (
                      <span
                        key={text}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-200"
                        title={`出现 ${count} 次`}
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
                    已分析样本中未检测到明确的折扣短语
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              该窗口内 {totalEmails} 封邮件尚无标题分析成功结果（成功 0 封；排队/失败/未采集见上方覆盖率）。
            </div>
          )}
        </Card>

        {/* ================= (b) Banner 视觉分析 ================= */}
        <Card
          title="Banner 视觉风格分析"
          hint={`已分析 ${bannerSummary?.analyzedCount ?? 0} 封（分布占比按已分析计） · 未采集/排队/失败见覆盖率`}
        >
          {bannerSummary && bannerSummary.analyzedCount > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <StatPill
                  title="Banner CTA 包含率（视觉）"
                  value={`${bannerSummary.ctaPresenceRate}%`}
                  subtext={`共 ${bannerSummary.ctaPresenceCount} / ${bannerSummary.analyzedCount} 封已分析；仅指视觉可见按钮，不代表可点击`}
                />
                <StatPill
                  title="识别主色族种类"
                  value={bannerSummary.dominantColors.length}
                  subtext="色族标签按频次降序 Top（模型不直接编 Hex）"
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  视觉主色族分布 (Dominant Colors)
                </h3>
                {bannerSummary.dominantColors.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {bannerSummary.dominantColors.map(({ label, hex, count, percentage }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-1.5"
                      >
                        {hex ? (
                          <span
                            className="h-6 w-6 shrink-0 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: hex }}
                            aria-label={`颜色 ${hex}`}
                          />
                        ) : (
                          <span
                            className="h-6 w-6 shrink-0 rounded-md border border-slate-300 bg-[var(--surface-card)] text-center text-[10px] leading-6 text-[var(--text-secondary)]"
                            aria-hidden="true"
                          >
                            色
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono font-medium text-[var(--text-heading)] truncate">
                            {hex ?? label}
                          </p>
                          <p className="text-[10px] tabular-nums text-[var(--text-secondary)]">
                            {count}次 ({percentage}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    暂无色彩提取数据
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  构图风格分布 (Composition)
                </h3>
                {bannerSummary.composition.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.composition.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={item.label}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    暂无构图风格标签
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  图文比例分布 (Text-Image Ratio)
                </h3>
                {bannerSummary.textImageRatio.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.textImageRatio.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={item.label}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    暂无图文比例数据
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                  CTA 引导位置分布（视觉位置）
                </h3>
                {bannerSummary.ctaPositions.length > 0 ? (
                  <div className="space-y-3">
                    {bannerSummary.ctaPositions.map((item) => (
                      <HorizontalProgressBar
                        key={item.key}
                        label={item.label}
                        count={item.count}
                        percentage={item.percentage}
                        total={bannerSummary.analyzedCount}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic">
                    暂无 CTA 位置数据
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5">
                  季节与节日氛围 (Seasonal Cues)
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
                    已分析样本中无可见季节/节日氛围标签（标题里的季节词不计入）
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              该窗口内 {totalEmails} 封邮件尚无 Banner 视觉分析成功结果（成功 0 封；排队/失败/未采集/无 Banner 见上方覆盖率）。
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default ContentAnalysis;
