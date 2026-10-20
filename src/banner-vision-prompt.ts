/**
 * @file banner-vision-prompt.ts
 * @description EDM Banner 视觉多模态分析 Prompt 规范、结构化输出 Schema 与解析器。
 * 作为单一真理来源（Single Source of Truth），供前端预览与离线/在线 Pipeline 共用。
 * 无 API Key 硬编码，不包含任何网络调用。
 *
 * 调用方式（必须）：用 buildBannerVisionMessages / buildBannerVisionRequest 把图片
 * 作为多模态 image part 传给视觉模型；禁止只把图片 URL 写进 prompt 文本让模型
 * “凭 URL 想象”——模型看不到纯文本 URL 指向的图片，那样会编造结果。
 * 旧 buildBannerVisionPrompt 的 imageUrl 参数已删除：传 URL 不等于传图，
 * 旧调用点应在 TypeScript 编译期报错并改成多模态调用，而不是静默继续。
 */

import type { BannerAnalysis } from "./email-content-analysis";

/** 主色色族枚举：模型只输出色族标签，不直接编 Hex。真正的 Hex 由图像算法提取并归一成色族。 */
export const COLOR_FAMILIES = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "navy",
  "purple",
  "pink",
  "brown",
  "beige",
  "gold",
  "black",
  "white",
  "gray",
  "cream",
] as const;
export type BannerColorFamily = (typeof COLOR_FAMILIES)[number];

/** 构图枚举（2026-10-20 起为 8 类内容构图：大字报/时尚大片/单模特/多商品/群像/拼贴/细节特写/场景生活；旧 5 类已随全量重分析完成而移除）。 */
export const BANNER_COMPOSITIONS = [
  "text-poster",
  "fashion-editorial",
  "single-model",
  "multi-product",
  "group-shot",
  "collage",
  "detail-closeup",
  "lifestyle-scene",
] as const;

/** CTA 视觉位置枚举（cta_presence 为 false 时必须为 null）。 */
export const BANNER_CTA_POSITIONS = ["top", "center", "bottom", "bottom-right"] as const;

/** 图文比枚举。 */
export const BANNER_TEXT_IMAGE_RATIOS = ["text-heavy", "balanced", "image-heavy"] as const;

/**
 * 季节标签枚举：只允许以下标签；图片里可见但不在列表中的季节元素用 "other"，
 * 不许自造新标签。空数组表示图片中无可见季节/节日证据。
 */
export const BANNER_SEASONAL_CUES = [
  "spring",
  "summer",
  "autumn",
  "winter",
  "new-year",
  "valentines-day",
  "easter",
  "mothers-day",
  "fathers-day",
  "halloween",
  "thanksgiving",
  "christmas",
  "holiday",
  "black-friday",
  "cyber-monday",
  "back-to-school",
  "ramadan",
  "lunar-new-year",
  "pride",
  "graduation",
  "wedding",
  "clearance",
  "other",
] as const;

/**
 * Banner 分析结构化输出 JSON Schema（与 BannerAnalysis 对齐）。
 * 供支持 structured outputs 的视觉模型（如 OpenAI response_format: json_schema）使用。
 * 约束：composition / text_image_ratio / cta_position / dominant_colors / seasonal_cues
 * 均为枚举；cta_position 在 cta_presence 为 false 时必须为 null；dominant_colors
 * 最多 5 项且只能是色族标签，禁止 Hex。
 */
