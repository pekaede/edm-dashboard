import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

const coverageKeys = ["caCovCollected", "caCovSubject", "caCovBanner"];

async function mountCoverage(t, language) {
  const dom = await mountDOM(t);
  const email = {
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: 0,
    subject: "Last chance: save 20% on a coat", preheader: "Shop today", banner_url: "https://img.test/banner.jpg",
  };
  const request = deferred();
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅替换邮件数据和分析请求边界，保留真实 ContentAnalysis、hook 与聚合逻辑。
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => ({
      status: "ready", error: null, emails: [email], retry() {}, meta: { dataSource: "supabase" },
    }),
  };
  overrides["email-content-analysis.ts"] = {
    ...graph.load("email-content-analysis.ts"),
    fetchContentAnalysis: () => request.promise,
  };
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage(language);
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  await dom.render(h(ContentAnalysis, {
    site: "US", window: { start: "2026-10-01", end: "2026-10-21" },
  }));
  await act(async () => {
    request.resolve([]);
    await flushPromises();
  });
  return { dom, locale };
}

function coverageMetricContainer(dom, locale) {
  const labels = coverageKeys.map((key) => locale.translate(key));
  const matches = descendants(dom.container, (node) => {
    if (node.nodeName !== "DIV") return false;
    const classes = new Set((node.getAttribute("class") ?? "").split(/\s+/));
    return classes.has("text-xs") && !classes.has("rounded-2xl") &&
      labels.every((label) => node.textContent.includes(label));
  });
  assert.equal(matches.length, 1, "应找到唯一的头部覆盖率指标容器");
  return { node: matches[0], labels };
}

test("中文头部覆盖率指标容器允许换行", async (t) => {
  const { dom, locale } = await mountCoverage(t, "zh");
  const { node } = coverageMetricContainer(dom, locale);
  assert.ok((node.getAttribute("class") ?? "").split(/\s+/).includes("flex-wrap"));
});

test("英文头部覆盖率指标容器允许换行", async (t) => {
  const { dom, locale } = await mountCoverage(t, "en");
  const { node } = coverageMetricContainer(dom, locale);
  assert.ok((node.getAttribute("class") ?? "").split(/\s+/).includes("flex-wrap"));
});

test("头部覆盖率三处指标标签仍按当前语言渲染", async (t) => {
  const { dom, locale } = await mountCoverage(t, "zh");
  const { node, labels } = coverageMetricContainer(dom, locale);
  for (const label of labels) assert.ok(node.textContent.includes(label), `应渲染指标标签 ${label}`);
});
