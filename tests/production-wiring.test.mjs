// 挂载级测试：真实 createRoot/act + 完整生产模块；DOM 限制见 mounted-dom.mjs。
// 没有手工调用私有刷新函数、传 force 或伪造邮件 refresh 通知。
// URL 测试加载 App.Dashboard 的真实 Provider↔hook 同步 effects；仅旁路无关视图。
// 不验证布局、滚动恢复、浏览器原生历史栈；这些需要可安装 DOM 库或可启动浏览器的环境。
import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { aggregateThreeWeek } from "../src/three-week-aggregation.ts";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph, mountedClock } from "./mounted-source.mjs";
import { emailRow, liveEnv, mountedBackend } from "./mounted-backend.mjs";
import { flushPromises } from "./source-module.mjs";
import { wiringMutations } from "./wiring-mutations.mjs";

const selectedMutation = process.env.EDM_WIRING_MUTATION;
const mutation = selectedMutation ? wiringMutations.find((item) => item.name === selectedMutation) : undefined;
assert.ok(!selectedMutation || mutation, `未知变异 ${selectedMutation}`);

async function settle(callback = () => {}) {
  await act(async () => { await callback(); await flushPromises(); });
}

async function liveFixture(t, { overrides = {}, hash } = {}) {
  const dom = await mountDOM(t, hash);
  const clock = mountedClock();
  const backend = mountedBackend();
  const graph = sourceGraph({ env: liveEnv, globals: { ...clock.globals, fetch: backend.fetch }, overrides, mutation });
  const locale = graph.load("i18n/index.tsx");
  await locale.default.changeLanguage("zh");
  return { ...dom, graph, clock, backend };
}

function counts(rounds) {
  return { "schema:GET": rounds, "emails:HEAD": rounds * 2, "emails:GET": rounds,
    "analysis:HEAD": rounds * 2, "analysis:GET": rounds };
}

it("J1：同一挂载 Provider 在真实邮件刷新、reset/retry 和站点切换后更新并共享聚合", async (t) => {
  const overrides = {};
  let calculations = 0;
  overrides["three-week-aggregation.ts"] = {
    ...await import("../src/three-week-aggregation.ts"),
    aggregateThreeWeek(...args) { calculations += 1; return aggregateThreeWeek(...args); },
  };
  const f = await liveFixture(t, { overrides });
  const site = f.graph.load("site-data.tsx");
  const seen = [];
  let selection;
  function Consumer({ index }) {
    selection = site.useSiteSelection();
    seen[index] = { emails: site.useSiteEmails(), aggregate: site.useSiteThreeWeekData().data };
    return h("output", null, seen[index].aggregate?.total ?? "等待数据");
  }
  const release = f.backend.hold("emails");
  await f.render(h(site.SiteProvider, null, h(Consumer, { index: 0 }), h(Consumer, { index: 1 })));
  assert.equal(seen[0].emails.status, "loading");
  assert.equal(seen[0].aggregate, null);
  assert.equal(calculations, 0);
  await settle(release);
  assert.equal(seen[0].emails.status, "ready");
  assert.ok(seen[0].aggregate, "loading→ready 必须建立 Provider 聚合");
  assert.equal(seen[0].aggregate.total, 1, "loading→ready 必须使 Provider 的 useMemo 失效");
  assert.equal(calculations, 1);
  assert.strictEqual(seen[0].emails, seen[1].emails);
  assert.strictEqual(seen[0].aggregate, seen[1].aggregate);
  const oldUS = seen[0].aggregate;
  await settle(() => selection.setMarket("UK"));
  const oldUK = seen[0].aggregate;
  assert.equal(oldUK.total, 1);
  await settle(() => selection.setMarket("US"));
  assert.strictEqual(seen[0].aggregate, oldUS);
  assert.equal(calculations, 2, "切回站点复用该版本聚合");
  await settle(() => { selection.setFilter("theme", "price"); selection.setComparisonMarkets(["US", "FR"]); });
  assert.equal(calculations, 2, "筛选/对比选择不应重复聚合");

  f.backend.setEmails([emailRow(0), emailRow(1, "UK"), emailRow(2), emailRow(3, "UK"), emailRow(4, "UK")]);
  await settle(() => f.window.dispatchEvent(new Event("online")));
  assert.equal(seen[0].aggregate.total, 2, "ready→ready 邮件刷新不能沿用旧聚合");
  assert.notStrictEqual(seen[0].aggregate, oldUS);
  assert.equal(calculations, 3);
  await settle(() => selection.setMarket("UK"));
  assert.equal(seen[0].aggregate.total, 3);
  assert.notStrictEqual(seen[0].aggregate, oldUK, "尚未访问的站点缓存也应失效");
  assert.equal(calculations, 4);
  await settle(() => selection.setMarket("US"));
  assert.equal(calculations, 4);

  const releaseRetry = f.backend.hold("emails");
  await settle(() => seen[0].emails.retry());
  assert.equal(seen[0].emails.status, "loading");
  assert.equal(seen[0].aggregate, null, "reset 期间不得向消费者泄漏旧聚合");
  assert.equal(calculations, 4);
  await settle(releaseRetry);
  assert.equal(seen[0].aggregate.total, 2);
  assert.strictEqual(seen[0].aggregate, seen[1].aggregate);
  assert.equal(calculations, 5);
});