export const BANNER_VISION_JSON_SCHEMA = {
  type: "object",
  description:
    "Visual analysis of an email marketing banner image. Judge ONLY what is visible in the image; never invent facts that are not visible.",
  properties: {
    dominant_colors: {
      type: "array",
      description:
        "Up to 5 dominant color-family labels visible in the image. Output color FAMILY names only (e.g. \"red\", \"white\"). NEVER output hex codes: the model must not invent hex values; real hex values are extracted separately by an image algorithm and normalized into these families.",
      items: { type: "string", enum: [...COLOR_FAMILIES] },
      maxItems: 5,
    },
    composition: {
      type: "string",
      description:
        "Content composition type of the banner, one of: text-poster (typography-dominant, oversized headline is the main visual), fashion-editorial (high-fashion editorial look, artistic styling or lighting), single-model (one model showcasing an outfit or product), multi-product (multiple products displayed or arranged together), group-shot (several models or people posed together), collage (multiple distinct images combined in panels or a collage layout), detail-closeup (close-up of a product detail, material or texture), lifestyle-scene (product shown in a real-life scene or setting).",
      enum: [...BANNER_COMPOSITIONS],
    },
    cta_presence: {
      type: "boolean",
      description:
        "true ONLY if a visually distinct button-like element (button, pill, or banner-shaped block with CTA-like text such as \"Shop Now\") is visible in the image. Describe visual presence only; do NOT infer whether the element is really clickable.",
    },
    cta_position: {
      type: ["string", "null"],
      description:
        "Where the visible CTA element sits in the image. MUST be null when cta_presence is false. When cta_presence is true but the position is unclear, use null rather than guessing.",
      enum: [...BANNER_CTA_POSITIONS, null],
    },
    text_image_ratio: {
      type: "string",
      description: "Visual balance between rendered text and photographic/graphic imagery in the image.",
      enum: [...BANNER_TEXT_IMAGE_RATIOS],
    },
    seasonal_cues: {
      type: "array",
      description:
        "Seasonal / holiday cues with VISIBLE evidence in the image (decorations, text rendered in the image, seasonal products shown). A seasonal word in the subject line is NOT evidence: do not copy it unless the same cue is also visible in the image. Use \"other\" for a visible cue not in the list. Empty array when no cue is visible.",
      items: { type: "string", enum: [...BANNER_SEASONAL_CUES] },
    },
  },
  required: [
    "dominant_colors",
    "composition",
    "cta_presence",
    "cta_position",
    "text_image_ratio",
    "seasonal_cues",
  ],
  additionalProperties: false,
} as const;

/** OpenAI 风格 structured outputs 包装：{ type: "json_schema", json_schema: { name, strict, schema } }。 */
export const BANNER_VISION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "banner_analysis",
    strict: true,
    schema: BANNER_VISION_JSON_SCHEMA,
  },
} as const;

/**
 * 结构化 Banner 视觉分析的基础 Prompt（纯文本部分，不含图片）。
 * 严格要求只输出合法 JSON；禁止 Markdown 代码块与额外说明文字。
 * 核心纪律：只做视觉判断，不补全不可见事实；CTA 只描述视觉存在，
 * 不推断真实可点击性；季节标签只认图片证据，不认标题上下文。
 */
export const BANNER_VISION_PROMPT = `You are an expert marketing creative analyst specializing in email marketing (EDM) banner design.
Analyze the provided email banner image and extract key visual attributes according to the schema below.

Rules (must follow):
1. Judge ONLY what is visible in the image. Never invent, complete, or infer facts that are not visible (no guessing hidden text, links, prices, or click targets).
2. dominant_colors: output color FAMILY labels from the allowed list only (e.g. "red", "white", "black"). NEVER output hex codes — you must not invent hex values. Real hex values are extracted separately by an image algorithm and normalized into these families.
3. cta_presence: true ONLY if a visually distinct button-like element (button, pill, or banner-shaped block with CTA-like text such as "Shop Now") is visible. This describes VISUAL presence only; do NOT infer whether the element is really clickable.
4. cta_position: the position of the visible CTA element. MUST be null when cta_presence is false. When a CTA is visible but its position is unclear, use null rather than guessing.
5. seasonal_cues: list ONLY seasonal / holiday cues with VISIBLE evidence in the image (decorations, text rendered in the image, seasonal products shown). A seasonal word in the subject line is context, NOT evidence: do NOT copy it unless the same cue is also visible in the image. Use "other" for a visible cue not in the allowed list. Empty array [] when no cue is visible.
6. If anything is uncertain, prefer the conservative value (false / null / [] / "balanced") over a guess.

Output ONLY a valid JSON object without any Markdown formatting, fences (no \`\`\` or \`\`\`json), or conversational text.

JSON Schema:
{
  "dominant_colors": string[], // Up to 5 color FAMILY labels, e.g. ["white", "red", "black"]. NEVER hex codes.
  "composition": string,       // Must be one of: "centered", "left-aligned", "split-layout", "full-bleed", "grid"
  "cta_presence": boolean,     // true only if a visually distinct CTA button-like element is VISIBLE in the image
  "cta_position": string | null, // "top" | "center" | "bottom" | "bottom-right", or null when cta_presence is false
  "text_image_ratio": string,  // Must be one of: "text-heavy", "balanced", "image-heavy"
  "seasonal_cues": string[]    // Seasonal cues with VISIBLE image evidence only, e.g. ["summer", "back-to-school", "christmas"]. [] if none visible.
}`;

