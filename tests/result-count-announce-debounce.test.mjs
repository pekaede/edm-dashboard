import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const PAGE_SIZE = 50;
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn) => act(async () => { fn(); await flushPromises(); });

async function mountEmailList(t, count) {
  const dom = await mountDOM(t, "#emails/all");
  const clock = mountedClock();
  const frames = new Map();
  let frame = 0;
  const raf = (callback) => { frames.set(++frame, callback); return frame; };
  const caf = (id) => frames.delete(id);
  Object.assign(dom.window, clock.globals, {
    requestAnimationFrame: raf,
    cancelAnimationFrame: caf,
    scrollY: 0,
    localStorage: globalThis.sessionStorage,
    // 沿用搜索清空测试的真实列表挂载；焦点用例不依赖虚拟滚动布局。
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  const nativeCreate = dom.document.createElement;
  dom.document.createElement = (tag) => {
    const node = nativeCreate(tag);
    node.scrollTop = 0;
    node.scrollLeft = 0;
    node.scrollTo = ({ top, left }) => {
      if (top !== undefined) node.scrollTop = top;
      if (left !== undefined) node.scrollLeft = left;
    };
    return node;
  };
  const emails = Array.from({ length: count }, (_, index) => ({
    brand: "Halara", date: "2026-10-01", market: "US", theme: "price",
    keywords: ["coat"], subject: `Coat offer ${index}`, preheader: "",
    url: `https://example.test/email/${index}`, day_seq: index, source_index: index,
  }));
  const graph = sourceGraph({
    globals: { ...clock.globals, requestAnimationFrame: raf, cancelAnimationFrame: caf },
    overrides: {
      "site-data.tsx": {
        useSiteEmails: () => ({ emails, status: "ready", total: emails.length, meta: {
          windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all",
        } }),
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
      "components/ui/select.tsx": {
        Select: ({ children, value, onValueChange }) => h("div", {
          "data-select": value, onChange: (event) => onValueChange(event.target.value),
        }, children),
        SelectTrigger: ({ children, ...props }) => h("button", props, children),
        SelectContent: ({ children }) => h(Fragment, null, children),
        SelectItem: () => null,
        SelectValue: ({ children }) => h("span", null, children),
      },
    },
  });
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  const { translate } = graph.load("i18n/index.tsx");
  const flushFrames = async () => {
    for (let attempt = 0; frames.size && attempt < 100; attempt++) {
      const batch = [...frames];
      await settle(() => {
        batch.forEach(([id, callback]) => { if (frames.delete(id)) callback(); });
      });
    }
    assert.equal(frames.size, 0, "动画帧应在有限次数内执行完毕");
  };
  await dom.render(h(ExtendedEmailFilter));
  await flushFrames();
  const liveRegion = () => descendants(dom.container, (node) =>
    node.nodeName === "SPAN" && node.getAttribute("aria-live") === "polite")[0];
  const searchInput = () => descendants(dom.container, (node) =>
    node.nodeName === "INPUT" && node.type === "search")[0];
  const countText = (shown, total) =>
    `${translate("efShownPrefix")} ${shown} / ${total} ${translate("marketUnitEmails", { count: total })}`;
  return {
    ...dom,
    clock,
    translate,
    liveRegion,
    searchInput,
    countText,
    flushFrames,
    advance: (ms) => settle(() => clock.advance(ms)),
    type: async (input, value) => {
      await settle(() => propsOf(input).onChange({ target: { value } }));
    },
    loadMoreButtons: (remaining) => descendants(dom.container, (node) =>
      node.nodeName === "BUTTON" && node.textContent === translate("efLoadMore", { n: remaining })),
    click: async (button) => {
      await settle(() => propsOf(button).onClick());
      await flushFrames();
    },
  };
}

it("可视计数段落不再自带 aria-live，播报走独立 sr-only 区", async (t) => {
  const f = await mountEmailList(t, PAGE_SIZE + 10);
  const region = f.liveRegion();
  assert.ok(region, "应挂载独立播报区");
  assert.equal(region.getAttribute("aria-atomic"), "true", "播报区应整句播报");
  assert.ok(String(region.getAttribute("class") ?? "").includes("sr-only"), "播报区应视觉隐藏");
  assert.equal(region.textContent, f.countText(50, 60), "初始播报应为当前计数");
  const visibleCounts = descendants(f.container, (node) =>
    node.nodeName === "P" && String(node.textContent ?? "").includes(f.translate("efShownPrefix")));
  assert.equal(visibleCounts.length, 1, "可视计数段落应唯一");
  assert.equal(visibleCounts[0].getAttribute("aria-live"), null, "可视计数段落不应再逐键播报");
});

it("逐键输入时播报被节流：稳定前不写播报区，稳定 600ms 后只播报一次", async (t) => {
  const f = await mountEmailList(t, PAGE_SIZE + 10);
  const input = f.searchInput();
  assert.ok(input, "真实列表应挂载搜索输入框");
  // 旧代码下可视段落自带 aria-live="polite"，每次击键都会改写播报文本；
  // 新代码下 600ms 内连续击键只保留最后一次计时。
  await f.type(input, "z");
  await f.type(input, "zz");
  await f.type(input, "zzz");
  assert.equal(f.liveRegion().textContent, f.countText(50, 60),
    "快速逐键输入后、计时未到前，播报区应仍为旧计数");
  assert.equal(f.clock.pending(), 1, "连续击键应只保留一个待播报计时器");
  await f.advance(599);
  assert.equal(f.liveRegion().textContent, f.countText(50, 60), "599ms 时仍不应播报");
  await f.advance(1);
  assert.equal(f.liveRegion().textContent, f.countText(0, 0), "稳定 600ms 后播报区应更新为零结果计数");
});

it("加载更多后播报区在节流窗口后更新", async (t) => {
  const f = await mountEmailList(t, PAGE_SIZE + 10);
  const button = f.loadMoreButtons(10)[0];
  assert.ok(button, "初始只加载一页，应显示加载更多按钮");
  await f.click(button);
  assert.equal(f.liveRegion().textContent, f.countText(50, 60), "点击后计时未到前播报区不应同步改写");
  await f.advance(600);
  assert.equal(f.liveRegion().textContent, f.countText(60, 60), "节流窗口后播报区应更新为 60/60");
});

it("卸载时清理待播报计时器", async (t) => {
  const f = await mountEmailList(t, PAGE_SIZE + 10);
  const input = f.searchInput();
  await f.type(input, "z");
  assert.equal(f.clock.pending(), 1, "击键后应有一个待播报计时器");
  await f.render(null);
  assert.equal(f.clock.pending(), 0, "卸载后计时器应被清理");
});