it("J1-status：同一邮件引用的非 ready→ready 切换会清空并重建已挂载 Provider 聚合", async (t) => {
  // 生产成功刷新会创建新数组；为单独检验 status 依赖，只在数据源边界提供外部 store。
  // Provider/useMemo/缓存/聚合/多个消费者仍全部真实执行，避免 emails 依赖掩盖 status 缺失。
  const { useSyncExternalStore } = await import("react");
  const dom = await mountDOM(t);
  const emails = [{ brand: "Zara", date: "2026-10-09", theme: "new", keywords: [], market: "US", day_seq: 0, source_index: 0 }];
  let snapshot = { emails, status: "ready", total: 1, error: null, retry() {}, meta: { dataSource: "supabase", total: 1 } };
  const listeners = new Set();
  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
  let calculations = 0;
  const overrides = {
    "three-week-aggregation.ts": { aggregateThreeWeek(...args) { calculations += 1; return aggregateThreeWeek(...args); } },
  };
  const graph = sourceGraph({ mutation, overrides });
  overrides["email-data.ts"] = {
    ...graph.load("email-data.ts"),
    useExtendedEmails: () => useSyncExternalStore(subscribe, () => snapshot),
  };
  const site = graph.load("site-data.tsx");
  let result;
  function Consumer() { result = site.useSiteThreeWeekData(); return null; }
  await dom.render(h(site.SiteProvider, null, h(Consumer), h(Consumer)));
  assert.equal(calculations, 1);
  for (const status of ["loading", "error", "incomplete"]) {
    const previous = result.data;
    await settle(() => { snapshot = { ...snapshot, status }; listeners.forEach((listener) => listener()); });
    assert.equal(result.data, null, `${status} 不得泄漏旧聚合`);
    const beforeReady = calculations;
    await settle(() => { snapshot = { ...snapshot, status: "ready" }; listeners.forEach((listener) => listener()); });
    assert.equal(result.data.total, 1);
    assert.notStrictEqual(result.data, previous);
    assert.equal(calculations, beforeReady + 1, "两个消费者共用一次恢复聚合");
  }
});

