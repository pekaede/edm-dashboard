import assert from "node:assert/strict";
import { it } from "node:test";
import { act, createElement as h, Fragment, StrictMode, useState } from "react";
import { useTable } from "@tanstack/react-table";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const defaults = {
  market: null, brand: null, theme: null, dateFrom: "", dateTo: "",
  favoritesOnly: false, favoriteKeys: new Set(), query: "",
};
const makeEmail = (index, overrides = {}) => ({
  brand: index % 2 ? "Zara" : "Halara", date: "2026-10-01", market: "US",
  theme: "price", keywords: ["offer", `keyword-${index}`],
  subject: "subject-only", preheader: "preheader-only", url: "https://example.test/email",
  day_seq: 0, source_index: index, ...overrides,
});
const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
const settle = (fn = () => {}) => act(async () => { await fn(); await flushPromises(); });

it("邮件 TanStack 模型保留双语搜索、闭区间、收藏键、同日顺序及追加分页", async (t) => {
  const dom = await mountDOM(t);
  const graph = sourceGraph();
  const model = graph.load("components/email-table-model.ts");
  const emails = [makeEmail(0), makeEmail(1, { market: "UK", date: "2026-10-02" }),
    makeEmail(2, { theme: "other", date: "2026-10-03" }), makeEmail(3),
    makeEmail(4, { theme: "custom-theme", date: "2026-10-04" })];
  let table, setFilters;
  function Consumer() {
    const [filters, update] = useState(defaults);
    setFilters = (patch) => update({ ...defaults, ...patch });
    table = useTable({
      features: model.emailTableFeatures, columns: model.emailTableColumns, data: emails,
      getRowId: model.getEmailRowKey, state: { columnFilters: [{ id: "email", value: filters }] },
      initialState: { sorting: [{ id: "date", desc: true }], pagination: { pageIndex: 0, pageSize: 2 } },
      autoResetPageIndex: false,
    });
    return null;
  }
  const ids = () => table.getRowModel().rows.map((row) => row.original.source_index);
  const allIds = () => table.getFilteredRowModel().rows.map((row) => row.original.source_index);
  await dom.render(h(Consumer));
  assert.deepEqual(ids(), [4, 2]);
  await settle(() => table.setPageSize(5));
  assert.deepEqual(ids(), [4, 2, 1, 0, 3], "日期倒序；同日保留数据源的品牌/站点/序号顺序");
  for (const query of ["价格", "Price", "  OFFER ", "2026-10"]) {
    await settle(() => setFilters({ query }));
    assert.ok(allIds().includes(0), `保持原有跨语言/日期/关键词搜索：${query}`);
  }
  await settle(() => setFilters({ query: "subject-only" }));
  assert.deepEqual(ids(), [], "原有搜索范围不额外包含 subject/preheader");
  await settle(() => setFilters({ query: "CUSTOM-THEME" }));
  assert.deepEqual(ids(), [4]);
  await settle(() => setFilters({ market: "US", brand: "Halara", dateFrom: "2026-10-01", dateTo: "2026-10-03" }));
  assert.deepEqual(ids(), [2, 0], "日期首尾均包含，筛选取交集");
  await settle(() => setFilters({ favoritesOnly: true, favoriteKeys: new Set([model.getEmailRowKey(emails[1])]) }));
  assert.deepEqual(ids(), [1]);
  assert.notEqual(model.getEmailRowKey(emails[0]), model.getEmailRowKey({ ...emails[0], market: "UK" }));
  assert.notEqual(model.getEmailRowKey(emails[0]), model.getEmailRowKey({ ...emails[0], day_seq: 1 }));
  await settle(() => setFilters({ brand: "unknown-brand" }));
  assert.deepEqual(ids(), [], "URL 中无匹配的品牌必须显示可重置空态");
});

