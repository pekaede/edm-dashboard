/**
 * @file content-analysis-rules.ts
 * @description 邮件主标题与副标题分析确定性规则。
 * 纯函数实现，无外部状态或网络依赖，供看板前端与离线/在线 Pipeline 共用相同分析口径。
 *
 * 语言范围：规则仅覆盖英文（English only）。length_chars 与 emoji_count 对任意文本
 * 仍可计算；tactics / discount_framing / cta_verbs / personalization 对非英文标题
 * 可能返回空 / null / false，那是“规则未覆盖”，不是“该标题没有这些特征”。
 * 不要把非英文标题的空结果解读为“无策略 / 无折扣 / 无 CTA / 无个性化”。
 */

import type { SubjectAnalysis } from "./email-content-analysis";

/**
 * 标题核心策略枚举。
 * - urgency: 紧迫感 / 倒计时 / 稀缺性
 * - discount: 折扣 / 降价 / 满减 / 优惠券 / 促销活动
 * - social_proof: 社交证明 / 热卖榜 / 用户推荐 / 五星好评 / 补货
 * - newness: 新品上市 / 季节上新 / 系列发布
 * - curiosity: 好奇心引发 / 悬念 / 揭秘 / 猜猜看
 * - personalization: 个性化指代 / 专享推荐 / 会员专享
 * - other: 兜底分类（当无任何策略命中时作为标识，通常空数组优先）
 */
export type SubjectTactic =
  | "urgency"
  | "discount"
  | "social_proof"
  | "newness"
  | "curiosity"
  | "personalization"
  | "other";

/**
 * 各策略关键词映射字典。
 * 口径说明：英文关键词（大小写不敏感），包含单字与复合短语。
 */
export const TACTIC_KEYWORDS: Record<SubjectTactic, string[]> = {
  urgency: [
    "last chance",
    "final hours",
    "ends tonight",
    "ending soon",
    "limited time",
    "don't miss",
    "expires",
    "running out",
    "today only",
    "almost gone",
    "now or never",
    "clock is ticking",
    "few hours left",
    "hurry",
    "won't last",
  ],
  discount: [
    "% off",
    "percent off",
    "sale",
    "save",
    "clearance",
    "discount",
    "bogo",
    "free shipping",
    "free delivery",
    "promo",
    "voucher",
    "coupon",
    "special offer",
    "markdown",
    "price drop",
    "$ off",
    "£ off",
    "€ off",
    "deal",
    "doorbuster",
  ],
  social_proof: [
    "bestseller",
    "best-seller",
    "trending",
    "top rated",
    "customer favorite",
    "most loved",
    "viral",
    "fan favorite",
    "popular",
    "5-star",
    "back in stock",
    "everyone is loving",
    "restocked",
    "community favorite",
  ],
  newness: [
    "just dropped",
    "introducing",
    "arrived",
    "unveiling",
    "fresh",
    "latest",
    "launch",
    "meet the",
    "first look",
    "brand new",
    "new collection",
    "new arrival",
    "new in",
  ],
  curiosity: [
    "secret",
    "reveal",
    "guess what",
    "inside",
    "sneak peek",
    "unlock",
    "you won't believe",
    "open to see",
    "surprise",
    "what's inside",
    "spotted",
    "hint",
  ],
  personalization: [
    "for you",
    "picked for you",
    "handpicked",
    "exclusive",
    "just for you",
    "vip",
    "member exclusive",
    "your style",
    "custom for you",
    "made for you",
  ],
  other: [],
};

/**
 * 常用行动号召（CTA）动词表。
 * 口径说明：邮件标题和副标题中常见的强引导动词，大小写不敏感匹配独立单词。
 */
export const CTA_VERBS: string[] = [
  "shop",
  "get",
  "claim",
  "discover",
  "explore",
  "save",
  "grab",
  "find",
  "buy",
  "see",
  "check out",
  "upgrade",
  "unlock",
  "join",
  "enjoy",
  "view",
  "start",
  "take",
  "treat",
  "order",
];

