#!/usr/bin/env node
/**
 * @file analyze-email-content.mjs
 * @description 邮件“内容 AI 分析”离线批量 pipeline（只写 email_content_analysis）。
 *
 * 用法：
 *   node scripts/analyze-email-content.mjs --dry-run
 *   node scripts/analyze-email-content.mjs --start 2026-09-26 --end 2026-10-17
 *   node scripts/analyze-email-content.mjs --market UK --retry-failed
 *   node scripts/analyze-email-content.mjs --force --concurrency 2 --max-tokens 100000
 *
 * 行为：
 * - 只处理新增 / 变化 / 明确重跑（--force / --retry-failed）的项目；
 *   input_hash 未变的 success 行直接跳过，失败重跑不覆盖上次可用结果。
 * - 标题：文本模型（结构化输出）+ 确定性规则合并；
 *   length_chars / emoji_count 以确定性规则为准，模型结果只补 tactics 等。
 * - Banner：vision 模型，必须传入实际图片字节（Storage object key 下载，
 *   无 object key 时取 banner_source_url 的字节；绝不只把 URL 写进 prompt）。
 * - 写库前校验（枚举、dominant_colors 色族枚举、数组去重、cta 约束）；校验失败记 failed。
 *   色族口径与 Pi 的 src/banner-vision-prompt.ts 一致：模型只输出色族标签，
 *   绝不编 #RRGGBB Hex；本 pipeline 没有图像算法取色路径（仅解析图片尺寸），
 *   颜色唯一来源是模型输出 + 色族校验/归一化。
 * - 并发 + token 配额 + 退避重试 + 超时 + 重试上限 + 预算告警（80% 警告，100% 停）。
 * - --dry-run：纯离线合成数据验证，不联网、不调模型、不写库。
 *
 * 三周窗口：唯一来源是 src/three-week-aggregation.ts 的 THREE_WEEK_WINDOW；
 * 未传 --start/--end 时从该文件解析，不在本文件再定义第二个窗口。
 *
 * 密钥：只读环境变量，绝不硬编码、绝不进 VITE_*。
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（写库 + 读基表 + Storage 下载）
 *   CONTENT_ANALYSIS_API_BASE_URL / CONTENT_ANALYSIS_API_KEY（OpenAI 兼容接口）
 *   CONTENT_ANALYSIS_TEXT_MODEL / CONTENT_ANALYSIS_VISION_MODEL
 *   可选：SUPABASE_BANNER_BUCKET（默认 email-banners）、
 *   CONTENT_ANALYSIS_PROMPT_VERSION / RULES_VERSION / SCHEMA_VERSION
 *
 * 注意：service_role 写库时同时发 apikey + Authorization Bearer 头，这是
 * Supabase PostgREST 要求 service_role 绕过 RLS 的标准做法；“公开 Key 不放
 * Bearer”指的是前端 anon 读取（见 src/email-content-analysis.ts）。
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

// ---- 版本（与 SQL / TS 契约一致；可用环境变量覆盖 prompt/rules/schema） ----
// 注意：subject 口径已升 v2（新增 trend_terms 抽取），跑 subject 时应以
// CONTENT_ANALYSIS_PROMPT_VERSION=2 CONTENT_ANALYSIS_SCHEMA_VERSION=2 运行；
// banner 仍为 v1。常驻补跑脚本 supabase-import/analyze-pending.mjs 内置同样的版本划分。
const SCHEMA_VERSION = process.env.CONTENT_ANALYSIS_SCHEMA_VERSION ?? "1";
const RULES_VERSION = process.env.CONTENT_ANALYSIS_RULES_VERSION ?? "1";
const PROMPT_VERSION = process.env.CONTENT_ANALYSIS_PROMPT_VERSION ?? "1";

// ---- 默认值 ----
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_BUDGET_WARN_RATIO = 0.8;
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BANNER_BUCKET = process.env.SUPABASE_BANNER_BUCKET ?? "email-banners";

// ---- 枚举（与 src/email-content-analysis.ts 校验一致） ----
const BANNER_COMPOSITIONS = new Set(["centered", "left-aligned", "split-layout", "full-bleed", "grid"]);
const BANNER_CTA_POSITIONS = new Set(["top", "center", "bottom", "bottom-right"]);
const BANNER_TEXT_IMAGE_RATIOS = new Set(["text-heavy", "balanced", "image-heavy"]);
// 主色色族枚举（与 Pi 的 src/banner-vision-prompt.ts COLOR_FAMILIES 一致）。
// 模型只输出色族标签，绝不编 Hex；Hex 由图像算法提取并归一成色族（本 pipeline
// 无取色算法，颜色唯一来源是模型输出 + 此处校验/归一化）。
const COLOR_FAMILIES = new Set(["red", "orange", "yellow", "green", "teal", "blue", "navy", "purple", "pink", "brown", "beige", "gold", "black", "white", "gray", "cream"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Prompt（与 Pi 的 src/banner-vision-prompt.ts 口径一致；模型必须只输出 JSON） ----
const SUBJECT_PROMPT = `You are an expert email marketing (EDM) subject-line analyst.
Analyze the email subject line and preheader. Output ONLY a valid JSON object, no Markdown fences, no extra text.
Schema: {"tactics": string[] (subset of: urgency, discount, social_proof, newness, curiosity, personalization, other), "discount_framing": string | null (e.g. "40% off", "Free Shipping", "BOGO", or null), "length_chars": number (character count of the subject line), "emoji_count": number, "cta_verbs": string[] (lowercase CTA verbs like shop, discover, save), "personalization": boolean, "trend_terms": array of {"term": string, "category": string} — extract up to 8 words or short phrases from the subject/preheader that carry fashion, trend, hotspot, seasonal or marketing-event meaning. category is one of: fashion (garments, fabrics, styles, aesthetics), trend (emerging styles, viral aesthetics, social-media trends), hotspot (celebrities, pop culture, viral moments, trending topics), seasonal (seasons, weather, holidays, seasonal events), marketing (campaign or event hooks such as member days or anniversary events). Use the phrase as it appears in the text. Do NOT include generic discount words (sale, % off, save), CTA verbs, or brand names. Use [] when there are none.}`;

const BANNER_PROMPT = `You are an expert marketing creative analyst specializing in email marketing (EDM) banner design.
Analyze the provided email banner image. Output ONLY a valid JSON object, no Markdown fences, no extra text.
Rules: dominant_colors must be color FAMILY labels from the allowed list only (red, orange, yellow, green, teal, blue, navy, purple, pink, brown, beige, gold, black, white, gray, cream). NEVER output hex codes — you must not invent hex values.
Schema: {"dominant_colors": string[] (up to 5 color-family labels, e.g. ["white", "red", "black"]), "composition": string (one of: centered, left-aligned, split-layout, full-bleed, grid), "cta_presence": boolean, "cta_position": string | null (one of: top, center, bottom, bottom-right; null when cta_presence is false), "text_image_ratio": string (one of: text-heavy, balanced, image-heavy), "seasonal_cues": string[] (e.g. summer, holiday; [] if none)}`;

// ---- 确定性规则（与 src/content-analysis-rules.ts 口径一致；本文件为 .mjs，无法 import TS，故此处同步一份；改规则时两处一起改） ----
const TACTIC_KEYWORDS = {
  urgency: ["last chance", "final hours", "ends tonight", "ending soon", "limited time", "don't miss", "expires", "running out", "today only", "almost gone", "now or never", "clock is ticking", "few hours left", "hurry", "won't last"],
  discount: ["% off", "percent off", "sale", "save", "clearance", "discount", "bogo", "free shipping", "free delivery", "promo", "voucher", "coupon", "special offer", "markdown", "price drop", "$ off", "£ off", "€ off", "deal", "doorbuster"],
  social_proof: ["bestseller", "best-seller", "trending", "top rated", "customer favorite", "most loved", "viral", "fan favorite", "popular", "5-star", "back in stock", "everyone is loving", "restocked", "community favorite"],
  newness: ["just dropped", "introducing", "arrived", "unveiling", "fresh", "latest", "launch", "meet the", "first look", "brand new", "new collection", "new arrival", "new in"],
  curiosity: ["secret", "reveal", "guess what", "inside", "sneak peek", "unlock", "you won't believe", "open to see", "surprise", "what's inside", "spotted", "hint"],
  personalization: ["for you", "picked for you", "handpicked", "exclusive", "just for you", "vip", "member exclusive", "your style", "custom for you", "made for you"],
};
const CTA_VERBS = ["shop", "get", "claim", "discover", "explore", "save", "grab", "find", "buy", "see", "check out", "upgrade", "unlock", "join", "enjoy", "view", "start", "take", "treat", "order"];

function countEmoji(text) {
  if (!text) return 0;
  // 与 src/content-analysis-rules.ts 同口径：按字形簇计数。
  // 家庭 Emoji 👨‍👩‍👧‍👦 = 1 簇计 1；国旗 🇫🇷 = 1 簇计 1；带肤色修饰符计 1。
  // 旧实现 /\p{Extended_Pictographic}/gu 会把家庭计 4、国旗计 0，已修复。
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    let count = 0;
    for (const { segment } of segmenter.segment(text)) {
      if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(segment)) count += 1;
    }
    return count;
  }
  const matches = text.match(
    /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u20E3)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u20E3)?)*/gu,
  );
  return matches ? matches.length : 0;
}