// 这不是浏览器布局测试：沿用现有真实 React DOM 宿主，只注入视口/行高/ResizeObserver。
// Table、Virtualizer、列表 JSX、URL hook、展开、收藏与 CSV 均执行生产实现。
async function emailListFixture(t, {
  count = 600, visible = 600, savedTop, savedAnchor, savedWindowTop,
  strict = false, rowHeight = 100, autoFlush = true,
} = {}) {
  const dom = await mountDOM(t, "#emails/all");
  const frames = new Map();
  const scrollCalls = { list: [], window: [] };
  let frame = 0;
  const raf = (callback) => { frames.set(++frame, callback); return frame; };
  const caf = (id) => frames.delete(id);
  dom.window.requestAnimationFrame = raf;
  dom.window.cancelAnimationFrame = caf;
  dom.window.setTimeout = setTimeout;
  dom.window.clearTimeout = clearTimeout;
  dom.window.scrollY = 0;
  dom.window.innerHeight = 900;
  dom.window.scrollTo = ({ top }) => {
    scrollCalls.window.push(top);
    if (dom.window.scrollY === top) return;
    dom.window.scrollY = top;
    queueMicrotask(() => dom.window.dispatchEvent(new Event("scroll")));
  };
  dom.window.localStorage = globalThis.sessionStorage;
  const observers = new Set();
  class ResizeObserver {
    nodes = new Set();
    pendingFrame = null;
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe(node) {
      this.nodes.add(node);
      // 浏览器会为新观察的节点异步交付首次实测，滚动中新挂载的行也需要此事件。
      if (this.pendingFrame === null) this.pendingFrame = raf(() => {
        this.pendingFrame = null;
        this.notify();
      });
    }
    unobserve(node) { this.nodes.delete(node); }
    disconnect() { this.nodes.clear(); caf(this.pendingFrame); this.pendingFrame = null; observers.delete(this); }
    notify() {
      this.callback([...this.nodes].map((target) => ({ target, borderBoxSize: [{ blockSize: target.offsetHeight, inlineSize: 1472 }] })));
    }
  }
  dom.window.ResizeObserver = ResizeObserver;
  const nativeCreate = dom.document.createElement;
  dom.document.createElement = (tag) => {
    const node = nativeCreate(tag);
    let scrollTop = 0;
    Object.defineProperty(node, "scrollTop", {
      get: () => scrollTop,
      set: (top) => {
        if (scrollTop === top) return;
        scrollTop = top;
        // 浏览器对赋值 scrollTop 异步派发 scroll；原始挂载宿主没有此布局事件。
        queueMicrotask(() => {
          node.dispatchEvent(new Event("scroll"));
          // 宿主不传播 DOM 事件，显式交付 React 的容器滚动回调。
          propsOf(node)?.onScroll?.({ currentTarget: node });
        });
      },
    });
    node.scrollLeft = 0;
    node.clientHeight = 600;
    node.clientWidth = 1472;
    node.scrollHeight = 60100;
    node.getBoundingClientRect = () => {
      let top = 0;
      if (node.getAttribute("data-email-row") !== null && node.parentNode) {
        const tbody = node.parentNode;
        const previousRows = tbody.childNodes.slice(0, tbody.childNodes.indexOf(node));
        // 按真实 JSX 的表头、占位行及已挂载行计算几何位置，不读取虚拟器缓存。
        top = 48 + previousRows.reduce((height, row) => height +
          (row.getAttribute("data-email-row") !== null ? row.offsetHeight : parseFloat(row.firstChild?.style.height ?? "0")), 0)
          - tbody.parentNode.parentNode.scrollTop;
      }
      return { height: node.offsetHeight, width: 1472, top, bottom: top + node.offsetHeight, left: 0 };
    };
    node.scrollTo = ({ top, left }) => {
      if (top !== undefined) { scrollCalls.list.push(top); node.scrollTop = top; }
      if (left !== undefined) node.scrollLeft = left;
    };
    Object.defineProperty(node, "isConnected", { get: () => dom.document.body.contains(node) });
    Object.defineProperty(node, "offsetHeight", { get: () => tag === "tr"
      ? (descendants(node, (child) => child.getAttribute("aria-expanded") === "true").length ? 200
        : typeof rowHeight === "function" ? rowHeight(node) : rowHeight) : 600 });
    return node;
  };
  globalThis.sessionStorage.setItem("edm-emails-visible-count", String(visible));
  if (savedTop !== undefined) globalThis.sessionStorage.setItem("edm-emails-list-scroll", String(savedTop));
  if (savedAnchor !== undefined) globalThis.sessionStorage.setItem("edm-emails-list-anchor", JSON.stringify(savedAnchor));
  if (savedWindowTop !== undefined) globalThis.sessionStorage.setItem("edm-emails-window-scroll", String(savedWindowTop));
  const emails = Array.from({ length: count }, (_, index) => makeEmail(index));
  let exported;
  const overrides = {
      "site-data.tsx": {
        useSiteEmails: () => ({ emails, status: "ready", total: emails.length, meta: { windowStart: "2026-07-01", windowEnd: "2026-10-01", range: "test", market: "all" } }),
        useSiteSelection: () => ({ market: null, setMarket() {} }),
      },
      // 只旁路 Radix 的 portal/焦点等浏览器 API；保留受控 value/onValueChange，供 URL 断言。
      "components/ui/select.tsx": {
        Select: ({ children, value, onValueChange }) => h("div", { "data-select": value, onChange: (event) => onValueChange(event.target.value) }, children),
        SelectTrigger: ({ children, ...props }) => h("button", props, children),
        SelectContent: ({ children }) => h(Fragment, null, children),
        SelectItem: () => null,
        SelectValue: ({ children }) => h("span", null, children),
      },
  };
  const graph = sourceGraph({ globals: { requestAnimationFrame: raf, cancelAnimationFrame: caf }, overrides });
  overrides["export.ts"] = { ...graph.load("export.ts"), downloadFile: (...args) => { exported = args; } };
  const { ExtendedEmailFilter } = graph.load("components/ExtendedEmailFilter.tsx");
  const mount = async () => dom.render(strict ? h(StrictMode, null, h(ExtendedEmailFilter)) : h(ExtendedEmailFilter));
  await mount();
  const flushFrame = async (before = () => {}) => {
    const batch = [...frames];
    await settle(() => {
      before();
      batch.forEach(([id, callback]) => { if (frames.delete(id)) callback(); });
    });
  };
  const flushFrames = async () => {
    let count = 0;
    while (frames.size && count < 100) { await flushFrame(); count++; }
    assert.equal(frames.size, 0, "恢复及测量帧应在有限重试内结束");
    return count;
  };
  if (autoFlush) await flushFrames();
  const find = (predicate) => descendants(dom.container, predicate);
  const rows = () => find((node) => node.getAttribute("data-email-row") !== null);
  const table = () => find((node) => node.getAttribute("data-email-table") !== null)[0];
  const scroller = () => table().parentNode;
  const click = async (node) => settle(() => propsOf(node).onClick());
  const scroll = async (top) => {
    await settle(() => { scroller().scrollTop = top; });
    await settle(() => [...observers].forEach((observer) => observer.notify()));
    await flushFrames();
  };
  const topRow = () => rows().find((row) => row.getBoundingClientRect().bottom > 0);
  return { ...dom, find, rows, table, scroller, scroll, scrollCalls, click, flushFrame, flushFrames, observers, topRow, mount,
    unmount: () => dom.render(null), emails, exported: () => exported };
}

