import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

// 只在内存注入负向变异；可用 EDM_FAVORITE_WRITE_MUTATION 重跑本文件验证测试会变红。
const mutations = [
  {
    name: "without-show-error", path: "components/ExtendedEmailFilter.tsx",
    before: "      showError();", after: "      /* 丢失保存失败反馈 */",
  },
  {
    name: "returns-new-state", path: "favorites.ts",
    before: "    return saveFavorites(favorites);",
    after: "    saveFavorites(favorites);\n    return favorites.includes(key);",
  },
];
const selectedMutation = process.env.EDM_FAVORITE_WRITE_MUTATION;
const mutation = mutations.find((item) => item.name === selectedMutation);
assert.ok(!selectedMutation || mutation, `未知变异 ${selectedMutation}`);

const STORAGE_KEY = "edm-favorites-v1";
const FAVORITES_EVENT = "edm-favorites-changed";
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function favoriteFixture(t, { savedKeys = [], locale = "zh", readFails = false } = {}) {
  const dom = await mountDOM(t, "#emails/all");
  const clock = mountedClock();
  const frames = new Map();
  let frame = 0;
  const raf = (callback) => { frames.set(++frame, callback); return frame; };
  const caf = (id) => frames.delete(id);
  Object.assign(dom.window, clock.globals, {
    requestAnimationFrame: raf, cancelAnimationFrame: caf, scrollY: 0,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  });
  // 补齐真实 Virtualizer 挂载一行所需的视口尺寸，不模拟收藏按钮或其状态。
  const nativeCreate = dom.document.createElement;
  dom.document.createElement = (tag) => {
    const node = nativeCreate(tag);
    Object.assign(node, {
      scrollTop: 0, scrollLeft: 0, clientHeight: 600, clientWidth: 1472,
      offsetHeight: tag === "tr" ? 100 : 600,
      getBoundingClientRect: () => ({ top: 0, bottom: 100, height: 100, width: 1472 }),
      scrollTo({ top, left }) {
        if (top !== undefined) this.scrollTop = top;
        if (left !== undefined) this.scrollLeft = left;
      },
    });
    Object.defineProperty(node, "isConnected", { get: () => dom.document.body.contains(node) });
    return node;
  };

  const stored = new Map([[STORAGE_KEY, JSON.stringify(savedKeys)]]);
  const failures = { read: readFails, write: false };
  const writes = [];
  dom.window.localStorage = {
    getItem(key) {
      if (key === STORAGE_KEY && failures.read) throw new Error("storage read denied");
      return stored.get(key) ?? null;
    },
    setItem(key, value) {
      if (key === STORAGE_KEY) {
        writes.push(JSON.parse(value));
        if (failures.write) throw new Error("storage quota exceeded");
      }
      stored.set(key, String(value));
    },
    removeItem: (key) => stored.delete(key),
  };
  const events = [];
  dom.window.addEventListener(FAVORITES_EVENT, (event) => events.push(event));

  const emails = [{
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: "Coat offer", preheader: "", url: "https://example.test/email",
    day_seq: 0, source_index: 0,
  }];
  const overrides = {
    "site-data.tsx": {
      useSiteEmails: () => ({ emails, status: "ready", total: 1, meta: {
        windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all",
      } }),
      useSiteSelection: () => ({ market: null, setMarket() {} }),
    },
    // 旁路与收藏无关的 Radix portal；列表、Table、Virtualizer、i18n 和收藏逻辑均真实执行。
    "components/ui/select.tsx": {
      Select: ({ children }) => h("div", null, children),
      SelectTrigger: ({ children, ...props }) => h("button", props, children),
      SelectContent: ({ children }) => h(Fragment, null, children),
      SelectItem: () => null,
      SelectValue: ({ children }) => h("span", null, children),
    },
  };
  const graph = sourceGraph({
    globals: { ...clock.globals, requestAnimationFrame: raf, cancelAnimationFrame: caf },
    overrides, mutation,
  });
  const favorites = graph.load("favorites.ts");
  const toggleResults = [];
  // 透明记录按钮调用的真实返回值，不替换读取、写入、事件派发或成功/失败判断。
  overrides["favorites.ts"] = {
    ...favorites,
    toggleFavorite(key) {
      const result = favorites.toggleFavorite(key);
      toggleResults.push(result);
      return result;
    },
  };
  const i18n = graph.load("i18n/index.tsx");
  await i18n.default.changeLanguage(locale);
  const key = graph.load("components/email-table-model.ts").getEmailRowKey(emails[0]);
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  await dom.render(h(ExtendedEmailFilter));
  const rows = descendants(dom.container, (node) => node.getAttribute("data-email-row") === key);
  assert.equal(rows.length, 1, "必须挂载真实邮件行才能测试收藏点击");
  const button = descendants(rows[0], (node) => node.nodeName === "BUTTON" && node.getAttribute("aria-pressed") !== null)[0];
  assert.ok(button, "必须使用真实收藏按钮");
  if (mutation) assert.ok(graph.mutations.has(mutation.name), "负向变异必须实际注入");
  const alerts = () => descendants(dom.container, (node) => node.getAttribute("role") === "alert");
  assert.equal(alerts().length, 0);
  return {
    ...dom, clock, failures, writes, events, toggleResults, key, button, alerts, favorites,
    stored, translate: i18n.translate,
    raw: () => stored.get(STORAGE_KEY),
    click: () => settle(() => propsOf(button).onClick()),
    advance: (milliseconds) => settle(() => clock.advance(milliseconds)),
    unmount: () => dom.render(null),
  };
}

