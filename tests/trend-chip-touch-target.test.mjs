import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];

async function mountTrendChips(t) {
  const dom = await mountDOM(t);
  const examples = [
    { subject: "Cozy fall layers", trend: { term: "Fall", category: "seasonal" } },
    { subject: "Your Pilates edit", trend: { term: "Pilates", category: "fashion" } },
  ];
  const emails = examples.map(({ subject }, day_seq) => ({
    market: "US", brand: "Halara", date: "2026-10-01", day_seq,
    subject, preheader: null, banner_url: null,
  }));
  const request = deferred();
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅替换邮件数据和分析请求边界，保留真实聚合、hook、组件与状态更新。
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => ({
      status: "ready", error: null, emails, retry() {}, meta: { dataSource: "supabase" },
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
    request.resolve(emails.map((email, index) => ({
      market: email.market, brand: email.brand, sent_date: email.date, day_seq: email.day_seq,
      analysis_type: "subject", status: "success", is_stale: false,
      analyzed_at: "2026-10-02T00:00:00Z",
      result: {
        tactics: [], discount_framing: null, length_chars: email.subject.length,
        emoji_count: 0, cta_verbs: [], personalization: false,
        trend_terms: [examples[index].trend],
      },
    })));
    await flushPromises();
  });

  const heading = descendants(dom.container, (node) =>
    node.nodeName === "H3" && node.textContent === locale.translate("caTrendHeading"))[0];
  assert.ok(heading, "应挂载真实趋势词区");
  const section = heading.parentNode;
  const buttons = descendants(section, (node) => node.nodeName === "BUTTON");
  assert.equal(buttons.length, examples.length, "应渲染每个趋势词按钮");
  const chips = examples.map(({ trend }) => {
    const button = buttons.find((node) => descendants(node, (child) =>
      child.nodeName === "SPAN" && child.textContent === trend.term).length > 0);
    assert.ok(button, `应渲染趋势词 ${trend.term}`);
    return button;
  });
  return { section, chips, examples };
}

test("趋势词按钮包含伪元素触控命中区类", async (t) => {
  const { chips } = await mountTrendChips(t);
  // mounted-dom 不计算 CSS 布局或伪元素，故检查真实挂载节点的类名 token，不断言像素。
  for (const chip of chips) {
    const tokens = new Set(chip.getAttribute("class").split(/\s+/));
    for (const token of ["relative", "before:absolute", "before:-inset-1", 'before:content-[""]']) {
      assert.ok(tokens.has(token), `趋势词按钮应包含 ${token}`);
    }
  }
});

test("趋势词按钮点击后可选中、切换并再次点击取消选中", async (t) => {
  const { section, chips, examples } = await mountTrendChips(t);
  const expanded = () => chips.map((chip) => chip.getAttribute("aria-expanded"));
  const detailItems = () => descendants(section, (node) => node.nodeName === "LI");
  assert.deepEqual(expanded(), ["false", "false"]);
  assert.equal(detailItems().length, 0, "未选中时不应挂载邮件详情");

  for (const [index, chip] of chips.entries()) {
    await act(() => propsOf(chip).onClick());
    assert.deepEqual(expanded(), chips.map((_, i) => String(i === index)));
    const items = detailItems();
    assert.equal(items.length, 1, "只应展示选中趋势词的邮件");
    assert.ok(items[0].textContent.includes(examples[index].subject));
  }

  await act(() => propsOf(chips.at(-1)).onClick());
  assert.deepEqual(expanded(), ["false", "false"]);
  assert.equal(detailItems().length, 0, "取消选中后应卸载邮件详情");
});
