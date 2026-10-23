import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

function installQuerySelector(document) {
  document.querySelector = (selector) => {
    if (selector === '[role="progressbar"]') {
      return descendants(document, (node) => node.getAttribute("role") === "progressbar")[0] ?? null;
    }
    return null;
  };
}

async function mountContentAnalysis(t) {
  const dom = await mountDOM(t);
  installQuerySelector(dom.document);
  const email = {
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: 0,
    subject: "Last chance: save 20% on a coat", preheader: "Shop today", banner_url: "https://img.test/banner.jpg",
  };
  const overrides = {};
  const graph = sourceGraph({ overrides });
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => ({
      status: "ready", error: null, emails: [email], retry() {}, meta: { dataSource: "supabase" },
    }),
  };
  overrides["email-content-analysis.ts"] = {
    ...graph.load("email-content-analysis.ts"),
    fetchContentAnalysis: async () => [
      {
        market: email.market, brand: email.brand, sent_date: email.date, day_seq: email.day_seq,
        analysis_type: "subject", status: "success", is_stale: false,
        analyzed_at: "2026-10-02T00:00:00Z",
        result: {
          tactics: ["urgency"], discount_framing: "20%", length_chars: email.subject.length,
          emoji_count: 0, cta_verbs: [], personalization: false, trend_terms: [],
        },
      },
      {
        market: email.market, brand: email.brand, sent_date: email.date, day_seq: email.day_seq,
        analysis_type: "banner", status: "success", is_stale: false,
        analyzed_at: "2026-10-02T00:00:00Z",
        result: {
          dominant_colors: ["white"], composition: "text-poster", cta_presence: true,
          cta_position: "bottom", text_image_ratio: "balanced", seasonal_cues: [],
        },
      },
    ],
  };
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage("zh");
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  await dom.render(h(ContentAnalysis, {
    site: "US", window: { start: "2026-10-01", end: "2026-10-21" },
  }));
  await act(async () => {
    await flushPromises();
  });
  return { dom, locale };
}

function distributionItems(dom, headingText) {
  const heading = descendants(dom.container, (node) => node.nodeName === "H3" && node.textContent === headingText)[0];
  assert.ok(heading, `应挂载 ${headingText} 分布区`);
  return descendants(heading.parentNode, (node) => node.getAttribute("aria-hidden") === "true").map((bar) => bar.parentNode);
}

test("分布区不再暴露 progressbar 语义", async (t) => {
  const { dom, locale } = await mountContentAnalysis(t);
  const composition = distributionItems(dom, locale.translate("caCompositionHeading"));
  assert.ok(composition.length > 0, "应挂载构图分布条");
  assert.equal(dom.document.querySelector('[role="progressbar"]'), null);
});

test("视觉条隐藏但同一分布项文本仍可读", async (t) => {
  const { dom, locale } = await mountContentAnalysis(t);
  const heading = descendants(dom.container, (node) => node.nodeName === "H3" && node.textContent === locale.translate("caCompositionHeading"))[0];
  assert.ok(heading);
  const item = descendants(heading.parentNode, (node) => node.getAttribute("aria-hidden") === "true")[0];
  assert.ok(item, "视觉条容器应带 aria-hidden=true");
  const row = item.parentNode;
  assert.ok(row.textContent.includes(locale.translate("caLayTextPoster")), "文本行应包含分类名");
  assert.ok(row.textContent.includes("100%"), "文本行应包含百分比");
});

test("策略按钮内的分布条同样不暴露 progressbar 语义", async (t) => {
  const { dom, locale } = await mountContentAnalysis(t);
  const heading = descendants(dom.container, (node) => node.nodeName === "H3" && node.textContent === locale.translate("caTacticsHeading"))[0];
  assert.ok(heading, "应挂载策略分布区");
  const tacticButton = descendants(heading.parentNode, (node) => node.nodeName === "BUTTON")[0];
  assert.ok(tacticButton, "应挂载可展开的策略项");
  assert.equal(descendants(tacticButton, (node) => node.getAttribute("role") === "progressbar").length, 0, "策略按钮内不应有 progressbar");
  assert.ok(descendants(tacticButton, (node) => node.getAttribute("aria-hidden") === "true").length > 0, "策略按钮内视觉条应 aria-hidden");
  await act(() => propsOf(tacticButton).onClick());
  const detail = descendants(dom.document, (node) => node.getAttribute("id") === "ca-tactic-detail")[0];
  assert.ok(detail, "应挂载策略详情展开态");
  assert.equal(descendants(detail, (node) => node.getAttribute("role") === "progressbar").length, 0);
});