it("600 封真实列表仅挂载视口行，滚动换行、展开重挂载、收藏和全量导出保持", async (t) => {
  const f = await emailListFixture(t);
  assert.equal(f.table().getAttribute("data-filtered-rows"), "600");
  assert.equal(f.table().getAttribute("aria-rowcount"), "601");
  const topCount = f.rows().length;
  assert.ok(topCount > 0 && topCount < 30, `600 条数据顶部实际挂载 ${topCount} 行`);
  const firstKey = f.rows()[0].getAttribute("data-email-row");
  const expand = f.find((node) => node.nodeName === "BUTTON" && node.textContent === "展开全部内容")[0];
  assert.ok(expand);
  await f.click(expand);
  await settle(() => [...f.observers].forEach((observer) => observer.notify()));
  assert.ok(f.find((node) => node.getAttribute("aria-expanded") === "true").length);
  assert.ok(f.rows().length < topCount, "ResizeObserver 测量展开行后视口 DOM 行数随动态行高缩小");
  const star = descendants(f.rows()[0], (node) => node.nodeName === "BUTTON" && node.getAttribute("aria-pressed") !== null)[0];
  await f.click(star);
  assert.equal(star.getAttribute("aria-pressed"), "true");
  await f.scroll(30000);
  assert.ok(!f.rows().some((row) => row.getAttribute("data-email-row") === firstKey));
  const middleCount = f.rows().length;
  assert.ok(middleCount > 0 && middleCount < 35, `中段实际挂载 ${middleCount} 行`);
  await f.scroll(0);
  assert.equal(f.rows()[0].getAttribute("data-email-row"), firstKey);
  assert.ok(descendants(f.rows()[0], (node) => node.getAttribute("aria-expanded") === "true").length, "虚拟行重挂载后仍可收起");
  assert.equal(descendants(f.rows()[0], (node) => node.getAttribute("aria-pressed") === "true").length, 1);
  const exportButton = f.find((node) => node.nodeName === "BUTTON" && /600/.test(node.getAttribute("aria-label") ?? ""))[0];
  await f.click(exportButton);
  assert.equal(f.exported()[1].split("\r\n").length, 601, "CSV 导出全部 600 行，不受 DOM/分页限制");
  t.diagnostic(`600 rows; viewport=600px; mounted top=${topCount}, middle=${middleCount}, returned=${f.rows().length}`);
});

