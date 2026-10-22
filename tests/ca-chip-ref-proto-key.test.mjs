import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { deferred, flushPromises } from "./source-module.mjs";

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const detailRegions = (dom, id) => descendants(dom.document, (node) => node.getAttribute("id") === id);

function chipRefMap(chip, ContentAnalysis, key) {
  // 与 propsOf 一样只读 React 挂载信息，检查真实 useRef，不改写组件或手工调用 ref。
  let fiber = chip[Object.keys(chip).find((key) => key.startsWith("__reactFiber$"))];
  while (fiber && fiber.type !== ContentAnalysis) fiber = fiber.return;
  assert.ok(fiber, "应找到真实挂载的 ContentAnalysis");
  const maps = [];
  for (let hook = fiber.memoizedState; hook; hook = hook.next) {
    if (hook.memoizedState?.current instanceof Map) maps.push(hook.memoizedState.current);
  }
  assert.equal(maps.length, 2, "两套 chip ref 字典都应使用 Map");
  const matches = maps.filter((map) => map.get(key) === chip);
  assert.equal(matches.length, 1, "对应 Map 应保存原 chip DOM 引用");
  return matches[0];
}

function assertPrototypes(refs, objectPrototype) {
  assert.equal(Object.getPrototypeOf(refs), Map.prototype, "任意 key 都不应改写 ref Map 的原型");
  assert.equal(Object.hasOwn(refs, "__proto__"), false, "key 应作为 Map 条目保存");
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), objectPrototype, "Object.prototype 不应被污染");
}

async function mountContentAnalysis(t, { tactic = "urgency", term = "__proto__" } = {}) {
  const objectPrototype = Object.getOwnPropertyDescriptors(Object.prototype);
  const dom = await mountDOM(t);
  const email = {
    market: "US", brand: "Halara", date: "2026-10-01", day_seq: 0,
    subject: "Last chance: save 20% on a coat", preheader: "Shop today", banner_url: null,
  };
  const request = deferred();
  const overrides = {};
  const graph = sourceGraph({ overrides });
  // 仅替换邮件数据与请求边界，保留真实校验、聚合、hook、组件与 callback ref 生命周期。
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
        tactics: [tactic], discount_framing: "20%", length_chars: email.subject.length,
        emoji_count: 0, cta_verbs: [], personalization: false,
        trend_terms: [{ term, category: "fashion" }],
      },
    }]);
    await flushPromises();
  });

  const chipFor = (headingKey) => {
    const heading = descendants(dom.container, (node) =>
      node.nodeName === "H3" && node.textContent === locale.translate(headingKey))[0];
    assert.ok(heading, "应挂载真实分析分布区");
    const buttons = descendants(heading.parentNode, (node) => node.nodeName === "BUTTON");
    assert.equal(buttons.length, 1, "应挂载样本对应的唯一 chip");
    return buttons[0];
  };
  const tacticChip = chipFor("caTacticsHeading");
  const trendChip = chipFor("caTrendHeading");
  return {
    dom, locale, email, objectPrototype, tacticChip, trendChip,
    tacticRefs: chipRefMap(tacticChip, ContentAnalysis, tactic),
    trendRefs: chipRefMap(trendChip, ContentAnalysis, term.toLowerCase()),
  };
}

async function collapseDetail(dom, locale, chip, id, subject) {
  assert.equal(chip.getAttribute("aria-expanded"), "false");
  await act(() => propsOf(chip).onClick());
  const regions = detailRegions(dom, id);
  assert.equal(regions.length, 1, "应挂载唯一的详情区域");
  assert.ok(regions[0].textContent.includes(subject));
  assert.equal(chip.getAttribute("aria-expanded"), "true");
  assert.equal(chip.getAttribute("aria-controls"), id);
  const buttons = descendants(regions[0], (node) =>
    node.nodeName === "BUTTON" && node.textContent === locale.translate("efCollapse"));
  assert.equal(buttons.length, 1, "详情内应有唯一的收起按钮");
  buttons[0].focus();
  assert.equal(dom.document.activeElement, buttons[0]);
  await act(() => propsOf(buttons[0]).onClick());
  assert.equal(detailRegions(dom, id).length, 0, "收起后应卸载详情");
  assert.equal(chip.getAttribute("aria-expanded"), "false");
  assert.equal(dom.document.activeElement, chip, "焦点应回到原 chip DOM 节点");
}

test("__proto__ 趋势词真实渲染，卸载后 Map 无残留且原型不变", async (t) => {
  const { dom, trendChip, trendRefs, objectPrototype } = await mountContentAnalysis(t);
  assert.ok(descendants(trendChip, (node) => node.nodeName === "SPAN" && node.textContent === "__proto__").length);
  assert.equal(trendRefs.size, 1);
  assert.equal(trendRefs.has("__proto__"), true);
  assert.equal(trendRefs.get("__proto__"), trendChip);
  assertPrototypes(trendRefs, objectPrototype);

  await dom.render(null);
  assert.equal(dom.container.contains(trendChip), false, "chip 应实际卸载");
  assert.equal(trendRefs.has("__proto__"), false);
  assert.equal(trendRefs.get("__proto__"), undefined);
  assert.equal(trendRefs.size, 0, "卸载后不应残留任何按钮引用");
  assertPrototypes(trendRefs, objectPrototype);
});

test("__proto__ 趋势词收起详情后焦点回到原 chip", async (t) => {
  const { dom, locale, email, trendChip, trendRefs, objectPrototype } = await mountContentAnalysis(t);
  await collapseDetail(dom, locale, trendChip, "ca-trend-detail", email.subject);
  assert.equal(trendRefs.size, 1);
  assert.equal(trendRefs.get("__proto__"), trendChip);
  assertPrototypes(trendRefs, objectPrototype);
});

test("策略 Map 同样可写入和删除 __proto__，收起后焦点返回且与趋势 Map 独立", async (t) => {
  const { dom, locale, email, tacticChip, trendChip, tacticRefs, trendRefs, objectPrototype } =
    await mountContentAnalysis(t, { tactic: "__proto__" });
  assert.notEqual(tacticRefs, trendRefs, "两套 Map 应独立保存同名 key");
  assert.equal(tacticRefs.size, 1);
  assert.equal(tacticRefs.has("__proto__"), true);
  assert.equal(tacticRefs.get("__proto__"), tacticChip);
  assert.equal(trendRefs.get("__proto__"), trendChip);
  assertPrototypes(tacticRefs, objectPrototype);
  await collapseDetail(dom, locale, tacticChip, "ca-tactic-detail", email.subject);
  assert.equal(tacticRefs.get("__proto__"), tacticChip);

  await dom.render(null);
  assert.equal(dom.container.contains(tacticChip), false, "策略 chip 应实际卸载");
  for (const refs of [tacticRefs, trendRefs]) {
    assert.equal(refs.has("__proto__"), false);
    assert.equal(refs.get("__proto__"), undefined);
    assert.equal(refs.size, 0, "两套 Map 都应清理已卸载按钮");
    assertPrototypes(refs, objectPrototype);
  }
});