/**
 * 统计文本中的 Emoji 个数，按字形簇（grapheme cluster）计数。
 * 口径说明：
 * - 家庭 Emoji 👨‍👩‍👧‍👦 是 1 个字形簇（ZWJ 连接序列），计 1，不是 4。
 * - 国旗 Emoji 🇫🇷 是 1 个字形簇（两个 Regional Indicator），计 1，不是 0。
 * - 带肤色修饰符的 Emoji（如 👍🏽）计 1。
 * 实现：优先用 Intl.Segmenter（grapheme 粒度）切分字形簇，含
 * Extended_Pictographic / Regional_Indicator / U+20E3（按键帽）的簇计 1；
 * 无 Segmenter 时用正则回退（覆盖 ZWJ 序列、国旗对、修饰符）。
 */
export function countEmoji(text: string | null | undefined): number {
  if (!text) return 0;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    let count = 0;
    for (const { segment } of segmenter.segment(text)) {
      if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(segment)) {
        count += 1;
      }
    }
    return count;
  }
  const matches = text.match(
    /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u20E3)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u20E3)?)*/gu,
  );
  return matches ? matches.length : 0;
}

/**
 * 检测主标题及副标题中命中的营销策略列表。
 * 口径说明：对 subject + preheader 合并文本小写化，扫描 TACTIC_KEYWORDS。返回命中的策略数组。
 */
export function detectTactics(
  subject: string | null | undefined,
  preheader?: string | null | undefined
): SubjectTactic[] {
  const combined = `${subject ?? ""} ${preheader ?? ""}`.toLowerCase();
  if (!combined.trim()) return [];

  const matched: SubjectTactic[] = [];
  const tactics: Exclude<SubjectTactic, "other">[] = [
    "urgency",
    "discount",
    "social_proof",
    "newness",
    "curiosity",
    "personalization",
  ];

  for (const tactic of tactics) {
    const keywords = TACTIC_KEYWORDS[tactic];
    const isHit = keywords.some((kw) => {
      // 包含空格或符号的短语使用简单 includes；单词使用带边界匹配
      if (kw.includes(" ") || kw.includes("%") || kw.includes("$") || kw.includes("£") || kw.includes("€") || kw.includes("-")) {
        return combined.includes(kw);
      }
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      return regex.test(combined);
    });

    if (isHit) {
      matched.push(tactic);
    }
  }

  return matched;
}

/**
 * 提取折扣话术（Discount Framing）归一化标签或原始短语。
 * 口径说明：
 * 1. 优先提取百分比折扣（如 "40% off", "Up to 50% off", "Extra 20% off"）
 * 2. 提取固定金额减免（如 "$20 off", "Save $30"）
 * 3. 提取 BOGO（买赠）
 * 4. 提取 Free Shipping（包邮）
 * 5. 提取 Sitewide / Storewide（全场促销）
 * 6. 若无明确匹配则返回 null
 * 注意：明确折扣用确定性方法提取；"Save 20%" 必须原样保留 %（旧实现因
 * \b 边界回退把 "Save 20%" 截成 "Save 20"，已修复：Save 分支不再用 \b 收尾）。
 */
export function detectDiscountFraming(
  subject: string | null | undefined,
  preheader?: string | null | undefined
): string | null {
  const combined = `${subject ?? ""} ${preheader ?? ""}`.trim();
  if (!combined) return null;

  // 1. Extra X% off
  const extraPercent = combined.match(/\bextra\s+\d{1,3}%\s*off\b/i);
  if (extraPercent) {
    return extraPercent[0].trim();
  }

  // 2. Up to X% off
  const upToPercent = combined.match(/\bup\s+to\s+\d{1,3}%\s*off\b/i);
  if (upToPercent) {
    return upToPercent[0].trim();
  }

  // 3. X% off
  const percentMatch = combined.match(/\b\d{1,3}%\s*off\b/i);
  if (percentMatch) {
    return percentMatch[0].trim();
  }

  // 4. Save X% / Save $X / Save X（可选 " off" 后缀）。
  // 不要在 % 后用 \b 收尾：% 是非单词字符，\b 会在 "% " 前回退，
  // 导致 "Save 20%" 被截成 "Save 20"。用整段匹配直接返回，保留 %。
  const saveMatch = combined.match(/\bsave\s+[$£€]?\d+(?:\.\d{1,2})?%?(?:\s+off)?/i);
  if (saveMatch) {
    return saveMatch[0].trim();
  }

  // 5. $X off / £X off / €X off
  const dollarOff = combined.match(/[$£€]\d+(\.\d{2})?\s*off\b/i);
  if (dollarOff) {
    return dollarOff[0].trim();
  }

  // 6. BOGO / Buy one get one
  if (/\b(bogo|buy\s+\d+\s+get\s+\d+|buy\s+one\s+get\s+one)\b/i.test(combined)) {
    return "BOGO";
  }

  // 7. Free shipping / Free delivery
  if (/\bfree\s+(shipping|delivery)\b/i.test(combined)) {
    return "Free Shipping";
  }

  // 8. Sitewide sale
  if (/\b(sitewide|storewide)\b/i.test(combined)) {
    return "Sitewide Sale";
  }

  return null;
}