for (const initiallySaved of [false, true]) {
  it(`收藏${initiallySaved ? "移除" : "添加"}写入抛错：返回 false、显示 alert，原始存储和按钮状态不变`, async (t) => {
    const f = await favoriteFixture(t, { savedKeys: initiallySaved ? ["US|Halara|2026-10-01|0|0"] : [] });
    assert.equal(f.button.getAttribute("aria-pressed"), String(initiallySaved));
    const before = f.raw();
    f.failures.write = true;
    await f.click();
    assert.deepEqual(f.toggleResults, [false]);
    assert.equal(f.writes.length, 1, "确实尝试了写入并触发 setItem 异常");
    assert.equal(f.raw(), before, "写入失败不得改变已落盘收藏");
    assert.equal(f.button.getAttribute("aria-pressed"), String(initiallySaved));
    assert.equal(f.events.length, 0, "失败时不能派发收藏变更事件");
    assert.equal(f.alerts().length, 1, "按钮失败必须触发组件内错误提示");
    assert.equal(f.alerts()[0].textContent, f.translate("efFavoriteSaveFailed"));
    assert.doesNotMatch(f.alerts()[0].textContent, /[A-Za-z]/u, "中文提示不得混入英文");
  });
}

it("收藏读取抛错：渲染兼容返回空数组，点击返回 false、显示 alert，且绝不按空数组添加", async (t) => {
  const f = await favoriteFixture(t, { savedKeys: ["another-saved-email"], readFails: true });
  assert.deepEqual(f.favorites.loadFavorites(), []);
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  const before = f.raw();
  await f.click();
  assert.deepEqual(f.toggleResults, [false]);
  assert.deepEqual(f.writes, [], "getItem 失败后不得进入添加分支或调用 setItem");
  assert.equal(f.raw(), before, "读取失败不能覆盖已有收藏");
  assert.equal(f.events.length, 0);
  assert.equal(f.alerts().length, 1);
  assert.equal(f.alerts()[0].textContent, f.translate("efFavoriteSaveFailed"));
});

it("跨标签页快照滞后：存储已收藏而按钮未收藏时，成功移除返回 true，且无误报", async (t) => {
  const f = await favoriteFixture(t);
  // 先挂载空快照，再模拟另一标签页写入；storage 事件尚未交付当前组件。
  f.stored.set(STORAGE_KEY, JSON.stringify([f.key, "another-saved-email"]));
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  await f.click();
  assert.deepEqual(f.toggleResults, [true], "成功移除也必须返回写入成功");
  assert.deepEqual(JSON.parse(f.raw()), ["another-saved-email"]);
  assert.equal(f.events.length, 1);
  assert.equal(f.alerts().length, 0, "不得用滞后的 wasFav 快照推断写入失败");
});

it("成功添加和移除均返回 true、同步按钮状态且不显示 alert", async (t) => {
  const f = await favoriteFixture(t);
  await f.click();
  assert.deepEqual(f.toggleResults, [true]);
  assert.deepEqual(JSON.parse(f.raw()), [f.key]);
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.events.length, 1);
  assert.equal(f.alerts().length, 0);
  await f.click();
  assert.deepEqual(f.toggleResults, [true, true]);
  assert.deepEqual(JSON.parse(f.raw()), []);
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.events.length, 2);
  assert.equal(f.alerts().length, 0);
});

it("英文失败提示使用英文，显示满五秒后自动消失", async (t) => {
  const f = await favoriteFixture(t, { locale: "en" });
  f.failures.write = true;
  await f.click();
  assert.equal(f.alerts().length, 1);
  assert.equal(f.alerts()[0].textContent, f.translate("efFavoriteSaveFailed"));
  assert.match(f.alerts()[0].textContent, /[A-Za-z]/u);
  assert.doesNotMatch(f.alerts()[0].textContent, /\p{Script=Han}/u);
  await f.advance(4999);
  assert.equal(f.alerts().length, 1, "五秒前提示应保持可见");
  await f.advance(1);
  assert.equal(f.alerts().length, 0, "五秒后必须卸载 alert");
  assert.equal(f.clock.pending(), 0);
});

it("连续失败从最后一次点击重新计时，卸载时清理提示定时器", async (t) => {
  const f = await favoriteFixture(t);
  f.failures.write = true;
  await f.click();
  await f.advance(3000);
  await f.click();
  assert.deepEqual(f.toggleResults, [false, false]);
  assert.equal(f.clock.pending(), 1, "重复失败必须清理前一个定时器");
  await f.advance(2000);
  assert.equal(f.alerts().length, 1, "旧定时器不能提前清除新提示");
  await f.advance(2999);
  assert.equal(f.alerts().length, 1);
  await f.advance(1);
  assert.equal(f.alerts().length, 0);
  await f.click();
  assert.equal(f.alerts().length, 1);
  assert.equal(f.clock.pending(), 1);
  await f.unmount();
  assert.equal(f.clock.pending(), 0, "卸载必须清理未触发的提示定时器");
  await f.advance(5000);
  assert.equal(f.alerts().length, 0);
});