/**
 * 组装带有上下文信息的 Banner 视觉分析 Prompt（纯文本部分）。
 * subject / brand 只是上下文，帮助理解活动背景；模型不得把标题里的
 * 季节词当成图片证据（见 Prompt 规则 5）。
 *
 * @param input.subject 当前邮件主标题（仅作上下文，不作为图片证据）
 * @param input.brand 品牌名称（仅作上下文）
 * @returns 组合后的完整 Prompt 文本（不含图片；图片必须由调用方作为多模态 image part 传入）
 */
export function buildBannerVisionPrompt(input: {
  subject?: string | null;
  brand?: string | null;
}): string {
  const contextParts: string[] = [];

  if (input.brand) {
    contextParts.push(`Brand (context only): ${input.brand}`);
  }
  if (input.subject) {
    contextParts.push(
      `Subject line (context only, NOT image evidence): "${input.subject}"`,
    );
  }

  const contextSection =
    contextParts.length > 0
      ? `\n\nContext (do not treat as image evidence):\n${contextParts.join("\n")}`
      : "";

  return `${BANNER_VISION_PROMPT}${contextSection}`;
}

/** 视觉模型调用的图片输入：远端 URL 或 base64 数据（二选一）。 */
export type BannerVisionImage =
  | { kind: "url"; url: string }
  | { kind: "data"; mimeType: string; base64: string };

/** 多模态消息内容 part（OpenAI chat completions 风格）。 */
export type BannerVisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface BannerVisionMessage {
  role: "user";
  content: BannerVisionContentPart[];
}

/**
 * 组装真正的多模态调用消息：文本 Prompt + 图片 part。
 * 调用方把返回的 messages 传给视觉模型的 chat completions 类接口，
 * 并把 BANNER_VISION_RESPONSE_FORMAT 作为 response_format 传入。
 * 图片必须以 image part 形式传入；不要只把 URL 写进 prompt 文本。
 */