function detectTactics(subject, preheader) {
  const combined = `${subject ?? ""} ${preheader ?? ""}`.toLowerCase();
  if (!combined.trim()) return [];
  const out = [];
  for (const [tactic, keywords] of Object.entries(TACTIC_KEYWORDS)) {
    // 与 TS 一致：含空格/符号的短语用 includes，单词用 \b 边界匹配
    // （避免 "wholesale" 误命中 "sale" 这类包含式误报）。
    const hit = keywords.some((kw) => {
      if (kw.includes(" ") || kw.includes("%") || kw.includes("$") || kw.includes("£") || kw.includes("€") || kw.includes("-")) {
        return combined.includes(kw);
      }
      return new RegExp(`\\b${kw}\\b`, "i").test(combined);
    });
    if (hit) out.push(tactic);
  }
  return out;
}

function detectDiscountFraming(subject, preheader) {
  const combined = `${subject ?? ""} ${preheader ?? ""}`.trim();
  if (!combined) return null;
  const extra = combined.match(/\bextra\s+\d{1,3}%\s*off\b/i);
  if (extra) return extra[0].trim();
  const upTo = combined.match(/\bup\s+to\s+\d{1,3}%\s*off\b/i);
  if (upTo) return upTo[0].trim();
  const pct = combined.match(/\b\d{1,3}%\s*off\b/i);
  if (pct) return pct[0].trim();
  // Save 分支：不要在 % 后用 \b 收尾（% 是非单词字符，\b 会回退导致
  // "Save 20%" 被截成 "Save 20"）；用整段匹配直接返回，保留 %。
  const save = combined.match(/\bsave\s+[$£€]?\d+(?:\.\d{1,2})?%?(?:\s+off)?/i);
  if (save) return save[0].trim();
  const off = combined.match(/[$£€]\d+(\.\d{2})?\s*off\b/i);
  if (off) return off[0].trim();
  if (/\b(bogo|buy\s+\d+\s+get\s+\d+|buy\s+one\s+get\s+one)\b/i.test(combined)) return "BOGO";
  if (/\bfree\s+(shipping|delivery)\b/i.test(combined)) return "Free Shipping";
  if (/\b(sitewide|storewide)\b/i.test(combined)) return "Sitewide Sale";
  return null;
}

