import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

test("策略按钮关联唯一的详情区域，未选中时不挂载详情", async (t) => {
  const dom = await mountDOM(t);
  const email = {
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: 0,
    subject: "Last chance: save 20%", preheader: "Shop today", banner_url: null,
  };
  const tactics = ["urgency", "discount"];
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
        tactics, discount_framing: "20%", length_chars: email.subject.length,
        emoji_count: 0, cta_verbs: [], personalization: false, trend_terms: [],
      },
    }]);
    await flushPromises();
  });

  const heading = descendants(dom.container, (node) =>
    node.nodeName === "H3" && node.textContent === locale.translate("caTacticsHeading"))[0];
  assert.ok(heading, "应挂载真实策略分布区");
  const buttons = descendants(heading.parentNode, (node) => node.nodeName === "BUTTON");
  assert.equal(buttons.length, tactics.length, "应渲染每个策略按钮");
  for (const button of buttons) {
    assert.equal(button.getAttribute("aria-controls"), "ca-tactic-detail");
    assert.equal(button.getAttribute("aria-expanded"), "false");
  }
  const detailRegions = () => descendants(dom.document, (node) =>
    node.getAttribute("id") === "ca-tactic-detail");
  assert.equal(detailRegions().length, 0, "未选中时不应挂载详情区域");

  for (const selected of buttons) {
    await act(() => propsOf(selected).onClick());
    const regions = detailRegions();
    assert.equal(regions.length, 1, "document 中详情 id 必须唯一");
    assert.equal(regions[0].nodeName, "DIV");
    assert.ok(regions[0].textContent.includes(email.subject), "关联区域应包含策略详情");
    for (const button of buttons) {
      assert.equal(button.getAttribute("aria-controls"), "ca-tactic-detail");
      assert.equal(button.getAttribute("aria-expanded"), String(button === selected));
    }
  }

  await act(() => propsOf(buttons.at(-1)).onClick());
  assert.equal(detailRegions().length, 0, "取消选中后应卸载详情区域");
  for (const button of buttons) assert.equal(button.getAttribute("aria-expanded"), "false");
});