for (const trigger of ["timer", "online", "visibility"]) {
  it(`J2-${trigger}：生产自动刷新穿透两层邮件缓存并经真实通知刷新分析`, async (t) => {
    const f = await liveFixture(t);
    const site = f.graph.load("site-data.tsx");
    const analysis = f.graph.load("email-content-analysis-data.ts");
    let result;
    function Consumer() {
      const emails = site.useSiteEmails();
      const state = analysis.useEmailContentAnalysis({ source: "supabase", market: "US",
        start: emails.meta.windowStart, end: emails.meta.windowEnd });
      result = { emails, analysis: state };
      return null;
    }
    const releaseEmails = f.backend.hold("emails");
    const releaseAnalysis = f.backend.hold("analysis");
    await f.render(h(site.SiteProvider, null, h(Consumer), h(Consumer)));
    assert.equal(f.clock.intervals(), 1, "多个消费者只注册一个生产刷新周期");
    // interval 从挂载开始计时，缓存 TTL 从稍后完成时起算。定时回调触发时两层仍新鲜。
    await settle(() => f.clock.advance(20));
    await settle(() => { releaseEmails(); releaseAnalysis(); });
    assert.equal(result.emails.status, "ready");
    assert.equal(result.analysis.status, "ready");
    assert.deepEqual(f.backend.counts(), counts(1));
    const oldEmails = result.emails.emails;
    const oldAnalysis = result.analysis.rows;
    f.backend.setEmails([emailRow(0), emailRow(1, "UK"), emailRow(2)]);
    f.backend.setAnalysisVersion(1);
    const releaseRefreshEmails = f.backend.hold("emails");
    const releaseRefreshAnalysis = f.backend.hold("analysis");
    await settle(() => {
      if (trigger === "timer") f.clock.advance(300_000 - 20);
      else if (trigger === "online") f.window.dispatchEvent(new Event("online"));
      else {
        f.document.visibilityState = "hidden";
        f.document.dispatchEvent(new Event("visibilitychange"));
        assert.equal(f.clock.intervals(), 0);
        f.document.visibilityState = "visible";
        f.document.dispatchEvent(new Event("visibilitychange"));
      }
    });
    assert.equal(f.backend.counts()["emails:GET"], 2, "真实回调必须 force 穿透仍新鲜的 Supabase 缓存");
    assert.equal(f.backend.counts()["analysis:GET"], 2, "分析由邮件生产 refresh 通知启动本轮请求");
    assert.strictEqual(result.emails.emails, oldEmails, "后台等待期间保留成功邮件");
    assert.strictEqual(result.analysis.rows, oldAnalysis);
    let rounds = 2;
    if (trigger === "online") {
      // 同一条生产事件链还应穿透 pending，并把 force 传到分析取消/重拉分支。
      const pendingAnalysis = f.backend.calls.filter((call) => call.kind === "analysis" && call.method === "GET").at(-1);
      f.backend.setAnalysisVersion(2);
      await settle(() => f.window.dispatchEvent(new Event("online")));
      assert.equal(pendingAnalysis.signal.aborted, true, "下一轮真实刷新须取消尚未完成的分析");
      assert.equal(f.backend.counts()["emails:GET"], 3);
      assert.equal(f.backend.counts()["analysis:GET"], 3, "force 必须经通知穿透分析 pending");
      rounds = 3;
    }
    await settle(() => { releaseRefreshEmails(); releaseRefreshAnalysis(); });
    // 被 supersede 的分析请求在取消后不再发最终 HEAD；其余请求完整结算。
    assert.deepEqual(f.backend.counts(), { ...counts(rounds), "analysis:HEAD": rounds * 2 - (trigger === "online" ? 1 : 0) });
    assert.equal(result.emails.total, 2);
    assert.equal(result.analysis.rows[0].day_seq, trigger === "online" ? 2 : 1);
    assert.notStrictEqual(result.emails.emails, oldEmails);
    assert.notStrictEqual(result.analysis.rows, oldAnalysis);
    await act(() => f.root.unmount());
    assert.equal(f.clock.pending(), 0, "卸载取消生产周期与所有请求超时定时器");
    const requestsAfterUnmount = f.backend.calls.length;
    f.clock.advance(600_000);
    f.window.dispatchEvent(new Event("online"));
    f.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(f.backend.calls.length, requestsAfterUnmount, "卸载移除生产事件监听");
  });
}

it("J3：真实 JSON 模式挂载 MarketComparison 显示全部 770 封、92 天和快照窗口", async (t) => {
  const dom = await mountDOM(t);
  const clock = mountedClock();
  let networkRequests = 0;
  const graph = sourceGraph({ mutation, env: { VITE_EDM_DATA_SOURCE: "json" },
    globals: { ...clock.globals, fetch() { networkRequests += 1; throw new Error("JSON 模式不应联网"); } } });
  await graph.load("i18n/index.tsx").default.changeLanguage("zh");
  const { MarketComparison } = graph.load("components/MarketComparison.tsx");
  await dom.render(h(MarketComparison));
  await settle();
  const hint = descendants(dom.container, (node) => node.tagName === "HEADER")[0].textContent;
  assert.match(hint, /窗口 2026-07-16 – 2026-10-15，共 770 封/);
  const status = descendants(dom.container, (node) => node.getAttribute("role") === "status")
    .map((node) => node.textContent).find((text) => text.includes("共同窗口"));
  assert.equal(status, "已选 2 个市场 · 样本 770 封；全市场 770 封。92 天共同窗口。");
  const labels = descendants(dom.container, (node) => node.tagName === "LABEL").map((node) => node.textContent);
  assert.ok(labels.includes("美国 · US770 封"));
  // 品牌矩阵实际显示的周均必须按 92 天计算，而非固定 live 窗口或桶数。
  const rows = descendants(dom.container, (node) => node.tagName === "TR");
  const zara = rows.find((node) => node.textContent.startsWith("Zara"));
  assert.ok(zara, "真实组件应渲染品牌矩阵");
  const records = await graph.load("email-data.ts").getExtendedEmails();
  const zaraTotal = records.emails.filter((email) => email.brand === "Zara").length;
  assert.ok(zara.textContent.includes((zaraTotal / (92 / 7)).toFixed(1)), "周均分母来自完整快照窗口");
  assert.equal(networkRequests, 0);
});