it("列表保留追加 50 封及 Select 的 URL 写入、主题归一和未知值", async (t) => {
  const f = await emailListFixture(t, { visible: 50 });
  const loadMore = f.find((node) => node.nodeName === "BUTTON" && /加载更多/.test(node.textContent))[0];
  assert.ok(loadMore);
  await f.click(loadMore);
  assert.equal(f.table().getAttribute("data-page-size"), "100");
  assert.equal(sessionStorage.getItem("edm-emails-visible-count"), "100");
  assert.equal(f.table().getAttribute("aria-rowcount"), "101");
  const navigate = async (hash) => settle(() => { f.window.location.hash = hash; f.window.dispatchEvent(new Event("popstate")); });
  await navigate("#emails/all/Zara/PRICE?q=offer");
  assert.equal(f.table().getAttribute("data-page-size"), "50");
  assert.equal(f.table().getAttribute("data-filtered-rows"), "300");
  assert.ok(f.find((node) => node.getAttribute("data-select") === "theme:price").length);
  const brandSelect = f.find((node) => node.getAttribute("data-select") === "Zara")[0];
  await settle(() => propsOf(brandSelect).onChange({ target: { value: "all" } }));
  assert.equal(f.window.location.hash, "#emails/all/all/price?q=offer", "Select 写入沿用原路径参数并保留其他筛选");
  assert.equal(f.table().getAttribute("data-filtered-rows"), "600");
  const themeSelect = f.find((node) => node.getAttribute("data-select") === "theme:price")[0];
  await settle(() => propsOf(themeSelect).onChange({ target: { value: "__all__" } }));
  assert.equal(f.window.location.hash, "#emails/all?q=offer", "内部 Select 哨兵不可泄漏至 URL");
  await navigate("#emails/all/all/custom-theme");
  assert.ok(/没有|无|未找到/.test(f.container.textContent));
  assert.ok(f.find((node) => node.getAttribute("data-select") === "theme:custom-theme").length);
});

it("虚拟列表恢复会话中的 600 条分页范围和深层滚动位置", async (t) => {
  const f = await emailListFixture(t, { savedTop: 24000, strict: true });
  assert.equal(f.table().getAttribute("data-page-size"), "600");
  assert.equal(f.scroller().scrollTop, 24000);
  assert.ok(f.rows().length > 0 && f.rows().length < 35);
  assert.ok(Number(f.rows()[0].getAttribute("data-index")) > 100);
});