function extractCtaVerbs(text) {
  if (!text) return [];
  return CTA_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`, "i").test(text))
    .map((v) => v.toLowerCase());
}

function detectPersonalization(text) {
  if (!text) return false;
  // 保守口径（与 TS 一致）：只认模板变量 + 强个性化短语。
  // 旧实现把裸 you/your/yours/you're 都算个性化，会把几乎所有标题标成
  // 个性化，失去区分度，已修复。
  if (/\{[a-z0-9_.]+\}|\[[a-z0-9_.]+\]|%[a-z0-9_.]+%|\{\{[a-z0-9_.]+\}\}/i.test(text)) return true;
  return /\b(just for you|picked for you|curated for you|handpicked for you|exclusive for you|chosen for you|selected for you|tailored for you|recommended for you|made for you|for your eyes only)\b/i.test(text);
}

function analyzeSubjectRules(subject, preheader) {
  const cleanSubject = subject ? subject.trim() : "";
  const combined = `${cleanSubject} ${preheader ? preheader.trim() : ""}`.trim();
  return {
    tactics: detectTactics(cleanSubject, preheader),
    discount_framing: detectDiscountFraming(cleanSubject, preheader),
    length_chars: cleanSubject.length,
    emoji_count: countEmoji(combined),
    cta_verbs: extractCtaVerbs(combined),
    personalization: detectPersonalization(combined),
  };
}

// ---- 通用工具 ----
function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function dedupe(values) {
  return [...new Set(values)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const args = { market: [], force: false, retryFailed: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`参数 ${a} 缺少取值。`);
      i += 1;
      return v;
    };
    if (a === "--start") args.start = next();
    else if (a === "--end") args.end = next();
    else if (a === "--market") args.market.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--concurrency") args.concurrency = Number(next());
    else if (a === "--max-tokens") args.maxTokens = Number(next());
    else if (a === "--timeout-ms") args.timeoutMs = Number(next());
    else if (a === "--max-attempts") args.maxAttempts = Number(next());
    else if (a === "--limit") args.limit = Number(next());
    else if (a === "--batch-id") args.batchId = next();
    else if (a === "--force") args.force = true;
    else if (a === "--retry-failed") args.retryFailed = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  return args;
}

function usage() {
  return `用法：
  node scripts/analyze-email-content.mjs --dry-run
  node scripts/analyze-email-content.mjs [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--market US,UK] [--force | --retry-failed] [--concurrency N] [--max-tokens N] [--timeout-ms N] [--max-attempts N] [--limit N] [--batch-id ID]
未传 --start/--end 时，从 src/three-week-aggregation.ts 的 THREE_WEEK_WINDOW 解析（唯一来源）。`;
}

/** 从 src/three-week-aggregation.ts 解析 THREE_WEEK_WINDOW（不另定义窗口）。 */
async function resolveDefaultWindow() {
  const text = await readFile(join(REPO_ROOT, "src", "three-week-aggregation.ts"), "utf8");
  const m = /THREE_WEEK_WINDOW[^=]*=\s*\{\s*start:\s*"(\d{4}-\d{2}-\d{2})"\s*,\s*end:\s*"(\d{4}-\d{2}-\d{2})"/.exec(text);
  if (!m) throw new Error("无法从 src/three-week-aggregation.ts 解析 THREE_WEEK_WINDOW，请显式传 --start/--end。");
  return { start: m[1], end: m[2] };
}

// ---- 写库前校验（与 src/email-content-analysis.ts 的校验函数同一口径） ----
const TREND_CATEGORIES = new Set(["fashion", "trend", "hotspot", "seasonal", "marketing"]);
function sanitizeTrendTerms(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const term = typeof item.term === "string" ? item.term.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
    if (!term || term.length > 40 || !TREND_CATEGORIES.has(category)) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term, category });
    if (out.length >= 8) break;
  }
  return out;
}
function validateSubject(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "result 不是对象";
  const strArr = (x) => Array.isArray(x) && x.every((i) => typeof i === "string" && i.length > 0);
  const dup = (x) => Array.isArray(x) && new Set(x).size !== x.length;
  if (!strArr(v.tactics) || dup(v.tactics)) return "tactics 无效（非字符串数组或有重复）";
  if (!(v.discount_framing === null || typeof v.discount_framing === "string")) return "discount_framing 无效";
  if (!Number.isSafeInteger(v.length_chars) || v.length_chars < 0) return "length_chars 无效";
  if (!Number.isSafeInteger(v.emoji_count) || v.emoji_count < 0) return "emoji_count 无效";
  if (!strArr(v.cta_verbs) || dup(v.cta_verbs)) return "cta_verbs 无效（非字符串数组或有重复）";
  if (typeof v.personalization !== "boolean") return "personalization 无效";
  if (!Array.isArray(v.trend_terms)) return "trend_terms 无效";
  const seenTerms = new Set();
  for (const item of v.trend_terms) {
    if (!item || typeof item !== "object" || typeof item.term !== "string" || !item.term || !TREND_CATEGORIES.has(item.category)) return "trend_terms 元素无效";
    const k = item.term.toLowerCase();
    if (seenTerms.has(k)) return "trend_terms 有重复";
    seenTerms.add(k);
  }
  return null;
}

function validateBanner(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "result 不是对象";
  if (!Array.isArray(v.dominant_colors) || v.dominant_colors.length > 5 || !v.dominant_colors.every((c) => typeof c === "string" && COLOR_FAMILIES.has(c.toLowerCase()))) return "dominant_colors 无效（需为色族枚举，最多 5 项；Hex 已拒绝）";
  if (new Set(v.dominant_colors.map((c) => c.toLowerCase())).size !== v.dominant_colors.length) return "dominant_colors 有重复";
  if (typeof v.composition !== "string" || !BANNER_COMPOSITIONS.has(v.composition)) return `composition 不在枚举内：${String(v.composition)}`;
  if (typeof v.cta_presence !== "boolean") return "cta_presence 无效";
  if (v.cta_position !== null && (typeof v.cta_position !== "string" || !BANNER_CTA_POSITIONS.has(v.cta_position))) return `cta_position 不在枚举内：${String(v.cta_position)}`;
  if (v.cta_presence === false && v.cta_position !== null) return "cta_presence=false 时 cta_position 必须为 null";
  if (typeof v.text_image_ratio !== "string" || !BANNER_TEXT_IMAGE_RATIOS.has(v.text_image_ratio)) return `text_image_ratio 不在枚举内：${String(v.text_image_ratio)}`;
  if (!Array.isArray(v.seasonal_cues) || !v.seasonal_cues.every((s) => typeof s === "string" && s.length > 0)) return "seasonal_cues 无效";
  if (new Set(v.seasonal_cues).size !== v.seasonal_cues.length) return "seasonal_cues 有重复";
  return null;
}

/** 归一化：数组去重、颜色统一大写并截到 5 个、cta 约束强制。 */
function normalizeSubject(v) {
  return {
    tactics: dedupe(v.tactics),
    discount_framing: v.discount_framing,
    length_chars: v.length_chars,
    emoji_count: v.emoji_count,
    cta_verbs: dedupe(v.cta_verbs),
    personalization: v.personalization,
    trend_terms: sanitizeTrendTerms(v.trend_terms),
  };
}

function normalizeBanner(v) {
  return {
    dominant_colors: dedupe(v.dominant_colors.map((c) => c.toLowerCase())).slice(0, 5),
    composition: v.composition,
    cta_presence: v.cta_presence,
    cta_position: v.cta_presence ? v.cta_position : null,
    text_image_ratio: v.text_image_ratio,
    seasonal_cues: dedupe(v.seasonal_cues),
  };
}

// ---- 模型客户端（OpenAI 兼容接口，结构化输出 JSON Schema） ----
const SUBJECT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tactics", "discount_framing", "length_chars", "emoji_count", "cta_verbs", "personalization", "trend_terms"],
  properties: {
    tactics: { type: "array", items: { type: "string" } },
    discount_framing: { type: ["string", "null"] },
    length_chars: { type: "integer", minimum: 0 },
    emoji_count: { type: "integer", minimum: 0 },
    cta_verbs: { type: "array", items: { type: "string" } },
    personalization: { type: "boolean" },
    trend_terms: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "category"],
        properties: {
          term: { type: "string" },
          category: { type: "string", enum: ["fashion", "trend", "hotspot", "seasonal", "marketing"] },
        },
      },
    },
  },
};

const BANNER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dominant_colors", "composition", "cta_presence", "cta_position", "text_image_ratio", "seasonal_cues"],
  properties: {
    dominant_colors: { type: "array", maxItems: 5, items: { type: "string", enum: [...COLOR_FAMILIES] } },
    composition: { type: "string", enum: [...BANNER_COMPOSITIONS] },
    cta_presence: { type: "boolean" },
    cta_position: { type: ["string", "null"], enum: [...BANNER_CTA_POSITIONS, null] },
    text_image_ratio: { type: "string", enum: [...BANNER_TEXT_IMAGE_RATIOS] },
    seasonal_cues: { type: "array", items: { type: "string" } },
  },
};

function parseJsonLoose(text) {
  const cleaned = String(text ?? "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1].trim() : cleaned;
  return JSON.parse(candidate);
}

class ModelClient {
  constructor({ baseUrl, apiKey, timeoutMs, maxAttempts, budget }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.budget = budget;
    this.spentTokens = 0;
    this.warned = false;
  }

  estimateTokens(text) {
    return Math.ceil(String(text ?? "").length / 4);
  }

  checkBudget(estimated) {
    if (this.spentTokens + estimated > this.budget.maxTokens) {
      throw Object.assign(new Error("token 预算已用完，停止。"), { code: "budget_exceeded" });
    }
    if (!this.warned && this.spentTokens >= this.budget.maxTokens * DEFAULT_BUDGET_WARN_RATIO) {
      this.warned = true;
      console.warn(`[budget] token 已用 ${this.spentTokens}/${this.budget.maxTokens}（≥80%），请关注预算。`);
    }
  }

  async call({ model, messages, schemaName, schema }) {
    this.checkBudget(this.estimateTokens(JSON.stringify(messages)));
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0,
            response_format: {
              type: "json_schema",
              json_schema: { name: schemaName, strict: true, schema },
            },
          }),
          signal: controller.signal,
        });
        if (response.status === 429 || response.status >= 500) {
          const err = new Error(`模型请求失败（HTTP ${response.status}）`);
          err.code = response.status === 429 ? "model_rate_limited" : "model_error";
          err.retryable = true;
          throw err;
        }
        if (!response.ok) {
          const err = new Error(`模型请求失败（HTTP ${response.status}）`);
          err.code = "model_error";
          err.retryable = false;
          throw err;
        }
        const data = await response.json();
        const used = data?.usage?.total_tokens;
        this.spentTokens += Number.isSafeInteger(used) && used >= 0 ? used : this.estimateTokens(JSON.stringify(data));
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          const err = new Error("模型返回空内容");
          err.code = "model_error";
          err.retryable = false;
          throw err;
        }
        return parseJsonLoose(content);
      } catch (error) {
        lastError = error;
        const isTimeout = error?.name === "AbortError";
        if (isTimeout) {
          lastError = Object.assign(new Error(`模型请求超时（>${this.timeoutMs}ms）`), { code: "model_timeout", retryable: true });
        }
        const retryable = lastError.retryable === true || isTimeout;
        if (!retryable || attempt >= this.maxAttempts) break;
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        console.warn(`[retry] ${lastError.code ?? "model_error"}：${lastError.message}，${backoff}ms 后重试（${attempt}/${this.maxAttempts}）。`);
        await sleep(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}

// ---- Supabase REST（service_role 写；读基表最新行做跳过判断） ----
class SupabaseAdmin {
  constructor({ baseUrl, serviceRoleKey }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.serviceRoleKey = serviceRoleKey;
  }

  headers(extra = {}) {
    return { apikey: this.serviceRoleKey, Authorization: `Bearer ${this.serviceRoleKey}`, ...extra };
  }

  readExactTotal(response) {
    const total = response.headers.get("Content-Range")?.match(/\/(\d+)$/)?.[1];
    const parsed = total === undefined ? NaN : Number(total);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("响应缺少精确总数。");
    return parsed;
  }

  async fetchEmails({ start, end, markets }) {
    const rows = [];
    const singleMarket = markets.length === 1 ? markets[0] : null;
    // 先 HEAD 取精确总数，再分页拉全（绝不假设一次响应完整）。
    const buildUrl = (offset) => {
      const u = new URL(`${this.baseUrl}/rest/v1/emails`);
      u.searchParams.set("select", "market,brand,sent_date,day_seq,subject,preheader,banner_url");
      if (singleMarket) u.searchParams.append("market", `eq.${singleMarket}`);
      u.searchParams.append("sent_date", `gte.${start}`);
      u.searchParams.append("sent_date", `lte.${end}`);
      u.searchParams.set("order", "market.asc,brand.asc,sent_date.asc,day_seq.asc");
      u.searchParams.set("limit", String(DEFAULT_PAGE_SIZE));
      u.searchParams.set("offset", String(offset));
      return u;
    };
    const head = await fetch(buildUrl(0), { method: "HEAD", headers: this.headers({ Prefer: "count=exact" }) });
    if (!head.ok) throw new Error(`拉取 emails 失败（HTTP ${head.status}）。`);
    const total = this.readExactTotal(head);
    while (rows.length < total) {
      const res = await fetch(buildUrl(rows.length), { headers: this.headers({ Prefer: "count=exact" }) });
      if (!res.ok) throw new Error(`拉取 emails 失败（HTTP ${res.status}）。`);
      if (this.readExactTotal(res) !== total) throw new Error("emails 总数在加载期间发生变化，请重试。");
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) throw new Error(`emails 分页未取齐（已取 ${rows.length}/${total}）。`);
      rows.push(...page);
    }
    if (rows.length !== total) throw new Error("emails 条数与精确总数不一致。");
    const filtered = singleMarket ? rows : rows.filter((r) => markets.length === 0 || markets.includes(r.market));
    return filtered;
  }

  /** 基表最新行（按 key 取最新 created_at），供跳过判断与失败替换用。 */
  async fetchLatestAnalysis({ start, end, markets }) {
    const latest = new Map();
    let offset = 0;
    // 先取总数再分页；排序保证同一 key 的最新行先出现。
    const buildUrl = (off) => {
      const u = new URL(`${this.baseUrl}/rest/v1/email_content_analysis`);
      u.searchParams.set("select", "market,brand,sent_date,day_seq,analysis_type,status,input_hash");
      if (markets.length === 1) u.searchParams.append("market", `eq.${markets[0]}`);
      u.searchParams.append("sent_date", `gte.${start}`);
      u.searchParams.append("sent_date", `lte.${end}`);
      u.searchParams.set("order", "market.asc,brand.asc,sent_date.asc,day_seq.asc,analysis_type.asc,created_at.desc,id.desc");
      u.searchParams.set("limit", String(DEFAULT_PAGE_SIZE));
      u.searchParams.set("offset", String(off));
      return u;
    };
    const head = await fetch(buildUrl(0), { method: "HEAD", headers: this.headers({ Prefer: "count=exact" }) });
    if (!head.ok) throw new Error(`拉取分析现状失败（HTTP ${head.status}）。`);
    const total = this.readExactTotal(head);
    while (offset < total) {
      const res = await fetch(buildUrl(offset), { headers: this.headers({ Prefer: "count=exact" }) });
      if (!res.ok) throw new Error(`拉取分析现状失败（HTTP ${res.status}）。`);
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) throw new Error("分析现状分页未取齐。");
      for (const row of page) {
        const key = [row.market, row.brand, row.sent_date, row.day_seq, row.analysis_type].join("");
        if (!latest.has(key)) latest.set(key, row);
      }
      offset += page.length;
    }
    return latest;
  }

  /** Upsert：仅用于新行，或用 success 替换同 input_hash 的 failed/skipped 行。调用方已保证不覆盖 success 行。 */
  async upsertRow(row) {
    const u = new URL(`${this.baseUrl}/rest/v1/email_content_analysis`);
    u.searchParams.set("on_conflict", "market,brand,sent_date,day_seq,analysis_type,input_hash");
    const res = await fetch(u, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`写库失败（HTTP ${res.status}）：${(await res.text()).slice(0, 300)}`);
  }

  /** 下载 Storage 对象字节。 */
  async downloadStorageObject(objectKey) {
    const u = new URL(`${this.baseUrl}/storage/v1/object/${BANNER_BUCKET}/${objectKey}`);
    const res = await fetch(u, { headers: this.headers() });
    if (!res.ok) throw new Error(`Storage 下载失败（HTTP ${res.status}）。`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error(`Storage 对象不是图片（content-type=${contentType}）。`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
  }
}

/** 从 banner_url 解析 Storage object key（Supabase Storage URL 形态）；外部 URL 返回 null。 */
function parseStorageObjectKey(bannerUrl, baseUrl) {
  if (!bannerUrl || !baseUrl) return null;
  try {
    const u = new URL(bannerUrl);
    const m = /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/.exec(u.pathname)
      ?? /\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    if (m[1] !== BANNER_BUCKET) return null;
    return decodeURIComponent(m[2]);
  } catch {
    return null;
  }
}

/** 最小 PNG / JPEG 尺寸解析；解析不出返回 null（不阻塞分析）。 */
function parseImageDimensions(bytes) {
  try {
    // PNG: 8 字节签名 + IHDR（宽/高在偏移 16/20，大端 uint32）。
    if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    // JPEG: 找 SOF0/SOF2 标记（0xFFC0 / 0xFFC2），其后 5 字节内有高/宽。
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) { i += 1; continue; }
        const marker = bytes[i + 1];
        const len = (bytes[i + 2] << 8) + bytes[i + 3];
        if (marker === 0xc0 || marker === 0xc2) {
          return { height: (bytes[i + 5] << 8) + bytes[i + 6], width: (bytes[i + 7] << 8) + bytes[i + 8] };
        }
        i += 2 + len;
      }
    }
  } catch { /* 忽略，返回 null */ }
  return null;
}

async function fetchExternalImageBytes(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`外部图片下载失败（HTTP ${res.status}）。`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error(`外部 URL 不是图片（content-type=${contentType}）。`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 任务规划 ----
function buildJobs(emails, { start, end, markets, force, retryFailed }) {
  return emails
    .filter((e) => markets.length === 0 || markets.includes(e.market))
    .flatMap((email) => ["subject", "banner"].map((type) => ({ email, type })))
    .map((job) => ({
      ...job,
      key: [job.email.market, job.email.brand, job.email.sent_date, job.email.day_seq, job.type].join(""),
      display: [job.email.market, job.email.brand, job.email.sent_date, job.email.day_seq, job.type].join(" | "),
    }));
}

// ---- 主流程 ----
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const window = args.start && args.end
    ? { start: args.start, end: args.end }
    : await resolveDefaultWindow();
  if (args.start && !args.end) throw new Error("--start 与 --end 须成对传入。");
  if (!args.start && args.end) throw new Error("--start 与 --end 须成对传入。");
  if (!DATE_RE.test(window.start) || !DATE_RE.test(window.end) || window.start > window.end) {
    throw new Error(`无效窗口 ${window.start} – ${window.end}。`);
  }
  const concurrency = args.concurrency ?? DEFAULT_CONCURRENCY;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error("--concurrency 必须为 ≥1 的整数。");
  const maxTokens = args.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const batchId = args.batchId ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  const markets = args.market ?? [];
  const stats = { total: 0, skippedUnchanged: 0, success: 0, failed: 0, skipped: 0 };

  if (args.dryRun) {
    await runDryRun({ window, markets, batchId, stats, limit: args.limit });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const modelBaseUrl = process.env.CONTENT_ANALYSIS_API_BASE_URL;
  const modelApiKey = process.env.CONTENT_ANALYSIS_API_KEY;
  const textModel = process.env.CONTENT_ANALYSIS_TEXT_MODEL;
  const visionModel = process.env.CONTENT_ANALYSIS_VISION_MODEL;
  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["CONTENT_ANALYSIS_API_BASE_URL", modelBaseUrl],
    ["CONTENT_ANALYSIS_API_KEY", modelApiKey],
    ["CONTENT_ANALYSIS_TEXT_MODEL", textModel],
    ["CONTENT_ANALYSIS_VISION_MODEL", visionModel],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) throw new Error(`缺少环境变量：${missing.join(", ")}（密钥只读环境变量，绝不硬编码）。`);

  const supabase = new SupabaseAdmin({ baseUrl: supabaseUrl, serviceRoleKey });
  const model = new ModelClient({
    baseUrl: modelBaseUrl, apiKey: modelApiKey, timeoutMs, maxAttempts,
    budget: { maxTokens },
  });

  const emails = await supabase.fetchEmails({ start: window.start, end: window.end, markets });
  const latest = await supabase.fetchLatestAnalysis({ start: window.start, end: window.end, markets });
  let jobs = buildJobs(emails, { markets, force: args.force, retryFailed: args.retryFailed });
  if (args.limit !== undefined) jobs = jobs.slice(0, args.limit);
  stats.total = jobs.length;
  console.log(`[plan] 窗口 ${window.start}–${window.end}，市场 ${markets.length ? markets.join(",") : "全部"}，邮件 ${emails.length} 封，任务 ${jobs.length} 项，batch=${batchId}`);

  // 并发池：每（邮件，类型）独立状态，互不阻塞。
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      await runJob(job, { supabase, model, latest, window, batchId, textModel, visionModel, timeoutMs, force: args.force, retryFailed: args.retryFailed, stats });
    }
  });
  await Promise.all(workers);

  console.log(`[done] total=${stats.total} success=${stats.success} failed=${stats.failed} skipped=${stats.skipped} skippedUnchanged=${stats.skippedUnchanged} tokens=${model.spentTokens}/${maxTokens} batch=${batchId}`);
  if (stats.failed > 0) process.exitCode = 2;
}

async function runJob(job, ctx) {
  const { email, type } = job;
  const prev = ctx.latest.get(job.key);
  const attemptedAt = new Date().toISOString();

  const baseRow = {
    market: email.market,
    brand: email.brand,
    sent_date: email.sent_date,
    day_seq: email.day_seq,
    analysis_type: type,
    batch_id: ctx.batchId,
    attempted_at: attemptedAt,
  };

  const fail = async (errorCode, detail) => {
    console.warn(`[failed] ${job.display} ${errorCode}：${detail}`);
    ctx.stats.failed += 1;
    // 失败行只在尚无同 input_hash 行时写入（失败重跑不产生重复失败行，
    // 更不覆盖 success 行——同 hash 的 success 行在此之前已跳过）。
    if (prev && prev.input_hash === job.inputHash) return;
    try {
      await ctx.supabase.upsertRow({
        ...baseRow,
        status: "failed",
        result: null,
        input_hash: job.inputHash,
        model_version: job.modelVersion,
        prompt_version: PROMPT_VERSION,
        rules_version: RULES_VERSION,
        schema_version: SCHEMA_VERSION,
        input_meta: job.inputMeta,
        error_code: errorCode,
        succeeded_at: null,
      });
    } catch (e) {
      console.error(`[db-error] ${job.display} 失败行写库失败：${e.message}`);
    }
  };

  try {
    if (type === "subject") {
      job.modelVersion = ctx.textModel;
      const subject = email.subject ?? null;
      const preheader = email.preheader ?? null;
      job.inputMeta = { subject, preheader };
      const inputPayload = {
        analysis_type: "subject", market: email.market, brand: email.brand,
        subject, preheader,
        prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION,
        schema_version: SCHEMA_VERSION, model_version: ctx.textModel,
      };
      job.inputHash = sha256Hex(stableStringify(inputPayload));

      if (!ctx.force) {
        if (ctx.retryFailed) {
          if (!prev || prev.status !== "failed") { ctx.stats.skippedUnchanged += 1; return; }
        } else if (prev && prev.status === "success" && prev.input_hash === job.inputHash) {
          ctx.stats.skippedUnchanged += 1;
          return;
        }
      }
      if (subject === null || subject.trim() === "") {
        // 无标题：记 skipped（输入为空，input_hash 仍覆盖空输入 + 版本）。
        if (prev && prev.input_hash === job.inputHash) { ctx.stats.skippedUnchanged += 1; return; }
        ctx.stats.skipped += 1;
        await ctx.supabase.upsertRow({
          ...baseRow, status: "skipped", result: null, input_hash: job.inputHash,
          model_version: ctx.textModel, prompt_version: PROMPT_VERSION,
          rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION,
          input_meta: job.inputMeta, error_code: null, succeeded_at: null,
        });
        return;
      }
      const rules = analyzeSubjectRules(subject, preheader);
      let modelOut;
      try {
        modelOut = await ctx.model.call({
          model: ctx.textModel,
          messages: [
            { role: "system", content: SUBJECT_PROMPT },
            { role: "user", content: `Brand: ${email.brand}\nSubject: ${subject}\nPreheader: ${preheader ?? ""}` },
          ],
          schemaName: "SubjectAnalysis",
          schema: SUBJECT_JSON_SCHEMA,
        });
      } catch (e) {
        await fail(e.code ?? "model_error", e.message);
        return;
      }
      // 合并：确定性规则为准的字段（length/emoji）直接取规则值；
      // 其余取并集/优先模型，discount_framing 模型为空时回退规则。
      const merged = {
        tactics: dedupe([...(Array.isArray(modelOut.tactics) ? modelOut.tactics : []), ...rules.tactics]),
        discount_framing: typeof modelOut.discount_framing === "string" && modelOut.discount_framing ? modelOut.discount_framing : rules.discount_framing,
        length_chars: rules.length_chars,
        emoji_count: rules.emoji_count,
        cta_verbs: dedupe([...(Array.isArray(modelOut.cta_verbs) ? modelOut.cta_verbs : []), ...rules.cta_verbs]),
        personalization: modelOut.personalization === true || rules.personalization,
        trend_terms: sanitizeTrendTerms(modelOut.trend_terms),
      };
      const err = validateSubject(merged);
      if (err) { await fail("validation_failed", err); return; }
      await ctx.supabase.upsertRow({
        ...baseRow, status: "success", result: normalizeSubject(merged), input_hash: job.inputHash,
        model_version: ctx.textModel, prompt_version: PROMPT_VERSION,
        rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION,
        input_meta: job.inputMeta, error_code: null, succeeded_at: new Date().toISOString(),
      });
      ctx.stats.success += 1;
      return;
    }

    // ---- banner ----
    job.modelVersion = ctx.visionModel;
    const bannerUrl = email.banner_url ?? null;
    const objectKey = parseStorageObjectKey(bannerUrl, ctx.supabase.baseUrl);
    job.inputMeta = {
      banner_object_key: objectKey,
      banner_source_url: bannerUrl,
      banner_sha256: null,
      banner_width: null,
      banner_height: null,
      collected_at: attemptedAt,
    };
    if (bannerUrl === null || bannerUrl.trim() === "") {
      // 无 banner：记 skipped。
      const inputPayload = { analysis_type: "banner", market: email.market, brand: email.brand, banner: null, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION, model_version: ctx.visionModel };
      job.inputHash = sha256Hex(stableStringify(inputPayload));
      if (prev && prev.input_hash === job.inputHash) { ctx.stats.skippedUnchanged += 1; return; }
      ctx.stats.skipped += 1;
      await ctx.supabase.upsertRow({
        ...baseRow, status: "skipped", result: null, input_hash: job.inputHash,
        model_version: ctx.visionModel, prompt_version: PROMPT_VERSION,
        rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION,
        input_meta: job.inputMeta, error_code: null, succeeded_at: null,
      });
      return;
    }
    // banner 输入哈希依赖图片字节哈希，需先下载才能判断是否变化；
    // 因此 --retry-failed 的过滤在下载前做（跳过非 failed 的任务，省下载），
    // 而 unchanged-success 的跳过在算出字节哈希后做（见下方）。
    if (!ctx.force && ctx.retryFailed && (!prev || prev.status !== "failed")) {
      ctx.stats.skippedUnchanged += 1;
      return;
    }
    // 取实际图片字节：优先 Storage object key，否则取来源 URL 的字节。
    // 绝不只把 URL 写进 prompt。
    let image;
    try {
      if (objectKey) {
        image = await ctx.supabase.downloadStorageObject(objectKey);
      } else {
        image = await fetchExternalImageBytes(bannerUrl, ctx.timeoutMs);
      }
    } catch (e) {
      // 字节哈希未知：用 URL + 版本算临时哈希，仅用于失败行去重。
      job.inputHash = sha256Hex(stableStringify({ analysis_type: "banner", market: email.market, brand: email.brand, banner_source_url: bannerUrl, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION, model_version: ctx.visionModel }));
      await fail("banner_download_failed", e.message);
      return;
    }
    if (image.bytes.length > DEFAULT_MAX_IMAGE_BYTES) {
      job.inputHash = sha256Hex(stableStringify({ analysis_type: "banner", market: email.market, brand: email.brand, banner_sha256: sha256Hex(image.bytes), prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION, model_version: ctx.visionModel }));
      await fail("banner_too_large", `图片 ${image.bytes.length} 字节，超过上限 ${DEFAULT_MAX_IMAGE_BYTES}。`);
      return;
    }
    const bannerSha = sha256Hex(image.bytes);
    const dims = parseImageDimensions(image.bytes);
    job.inputMeta.banner_sha256 = bannerSha;
    job.inputMeta.banner_width = dims?.width ?? null;
    job.inputMeta.banner_height = dims?.height ?? null;
    const inputPayload = {
      analysis_type: "banner", market: email.market, brand: email.brand,
      subject: email.subject ?? null, // 传给 vision 的上下文：标题 + 品牌
      banner_sha256: bannerSha,
      prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION,
      schema_version: SCHEMA_VERSION, model_version: ctx.visionModel,
    };
    job.inputHash = sha256Hex(stableStringify(inputPayload));
    if (!ctx.force && !ctx.retryFailed && prev && prev.status === "success" && prev.input_hash === job.inputHash) {
      ctx.stats.skippedUnchanged += 1;
      return;
    }

    const base64 = Buffer.from(image.bytes).toString("base64");
    let modelOut;
    try {
      modelOut = await ctx.model.call({
        model: ctx.visionModel,
        messages: [
          { role: "system", content: BANNER_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Brand: ${email.brand}\nSubject line (context only): ${email.subject ?? ""}` },
              { type: "image_url", image_url: { url: `data:${image.contentType};base64,${base64}` } },
            ],
          },
        ],
        schemaName: "BannerAnalysis",
        schema: BANNER_JSON_SCHEMA,
      });
    } catch (e) {
      await fail(e.code ?? "model_error", e.message);
      return;
    }
    const normalized = normalizeBanner(modelOut);
    const err = validateBanner(normalized);
    if (err) { await fail("validation_failed", err); return; }
    await ctx.supabase.upsertRow({
      ...baseRow, status: "success", result: normalized, input_hash: job.inputHash,
      model_version: ctx.visionModel, prompt_version: PROMPT_VERSION,
      rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION,
      input_meta: job.inputMeta, error_code: null, succeeded_at: new Date().toISOString(),
    });
    ctx.stats.success += 1;
  } catch (e) {
    // 兜底：写库异常等未分类错误。
    console.error(`[error] ${job.display} 未分类异常：${e?.message ?? e}`);
    if (!job.inputHash) {
      job.inputHash = sha256Hex(stableStringify({ analysis_type: type, market: email.market, brand: email.brand, error: "unknown", prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION }));
      job.inputMeta = job.inputMeta ?? {};
      job.modelVersion = job.modelVersion ?? (type === "subject" ? ctx.textModel : ctx.visionModel);
    }
    await fail("db_error", e?.message ?? String(e));
  }
}

