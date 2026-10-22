import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const detailRegions = (dom, id) => descendants(dom.document, (node) => node.getAttribute("id") === id);
const collapseButton = (region, locale) => {
  const buttons = descendants(region, (node) =>
    node.nodeName === "BUTTON" && node.textContent === locale.translate("efCollapse"));
  assert.equal(buttons.length, 1, "详情内应有唯一的收起按钮");
  return buttons[0];
};

async function mountContentAnalysis(t) {
  const dom = await mountDOM(t);
  const email = {
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: 0,
    subject: "Last chance: save 20% on a coat", preheader: "Shop today", banner_url: null,
  };
  const request = deferred();
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅替换邮件数据与请求边界，保留真实聚合、hook、组件与状态更新。
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
  await locale.default.changeLanguage("zh");
  const { ContentAnalysis } = graph.load("components/ContentAnalysis.tsx");
  await dom.render(h(ContentAnalysis, {
    site: "US", window: { start: "2026-10-01", end: "2026-10-21" },
  }));
  await act(async () => {
    request.resolve([{
      market: email.market, brand: email.brand, sent_date: email.date, day_seq: email.day_seq,
      analysis_type: "subject", status: "success", is_stale: false,
      analyzed_at: "2026-10-02T00:00:00Z",
      result: {
        tactics: ["urgency"], discount_framing: "20%", length_chars: email.subject.length,
        emoji_count: 0, cta_verbs: [], personalization: false,
        trend_terms: [{ term: "coat", category: "fashion" }],
      },
    }]);
    await flushPromises();
  });

  const chipFor = (headingKey) => {
    const heading = descendants(dom.container, (node) =>
      node.nodeName === "H3" && node.textContent === locale.translate(headingKey))[0];
    assert.ok(heading, "应挂载真实分析分布区");
    const buttons = descendants(heading.parentNode, (node) => node.nodeName === "BUTTON");
    assert.equal(buttons.length, 1, "应挂载样本对应的唯一词条按钮");
    return buttons[0];
  };
  return { dom, locale, email, tacticChip: chipFor("caTacticsHeading"), trendChip: chipFor("caTrendHeading") };
}

test("策略详情收起后卸载，焦点回到原策略按钮", async (t) => {
  const { dom, locale, email, tacticChip } = await mountContentAnalysis(t);
  assert.equal(detailRegions(dom, "ca-tactic-detail").length, 0);
  assert.equal(tacticChip.getAttribute("aria-expanded"), "false");
  await act(() => propsOf(tacticChip).onClick());

  const regions = detailRegions(dom, "ca-tactic-detail");
  assert.equal(regions.length, 1, "document 中策略详情 id 必须唯一");
  assert.equal(regions[0].nodeName, "DIV");
  assert.ok(regions[0].textContent.includes(email.subject));
  assert.equal(tacticChip.getAttribute("aria-controls"), "ca-tactic-detail");
  assert.equal(tacticChip.getAttribute("aria-expanded"), "true");
  const collapse = collapseButton(regions[0], locale);
  collapse.focus();
  assert.equal(dom.document.activeElement, collapse, "模拟键盘用户从收起按钮激活");
  await act(() => propsOf(collapse).onClick());

  assert.equal(detailRegions(dom, "ca-tactic-detail").length, 0, "收起后应卸载策略详情");
  assert.equal(tacticChip.getAttribute("aria-expanded"), "false");
  assert.equal(dom.document.activeElement, tacticChip, "焦点应回到原策略按钮 DOM 节点");
});

test("趋势详情有唯一关联 id，收起后焦点回到原趋势词按钮", async (t) => {
  const { dom, locale, email, trendChip } = await mountContentAnalysis(t);
  assert.equal(detailRegions(dom, "ca-trend-detail").length, 0);
  assert.equal(trendChip.getAttribute("aria-expanded"), "false");
  await act(() => propsOf(trendChip).onClick());

  const regions = detailRegions(dom, "ca-trend-detail");
  assert.equal(regions.length, 1, "document 中趋势详情 id 必须唯一");
  assert.equal(regions[0].nodeName, "DIV");
  assert.ok(regions[0].textContent.includes(email.subject));
  assert.equal(trendChip.getAttribute("aria-controls"), regions[0].getAttribute("id"));
  assert.equal(trendChip.getAttribute("aria-expanded"), "true");
  const collapse = collapseButton(regions[0], locale);
  collapse.focus();
  assert.equal(dom.document.activeElement, collapse, "模拟键盘用户从收起按钮激活");
  await act(() => propsOf(collapse).onClick());

  assert.equal(detailRegions(dom, "ca-trend-detail").length, 0, "收起后应卸载趋势详情");
  assert.equal(trendChip.getAttribute("aria-expanded"), "false");
  assert.equal(dom.document.activeElement, trendChip, "焦点应回到原趋势词按钮 DOM 节点");
});

test("趋势词按钮连续点击可选中再取消选中", async (t) => {
  const { dom, trendChip } = await mountContentAnalysis(t);
  await act(() => propsOf(trendChip).onClick());
  assert.equal(trendChip.getAttribute("aria-expanded"), "true");
  assert.equal(detailRegions(dom, "ca-trend-detail").length, 1);

  await act(() => propsOf(trendChip).onClick());
  assert.equal(trendChip.getAttribute("aria-expanded"), "false");
  assert.equal(detailRegions(dom, "ca-trend-detail").length, 0, "取消选中后应卸载趋势详情");
});