it("80px 动态行高的列表卸载重挂载后仍以同一邮件 key 和行内偏移作为视口顶部", async (t) => {
  const f = await emailListFixture(t, { rowHeight: 80, strict: true });
  // 逐段滚动让走过的行获得 80px 实测值；重挂载时这些测量会全部丢失。
  for (let top = 400; top <= 24000; top += 400) await f.scroll(top);
  const before = f.topRow();
  assert.ok(before);
  assert.equal(before.offsetHeight, 80);
  const key = before.getAttribute("data-email-row");
  const offset = -before.getBoundingClientRect().top;
  assert.ok(offset > 0 && offset < 80, "保留非零行内偏移，覆盖仅恢复到行顶的错误实现");
  const oldScroller = f.scroller();
  await f.unmount();
  assert.deepEqual(JSON.parse(sessionStorage.getItem("edm-emails-list-anchor")), { key, offset }, "卸载时保存视口行 key 和行内偏移");
  await f.mount();
  await f.flushFrames();
  assert.notEqual(f.scroller(), oldScroller, "真正卸载并创建新的列表和虚拟器");
  assert.equal(f.topRow()?.getAttribute("data-email-row"), key, "直接比较视口顶部邮件的稳定 key，而非索引或 scrollTop");
  assert.equal(-f.topRow().getBoundingClientRect().top, offset, "测量完成后精确保留行内像素偏移");

  await f.scroll(f.scroller().scrollTop - offset + 1);
  assert.equal(-f.topRow().getBoundingClientRect().top, 1);
  const previousIndex = Number(f.topRow().getAttribute("data-index"));
  await f.unmount();
  f.emails.splice(0, 50);
  await f.mount();
  await f.flushFrames();
  assert.equal(f.topRow()?.getAttribute("data-email-row"), key, "锚点前的邮件移除后仍按 key 找回原邮件");
  assert.equal(Number(f.topRow().getAttribute("data-index")), previousIndex - 50);
  assert.equal(-f.topRow().getBoundingClientRect().top, 1, "即使行内偏移小于原像素校验的 2px 容差，也必须执行校准");
});

it("展开行的 152px 偏移在重挂载行高 96→95→88→80px 渐进收敛后仍留在原邮件内", async (t) => {
  let height = 80;
  const f = await emailListFixture(t, { rowHeight: () => height });
  await f.click(f.find((node) => node.nodeName === "BUTTON" && node.textContent === "展开全部内容")[0]);
  for (let top = 400; top <= 24000; top += 400) await f.scroll(top);
  const before = f.topRow();
  const key = before.getAttribute("data-email-row");
  assert.equal(before.offsetHeight, 200);
  assert.equal(-before.getBoundingClientRect().top, 152);
  const oldScroller = f.scroller();
  await f.unmount();
  assert.deepEqual(JSON.parse(sessionStorage.getItem("edm-emails-list-anchor")), { key, offset: 152 });
  height = 96;
  await f.mount();
  assert.notEqual(f.scroller(), oldScroller, "使用全新的列表和虚拟器，展开状态重置");
  for (const measuredHeight of [96, 96, 95, 95, 88, 88, 80]) {
    height = measuredHeight;
    await settle(() => [...f.observers].forEach((observer) => observer.notify()));
    await f.flushFrame();
  }
  await f.flushFrames();
  assert.equal(f.topRow()?.getAttribute("data-email-row"), key, "渐进测量后视口顶部不能漂移到下一封邮件");
  assert.equal(f.topRow().offsetHeight, 80);
  assert.equal(-f.topRow().getBoundingClientRect().top, 79, "152px 超出折叠后的行高，精确夹到原邮件内的 79px");
});