// ---- --dry-run：合成数据离线验证（不联网、不调模型、不写库） ----
async function runDryRun({ window, markets, batchId, stats, limit }) {
  console.log(`[dry-run] 窗口 ${window.start}–${window.end}，市场 ${markets.length ? markets.join(",") : "全部"}，batch=${batchId}（合成数据，不联网、不写库）`);
  const synthetic = [
    { market: "US", brand: "Zara", sent_date: window.start, day_seq: 0, subject: "Last chance: 40% off ends tonight 🛍️ — Shop now", preheader: "Picked for you, just for you", banner_url: "https://example.invalid/banner-zara.png" },
    // 与上一封同市场同品牌同日、仅 day_seq 不同（4 元组区分）：两封必须分成两个任务，不能误合并。
    { market: "US", brand: "Zara", sent_date: window.start, day_seq: 1, subject: "Save 20% on your favorites 👨‍👩‍👧‍👦 🇫🇷", preheader: null, banner_url: null },
    { market: "US", brand: "lululemon", sent_date: window.start, day_seq: 0, subject: "New drop ✨ Fresh arrivals are here", preheader: null, banner_url: null },
    { market: "UK", brand: "ALO Yoga", sent_date: window.start, day_seq: 0, subject: null, preheader: null, banner_url: null },
    { market: "US", brand: "SHEIN", sent_date: window.start, day_seq: 0, subject: "Free shipping + BOGO — discover more", preheader: "Your style awaits", banner_url: "https://example.invalid/banner-shein.png" },
  ];
  const jobs = buildJobs(synthetic, { markets }).slice(0, limit ?? Infinity);
  stats.total = jobs.length;

  // Stub 模型：subject 返回规则结果；banner 返回固定合法结果。
  const stubBanner = {
    dominant_colors: ["white", "black"],
    composition: "centered",
    cta_presence: true,
    cta_position: "bottom",
    text_image_ratio: "balanced",
    seasonal_cues: ["summer"],
  };

  for (const job of jobs) {
    const { email, type } = job;
    if (type === "subject") {
      const subject = email.subject ?? null;
      const preheader = email.preheader ?? null;
      const inputHash = sha256Hex(stableStringify({ analysis_type: "subject", market: email.market, brand: email.brand, subject, preheader, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION, model_version: "stub" }));
      if (!subject) {
        stats.skipped += 1;
        console.log(`[dry-run] ${job.display} subject → skipped（无标题），input_hash=${inputHash.slice(0, 12)}…`);
        continue;
      }
      const merged = analyzeSubjectRules(subject, preheader);
      const err = validateSubject(normalizeSubject(merged));
      if (err) { stats.failed += 1; console.log(`[dry-run] ${job.display} subject → validation_failed：${err}`); continue; }
      stats.success += 1;
      console.log(`[dry-run] ${job.display} subject → success ${JSON.stringify(normalizeSubject(merged))}`);
    } else {
      if (!email.banner_url) {
        stats.skipped += 1;
        console.log(`[dry-run] ${job.display} banner → skipped（无 banner）`);
        continue;
      }
      // 模拟字节哈希（不下载）：stub 用 URL 算哈希，仅验证哈希/校验链路。
      const bannerSha = sha256Hex(`stub-bytes:${email.banner_url}`);
      const inputHash = sha256Hex(stableStringify({ analysis_type: "banner", market: email.market, brand: email.brand, subject: email.subject ?? null, banner_sha256: bannerSha, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION, schema_version: SCHEMA_VERSION, model_version: "stub" }));
      const normalized = normalizeBanner(stubBanner);
      const err = validateBanner(normalized);
      if (err) { stats.failed += 1; console.log(`[dry-run] ${job.display} banner → validation_failed：${err}`); continue; }
      stats.success += 1;
      console.log(`[dry-run] ${job.display} banner → success input_hash=${inputHash.slice(0, 12)}… ${JSON.stringify(normalized)}`);
    }
  }

  // 自检：脏数据必须被校验拒绝（cta_presence=false 但给了位置；Hex 颜色；非法色族）。
  const dirtyBanner = { dominant_colors: ["red"], composition: "centered", cta_presence: false, cta_position: "bottom", text_image_ratio: "balanced", seasonal_cues: [] };
  const dirtyErr = validateBanner(dirtyBanner);
  console.log(`[dry-run] 自检脏 banner（cta 约束）被拒绝：${dirtyErr ? `是（${dirtyErr}）` : "否——校验有漏洞！"}`);
  if (!dirtyErr) process.exitCode = 1;
  const hexBanner = { dominant_colors: ["#FF0000", "white"], composition: "centered", cta_presence: true, cta_position: "bottom", text_image_ratio: "balanced", seasonal_cues: [] };
  const hexErr = validateBanner(hexBanner);
  console.log(`[dry-run] 自检 Hex 颜色 banner 被拒绝：${hexErr ? `是（${hexErr}）` : "否——校验有漏洞！"}`);
  if (!hexErr) process.exitCode = 1;
  const badFamilyBanner = { dominant_colors: ["notacolor"], composition: "centered", cta_presence: true, cta_position: "bottom", text_image_ratio: "balanced", seasonal_cues: [] };
  const badFamilyErr = validateBanner(badFamilyBanner);
  console.log(`[dry-run] 自检非法色族 banner 被拒绝：${badFamilyErr ? `是（${badFamilyErr}）` : "否——校验有漏洞！"}`);
  if (!badFamilyErr) process.exitCode = 1;
  const goodFamilyBanner = { dominant_colors: ["red", "white"], composition: "centered", cta_presence: true, cta_position: "bottom", text_image_ratio: "balanced", seasonal_cues: [] };
  const goodFamilyErr = validateBanner(goodFamilyBanner);
  console.log(`[dry-run] 自检合法色族 banner 通过：${!goodFamilyErr ? "是" : `否——误杀（${goodFamilyErr}）`}`);
  if (goodFamilyErr) process.exitCode = 1;
  // 自检：规则 bug 回归（Save 20% 保留 %；家庭=1；国旗=1；裸 your 不算个性化）。
  const saveFraming = detectDiscountFraming("Save 20% on your favorites", null);
  console.log(`[dry-run] 自检 Save 20% 保留 %：${saveFraming === "Save 20%" ? "是" : `否——得到 ${JSON.stringify(saveFraming)}`}`);
  if (saveFraming !== "Save 20%") process.exitCode = 1;
  const familyCount = countEmoji("👨‍👩‍👧‍👦");
  console.log(`[dry-run] 自检家庭 Emoji 计 1：${familyCount === 1 ? "是" : `否——得到 ${familyCount}`}`);
  if (familyCount !== 1) process.exitCode = 1;
  const flagCount = countEmoji("🇫🇷");
  console.log(`[dry-run] 自检国旗 Emoji 计 1：${flagCount === 1 ? "是" : `否——得到 ${flagCount}`}`);
  if (flagCount !== 1) process.exitCode = 1;
  const bareYour = detectPersonalization("Your new favorites are here");
  console.log(`[dry-run] 自检裸 your 不算个性化：${bareYour === false ? "是" : "否——误判为个性化"}`);
  if (bareYour !== false) process.exitCode = 1;
  const dupSubject = { tactics: ["discount", "discount"], discount_framing: null, length_chars: 3, emoji_count: 0, cta_verbs: [], personalization: false };
  const dupErr = validateSubject(dupSubject);
  console.log(`[dry-run] 自检重复 tactics 被拒绝：${dupErr ? `是（${dupErr}）` : "否——校验有漏洞！"}`);
  if (!dupErr) process.exitCode = 1;

  console.log(`[dry-run done] total=${stats.total} success=${stats.success} failed=${stats.failed} skipped=${stats.skipped}`);
}

await main().catch((error) => {
  console.error(`[fatal] ${error?.message ?? error}`);
  process.exitCode = 1;
});