it("J4：真实 App/Provider 与多实例 URL hook 经导航和连续写入恢复站点及筛选", async (t) => {
  // 只替换无关视图输出与遥测；站点同步 effects 直接来自生产 App.Dashboard。
  const overrides = { "analytics.ts": { initAnalytics: async () => false, trackView() {} } };
  for (const name of ["BrandThemeBreakdown", "CalendarView", "CampaignOverview", "DashboardFooter", "DashboardHeader",
    "Insights", "KpiGrid", "PageNav", "ThemeDistribution", "WordCloud", "ContentAnalysis", "MarketComparison",
    "MarkdownReport", "ExtendedEmailFilter", "BrandDetailDialog"]) {
    overrides[`components/${name}.tsx`] = { [name]: () => null };
  }
  const f = await liveFixture(t, { overrides, hash: "#emails/UK/SHEIN/price?q=sale" });
  const { Dashboard } = f.graph.load("App.tsx");
  const site = f.graph.load("site-data.tsx");
  const { useUrlSync } = f.graph.load("use-url-sync.ts");
  const { notifyUrlChanged } = f.graph.load("url-state.ts");
  const hooks = [];
  let selection;
  let result;
  function Probe({ index }) {
    hooks[index] = useUrlSync({ preserveScroll: false });
    selection = site.useSiteSelection();
    result = site.useSiteThreeWeekData();
    return h("output", null, JSON.stringify(hooks[index].state));
  }
  await f.render(h(site.SiteProvider, null, h(Fragment, null, h(Dashboard), h(Probe, { index: 0 }), h(Probe, { index: 1 }))));
  await settle();
  function expectState(expected, total) {
    for (const hook of hooks) assert.deepEqual(hook.state, expected);
    assert.equal(selection.market, expected.market, "App 的真实 effect 应把 URL 站点同步到 Provider");
    assert.equal(result.data.total, total, "Provider 消费者读取恢复站点的数据");
  }
  const uk = { view: "emails", market: "UK", marketSpecified: true, brand: "SHEIN", theme: "price", query: "sale", dateFrom: "", dateTo: "" };
  expectState(uk, 1);
  await settle(() => {
    f.window.history.replaceState(null, "", "#emails/US/Zara/new?q=coat");
    f.window.dispatchEvent(new Event("popstate"));
  });
  expectState({ ...uk, market: "US", brand: "Zara", theme: "new", query: "coat" }, 1);
  // 同一 act 中保留两个实例的旧 setter：后一实例必须基于最新 location 写入。
  const first = hooks[0];
  const second = hooks[1];
  await settle(() => {
    first.setBrand("SHEIN");
    second.setMarket("UK");
    first.setTheme("price");
    second.setQuery("linen + sale");
  });
  expectState({ ...uk, query: "linen + sale" }, 1);
  assert.equal(f.window.location.hash, "#emails/UK/SHEIN/price?q=linen%20%2B%20sale");
  // Provider → URL 也必须保留其他实例已写入的筛选。
  await settle(() => selection.setMarket("US"));
  expectState({ ...uk, market: "US", query: "linen + sale" }, 1);
  await settle(() => {
    f.window.history.pushState(null, "", "#emails/all/Zara/new?q=all");
    notifyUrlChanged();
  });
  expectState({ ...uk, market: null, brand: "Zara", theme: "new", query: "all" }, 2);
  // 未指定市场沿用 Provider，显式 all 恢复全部；重复后退/前进快照仍恢复筛选。
  await settle(() => { hooks[0].setMarket("UK"); });
  await settle(() => {
    f.window.history.replaceState(null, "", "#emails");
    f.window.dispatchEvent(new Event("hashchange"));
  });
  expectState({ ...uk, brand: "all", theme: null, query: "" }, 1);
  for (const [hash, expected, total] of [
    ["#emails/all/Zara/new?q=all", { ...uk, market: null, brand: "Zara", theme: "new", query: "all" }, 2],
    ["#emails/UK/SHEIN/price?q=sale", uk, 1],
    ["#emails/all/Zara/new?q=all", { ...uk, market: null, brand: "Zara", theme: "new", query: "all" }, 2],
  ]) {
    await settle(() => { f.window.history.replaceState(null, "", hash); f.window.dispatchEvent(new Event("popstate")); });
    expectState(expected, total);
  }
});