it("80/100px 混排行中实测等于估算值的 100px 锚点重挂载后精确恢复 51px 偏移", async (t) => {
  const f = await emailListFixture(t, { rowHeight: (node) => Number(node.getAttribute("data-index")) % 2 ? 100 : 80 });
  for (let top = 400; top <= 12000; top += 400) await f.scroll(top);
  const anchor = f.rows().find((row) => row.offsetHeight === 100 && row.getBoundingClientRect().top >= 0);
  assert.ok(anchor);
  await f.scroll(f.scroller().scrollTop + anchor.getBoundingClientRect().top + 51);
  const before = f.topRow();
  const key = before.getAttribute("data-email-row");
  assert.equal(before.offsetHeight, 100, "锚点尺寸恰好等于虚拟器的 100px 估算值");
  assert.equal(-before.getBoundingClientRect().top, 51);
  assert.ok(f.rows().some((row) => row.offsetHeight === 80), "视口内保留 80/100px 混排行");
  const oldScroller = f.scroller();
  await f.unmount();
  assert.deepEqual(JSON.parse(sessionStorage.getItem("edm-emails-list-anchor")), { key, offset: 51 });
  await f.mount();
  await f.flushFrames();
  assert.notEqual(f.scroller(), oldScroller);
  assert.equal(f.topRow()?.getAttribute("data-email-row"), key, "按稳定 key 恢复同一封邮件");
  assert.equal(f.topRow().offsetHeight, 100);
  assert.equal(-f.topRow().getBoundingClientRect().top, 51, "等于估算值的实测行也必须执行非零偏移校准");
});

const restoringAnchor = { key: "US|Zara|2026-10-01|119|0", offset: 152 };

it("首个恢复帧之前的滚轮输入也能取消 StrictMode 下的列表和窗口恢复", async (t) => {
  const f = await emailListFixture(t, { savedTop: 11840, savedWindowTop: 200, strict: true, autoFlush: false });
  const calls = structuredClone(f.scrollCalls);
  await settle(() => f.window.dispatchEvent(new Event("wheel")));
  await f.flushFrames();
  assert.deepEqual(f.scrollCalls, calls, "首帧尚未执行时也必须撤销已排队的恢复");
  assert.equal(f.scroller().scrollTop, 0);
  assert.equal(f.window.scrollY, 0);
});

for (const scope of ["列表", "窗口"]) {
  for (const input of ["wheel", "touchmove", "pointerdown", "PageDown", "ArrowDown", " ", "scroll", "scroll-before-event"]) {
    it(`恢复中${scope}收到 ${JSON.stringify(input)} 后立即停止校准，后续用户滚动不会被拉回`, async (t) => {
      const f = await emailListFixture(t, {
        savedAnchor: restoringAnchor, savedWindowTop: 200, autoFlush: false,
        rowHeight: (node) => Number(node.getAttribute("data-index")) === 119 ? 96 : 100,
      });
      // 第一次定位、第一次验证、第一次行内校准，尚未达到连续四次稳定的完成条件。
      for (let index = 0; index < 3; index++) await f.flushFrame();
      assert.equal(f.topRow()?.getAttribute("data-email-row"), restoringAnchor.key);
      assert.equal(-f.topRow().getBoundingClientRect().top, 95, "自身写入触发的异步 scroll 不能取消恢复");
      assert.equal(f.window.scrollY, 200);
      const readTop = () => scope === "列表" ? f.scroller().scrollTop : f.window.scrollY;
      const setTop = (top) => {
        if (scope === "列表") f.scroller().scrollTop = top;
        else f.window.scrollTo({ top });
      };
      const before = readTop();

      if (!input.startsWith("scroll")) {
        const event = new Event(["PageDown", "ArrowDown", " "].includes(input) ? "keydown" : input, { cancelable: true });
        Object.defineProperties(event, {
          target: { value: scope === "列表" ? f.scroller() : f.document.documentElement },
          key: { value: input }, button: { value: 0 },
        });
        const calls = structuredClone(f.scrollCalls);
        await settle(() => f.window.dispatchEvent(event));
        // 主动输入必须在默认滚动发生前取消；此处还没有外部 scrollTop 变化。
        await f.flushFrame();
        await f.flushFrame();
        assert.deepEqual(f.scrollCalls, calls, "主动输入后，后续帧不得再发出列表或窗口定位写入");
      }

      for (let index = 0; index < 3; index++) {
        const target = readTop() + 400;
        if (input === "scroll-before-event") {
          // 同一帧先改变位置，再执行排队回调；scroll 事件在微任务中才交付。
          await f.flushFrame(() => setTop(target));
        } else {
          await settle(() => setTop(target));
        }
        await f.flushFrame();
        await f.flushFrame();
        assert.equal(readTop(), target, `第 ${index + 1} 次主动滚动不能在两帧内被拉回`);
      }
      await f.flushFrames();
      assert.equal(readTop(), before + 1200, "重试队列结束后仍保持用户落点");
      await f.unmount();
      assert.equal(Number(sessionStorage.getItem(scope === "列表" ? "edm-emails-list-scroll" : "edm-emails-window-scroll")),
        before + 1200, "取消恢复后仍正常保存用户的新位置");
    });
  }
}