/**
 * 提取文本中的行动召唤（CTA）动词列表。
 * 口径说明：单词边界匹配 CTA_VERBS 列表，按在文本中出现的先后顺序去重返回。
 */
export function extractCtaVerbs(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];

  for (const verb of CTA_VERBS) {
    // 匹配复合词如 "check out" 或单动词
    const regex = new RegExp(`\\b${verb}\\b`, "i");
    if (regex.test(text)) {
      found.push(verb.toLowerCase());
    }
  }

  return found;
}

/**
 * 检测是否包含个性化元素（保守口径）。
 * 口径说明——只认两类强信号：
 * 1. 占位符变量：如 {first_name}, {{name}}, %FIRSTNAME%, [name] 等 CRM 动态字段
 * 2. 强个性化短语：明确“为你挑选/定制”类，如 "picked for you", "just for you",
 *    "curated for you", "for your eyes only", "tailored for you"
 * 明确不认：单独出现 you / your / yours / you're 不等于真实个性化。
 * 英文营销标题里第二人称泛滥（"Your new favorites"），把它算成个性化会
 * 把几乎所有标题都标成个性化，失去区分度，故保持保守。
 */
export function detectPersonalization(text: string | null | undefined): boolean {
  if (!text) return false;

  // 1. 动态模板标签
  const templateTagRegex = /\{[a-z0-9_.]+\}|\[[a-z0-9_.]+\]|%[a-z0-9_.]+%|\{\{[a-z0-9_.]+\}\}/i;
  if (templateTagRegex.test(text)) {
    return true;
  }

  // 2. 强个性化短语（必须含“为你”类定制语义，裸 you/your 不计）
  const phraseRegex =
    /\b(just for you|picked for you|curated for you|handpicked for you|exclusive for you|chosen for you|selected for you|tailored for you|recommended for you|made for you|for your eyes only)\b/i;
  return phraseRegex.test(text);
}

/**
 * 组合执行邮件主标题与副标题启发式分析。
 * 口径定义说明（规则仅覆盖英文，非英文标题的部分字段可能为空，见文件头）：
 * - length_chars: 主标题 subject 的字符总长度（去除首尾空白）；若 subject 为空则为 0。此项紧密贴合 EDM 标题展示长度限制。
 * - emoji_count: subject 与 preheader 合并文本中的 emoji 统计（字形簇口径）。
 * - tactics: 策略分析覆盖 subject 与 preheader。
 * - discount_framing: 折扣结构提取覆盖 subject 与 preheader。
 * - cta_verbs: CTA 动词提取覆盖 subject 与 preheader。
 * - personalization: 个性化指代检测覆盖 subject 与 preheader（保守口径，裸 you/your 不计）。
 */
export function analyzeSubject(
  subject: string | null | undefined,
  preheader?: string | null | undefined
): SubjectAnalysis {
  const cleanSubject = subject ? subject.trim() : "";
  const combinedText = `${cleanSubject} ${preheader ? preheader.trim() : ""}`.trim();

  return {
    tactics: detectTactics(cleanSubject, preheader),
    discount_framing: detectDiscountFraming(cleanSubject, preheader),
    length_chars: cleanSubject.length,
    emoji_count: countEmoji(combinedText),
    cta_verbs: extractCtaVerbs(combinedText),
    personalization: detectPersonalization(combinedText),
  };
}
