import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const labels = {
  caTacticsHeading: [
    ["urgency", "caTacUrgency"], ["discount", "caTacDiscount"],
    ["social_proof", "caTacSocialProof"], ["newness", "caTacNewness"],
    ["curiosity", "caTacCuriosity"], ["personalization", "caTacPersonalization"],
    ["benefit", "caTacBenefit"], ["exclusivity", "caTacExclusivity"],
    ["seasonal", "caTacSeasonal"],
  ],
  caCompositionHeading: [
    ["text-poster", "caLayTextPoster"], ["fashion-editorial", "caLayFashionEditorial"],
    ["single-model", "caLaySingleModel"], ["multi-product", "caLayMultiProduct"],
    ["group-shot", "caLayGroupShot"], ["collage", "caLayCollage"],
    ["detail-closeup", "caLayDetailCloseup"], ["lifestyle-scene", "caLayLifestyleScene"],
  ],
  caRatioHeading: [
    ["text-heavy", "caRatioTextHeavy"], ["balanced", "caRatioBalanced"],
    ["image-heavy", "caRatioImageHeavy"],
  ],
  caCtaPlacementHeading: [
    ["top", "caCtaTop"], ["center", "caCtaCenter"], ["bottom", "caCtaBottom"],
    ["bottom-right", "caCtaBottomRight"], ["none", "caCtaNone"],
  ],
  caTrendHeading: [
    ["fashion", "caTrendFashion"], ["trend", "caTrendTrend"],
    ["hotspot", "caTrendHotspot"], ["seasonal", "caTrendSeasonal"],
    ["marketing", "caTrendMarketing"],
  ],
};
const fallbackKeys = ["constructor", "__proto__", "unknown-tactic"];
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

async function mountContentAnalysis(t, language) {
  const dom = await mountDOM(t);
  const emails = labels.caCompositionHeading.map((_, index) => ({
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: index,
    subject: `Save on style ${index}`, preheader: "Shop today", banner_url: "https://img.test/banner.jpg",
  }));
  const rows = emails.flatMap((email, index) => {
    const base = {
      market: email.market, brand: email.brand, sent_date: email.date, day_seq: email.day_seq,
      status: "success", is_stale: false, analyzed_at: "2026-10-02T00:00:00Z",
    };
    const position = labels.caCtaPlacementHeading[index % labels.caCtaPlacementHeading.length][0];
    return [
      {
        ...base, analysis_type: "subject",
        result: {
          tactics: index === 0 ? [...labels.caTacticsHeading.map(([key]) => key), ...fallbackKeys] : [],
          discount_framing: null, length_chars: email.subject.length, emoji_count: 0,
          cta_verbs: [], personalization: false,
          trend_terms: index === 0
            ? labels.caTrendHeading.map(([category]) => ({ term: `term-${category}`, category })) : [],
        },
      },
      {
        ...base, analysis_type: "banner",
        result: {
          dominant_colors: ["white"], composition: labels.caCompositionHeading[index][0],
          cta_presence: position !== "none", cta_position: position === "none" ? null : position,
          text_image_ratio: labels.caRatioHeading[index % labels.caRatioHeading.length][0], seasonal_cues: [],
        },
      },
    ];
  });
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅替换邮件与请求边界，保留真实校验、聚合、翻译及组件渲染。
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => ({
      status: "ready", error: null, emails, retry() {}, meta: { dataSource: "supabase" },
    }),
  };
  overrides["email-content-analysis.ts"] = {
    ...graph.load("email-content-analysis.ts"),
    fetchContentAnalysis: async () => rows,
  };
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  await dom.render(h(ContentAnalysis, {
    site: "US", window: { start: "2026-10-01", end: "2026-10-21" },
  }));
  await act(async () => { await flushPromises(); });
  return { dom, locale, dictionary: graph.load(`i18n/locales/${language}.json`) };
}

// 全量测试共享 i18n 单例，语言循环以 zh 收尾。
for (const language of ["en", "zh"]) {
  test(`分析标签保留合法翻译，原型键和未知键原样回落（${language}）`, async (t) => {
    const { dom, locale, dictionary } = await mountContentAnalysis(t, language);
    let tacticButtons;
    for (const [headingKey, entries] of Object.entries(labels)) {
      const heading = descendants(dom.container, (node) =>
        node.nodeName === "H3" && node.textContent === locale.translate(headingKey))[0];
      assert.ok(heading, `应挂载 ${headingKey}`);
      const section = heading.parentNode;
      const expected = entries.map(([, dictionaryKey]) => dictionary[dictionaryKey]);
      let rendered;
      if (headingKey === "caTrendHeading") {
        rendered = descendants(section, (node) => node.nodeName === "BUTTON")
          .map((button) => button.firstChild.textContent);
      } else {
        const labelNodes = descendants(section, (node) => node.nodeName === "SPAN" && node.getAttribute("title") !== null);
        rendered = labelNodes.map((node) => node.textContent);
        assert.deepEqual(labelNodes.map((node) => node.getAttribute("title")), rendered, "title 与可见标签应逐字一致");
      }
      if (headingKey === "caTacticsHeading") {
        expected.push(...fallbackKeys);
        tacticButtons = descendants(section, (node) => node.nodeName === "BUTTON");
      }
      assert.deepEqual(rendered.sort(), expected.sort(), `${headingKey} 标签必须逐字匹配`);
    }

    // 展开标题也使用 labelText，已知策略与回落策略都必须保持原文。
    for (const expected of [dictionary.caTacUrgency, ...fallbackKeys]) {
      const chip = tacticButtons.find((button) => descendants(button, (node) =>
        node.nodeName === "SPAN" && node.getAttribute("title") === expected).length > 0);
      assert.ok(chip, `应找到 ${expected} 策略按钮`);
      await act(() => propsOf(chip).onClick());
      const detail = descendants(dom.container, (node) => node.getAttribute("id") === "ca-tactic-detail")[0];
      assert.ok(detail, "应展开策略详情");
      const title = descendants(detail, (node) => node.nodeName === "P")[0];
      assert.equal(title.firstChild.textContent, expected, "展开标题必须逐字匹配");
    }
  });
}