it("未挂载锚点先定位、随后展开为 200px 时仍精确恢复原邮件的 152px 偏移", async (t) => {
  const f = await emailListFixture(t, { savedAnchor: restoringAnchor, rowHeight: 80, autoFlush: false });
  assert.ok(!f.rows().some((row) => row.getAttribute("data-email-row") === restoringAnchor.key));
  await f.flushFrame();
  assert.ok(f.rows().some((row) => row.getAttribute("data-email-row") === restoringAnchor.key));
  await f.click(f.find((node) => node.nodeName === "BUTTON" && node.textContent === "展开全部内容")[0]);
  await settle(() => [...f.observers].forEach((observer) => observer.notify()));
  await f.flushFrames();
  assert.equal(f.topRow()?.getAttribute("data-email-row"), restoringAnchor.key);
  assert.equal(f.topRow().offsetHeight, 200);
  assert.equal(-f.topRow().getBoundingClientRect().top, 152);
});

it("锚点行高迟至第 30 次验证才收敛时，耗尽前仍精确校准到原邮件的 79px", async (t) => {
  let height = 96;
  const f = await emailListFixture(t, {
    savedAnchor: restoringAnchor, autoFlush: false,
    rowHeight: (node) => Number(node.getAttribute("data-index")) === 119 ? height : 100,
  });
  for (let attempt = 1; attempt <= 30; attempt++) {
    await f.flushFrame();
    // 每次写入后才改变矩形，持续打断稳定；第 30 次验证最终实测为 80px。
    height = attempt % 2 ? 96 : 80;
    await f.flushFrame();
  }
  assert.equal(f.topRow()?.getAttribute("data-email-row"), restoringAnchor.key, "耗尽时不能留在下一封邮件");
  assert.equal(-f.topRow().getBoundingClientRect().top, 79, "必须按第 30 次实测矩形做最终写入");
  const top = f.scroller().scrollTop;
  assert.ok(await f.flushFrames() <= 2, "30 次上限后仅允许清理标志，不能继续恢复重试");
  assert.equal(f.scroller().scrollTop, top);
  assert.equal(f.topRow()?.getAttribute("data-email-row"), restoringAnchor.key);
  assert.equal(-f.topRow().getBoundingClientRect().top, 79);
});

for (const reason of ["不存在", "被筛掉"]) {
  it(`锚点邮件${reason}时重挂载安全回退到已有像素位置`, async (t) => {
    const f = await emailListFixture(t);
    await f.scroll(24000);
    const row = f.topRow();
    const key = row.getAttribute("data-email-row");
    const index = Number(row.getAttribute("data-index"));
    const email = f.emails[index];
    await f.unmount();
    const savedTop = Number(sessionStorage.getItem("edm-emails-list-scroll"));
    assert.equal(JSON.parse(sessionStorage.getItem("edm-emails-list-anchor")).key, key);
    if (reason === "不存在") f.emails.splice(index, 1);
    else f.window.location.hash = `#emails/all/${email.brand === "Zara" ? "Halara" : "Zara"}`;
    await f.mount();
    await f.flushFrames();
    assert.equal(f.scroller().scrollTop, savedTop, "使用原有像素回退流程且不会因缺失锚点而抛错");
    assert.ok(f.rows().length > 0);
    assert.ok(f.rows().every((row) => row.getAttribute("data-email-row") !== key));
  });
}