export function buildBannerVisionMessages(input: {
  image: BannerVisionImage;
  subject?: string | null;
  brand?: string | null;
}): BannerVisionMessage[] {
  const imageUrl =
    input.image.kind === "url"
      ? input.image.url
      : `data:${input.image.mimeType};base64,${input.image.base64}`;
  return [
    {
      role: "user",
      content: [
        { type: "text", text: buildBannerVisionPrompt(input) },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
}

/**
 * 组装一次完整的结构化视觉分析请求：多模态消息 + response_format。
 * 调用方只负责把 messages / response_format 透传给模型 SDK，不再自行拼 Prompt。
 */
export function buildBannerVisionRequest(input: {
  image: BannerVisionImage;
  subject?: string | null;
  brand?: string | null;
}): {
  messages: BannerVisionMessage[];
  response_format: typeof BANNER_VISION_RESPONSE_FORMAT;
} {
  return {
    messages: buildBannerVisionMessages(input),
    response_format: BANNER_VISION_RESPONSE_FORMAT,
  };
}

function isColorFamily(value: string): value is BannerColorFamily {
  return (COLOR_FAMILIES as readonly string[]).includes(value);
}

/**
 * 解析模型返回的 Banner 分析 JSON 文本，去除可能的 Markdown fence 并进行字段校验。
 * 与 BANNER_VISION_JSON_SCHEMA 对齐：枚举字段不在枚举内则抛错；
 * dominant_colors 只保留色族标签（旧的 Hex 值会被丢弃——Hex 由图像算法提取，
 * 不是模型输出）；seasonal_cues 只保留枚举内标签；
 * cta_presence 为 false 时强制 cta_position 为 null（即使模型给了位置）。
 *
 * @param jsonText 包含模型分析结果的原始文本
 * @returns 规范化的 BannerAnalysis 对象
 * @throws 当输入无法解析为有效 JSON 或枚举字段非法时抛出详细 Error
 */
export function parseBannerAnalysis(jsonText: string): BannerAnalysis {
  if (!jsonText || typeof jsonText !== "string") {
    throw new Error("parseBannerAnalysis: 输入必须是非空字符串");
  }

  let cleaned = jsonText.trim();

  // 去除可能的 ```json ... ``` 或 ``` ... ``` 标记
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `parseBannerAnalysis: 无法解析 JSON 内容 (${(err as Error).message}):\n${jsonText.slice(0, 300)}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("parseBannerAnalysis: 顶层结果必须是 JSON 对象");
  }

  const record = parsed as Record<string, unknown>;

  // 1. dominant_colors: 色族标签数组（最多 5 项）；非色族值（含旧 Hex）丢弃
  if (!Array.isArray(record.dominant_colors)) {
    throw new Error("parseBannerAnalysis: dominant_colors 必须是数组");
  }
  const dominant_colors = record.dominant_colors
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().toLowerCase())
    .filter(isColorFamily)
    .slice(0, 5);

  // 2. composition: 必须在枚举内
  if (
    typeof record.composition !== "string" ||
    !(BANNER_COMPOSITIONS as readonly string[]).includes(record.composition.trim())
  ) {
    throw new Error(
      `parseBannerAnalysis: composition 必须为 ${BANNER_COMPOSITIONS.join(" / ")} 之一`
    );
  }
  const composition = record.composition.trim();

  // 3. cta_presence: boolean
  if (typeof record.cta_presence !== "boolean") {
    throw new Error("parseBannerAnalysis: cta_presence 必须是布尔值");
  }
  const cta_presence = record.cta_presence;

  // 4. cta_position: cta_presence 为 false 时强制 null；为 true 时必须在枚举内或为 null
  let cta_position: string | null = null;
  if (cta_presence) {
    if (record.cta_position === null || record.cta_position === undefined) {
      cta_position = null;
    } else if (
      typeof record.cta_position === "string" &&
      (BANNER_CTA_POSITIONS as readonly string[]).includes(record.cta_position.trim())
    ) {
      cta_position = record.cta_position.trim();
    } else {
      throw new Error(
        `parseBannerAnalysis: cta_position 必须为 ${BANNER_CTA_POSITIONS.join(" / ")} 之一或 null`
      );
    }
  }

  // 5. text_image_ratio: 必须在枚举内
  if (
    typeof record.text_image_ratio !== "string" ||
    !(BANNER_TEXT_IMAGE_RATIOS as readonly string[]).includes(record.text_image_ratio.trim())
  ) {
    throw new Error(
      `parseBannerAnalysis: text_image_ratio 必须为 ${BANNER_TEXT_IMAGE_RATIOS.join(" / ")} 之一`
    );
  }
  const text_image_ratio = record.text_image_ratio.trim();

  // 6. seasonal_cues: 只保留枚举内标签（图片证据之外的标签由 Prompt 规则约束，此处不复核来源）
  if (!Array.isArray(record.seasonal_cues)) {
    throw new Error("parseBannerAnalysis: seasonal_cues 必须是数组");
  }
  const seasonal_cues = record.seasonal_cues
    .filter((cue): cue is string => typeof cue === "string")
    .map((cue) => cue.trim().toLowerCase())
    .filter((cue): cue is (typeof BANNER_SEASONAL_CUES)[number] =>
      (BANNER_SEASONAL_CUES as readonly string[]).includes(cue)
    );

  return {
    dominant_colors,
    composition,
    cta_presence,
    cta_position,
    text_image_ratio,
    seasonal_cues,
  };
}
