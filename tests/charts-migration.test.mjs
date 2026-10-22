import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { act, createElement as h } from "react";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { flushPromises } from "./source-module.mjs";

const tdSource = readFileSync(new URL("../src/components/ThemeDistribution.tsx", import.meta.url), "utf8");
const btbSource = readFileSync(new URL("../src/components/BrandThemeBreakdown.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

// 与迁移前一致的期望值（按迁移前手写公式手算）：
// Zara：price 5、new 3、other 2（共 10）；Halara：price 6、behavior 4（共 10）；总计 20。
// 主题合计：price 11（55%）、behavior 4（20%）、new 3（15%）、other 2（10%）。
// 「仅营销主题」开：分母 20-2=18 → price 61%、behavior 22%、new 17%（Math.round 口径）。
function fixtureEmails() {
  const mk = (brand, theme, i) => ({
    date: "2026-10-05", brand, theme, keywords: [], market: "US", day_seq: 1, source_index: i,
  });
  const emails = [];
  let i = 0;
  for (let n = 0; n < 5; n++) emails.push(mk("Zara", "price", i++));
  for (let n = 0; n < 3; n++) emails.push(mk("Zara", "new", i++));
  for (let n = 0; n < 2; n++) emails.push(mk("Zara", "other", i++));
  for (let n = 0; n < 6; n++) emails.push(mk("Halara", "price", i++));
  for (let n = 0; n < 4; n++) emails.push(mk("Halara", "behavior", i++));
  return emails;
}

// Recharts 在挂载宿主里需要尺寸/媒体查询桩（与 email-table.test.mjs 注入 ResizeObserver 的做法一致）。
function stubChartEnv(dom, t, size = 300) {
  const rect = { width: size, height: size, top: 0, left: 0, right: size, bottom: size, x: 0, y: 0, toJSON() { return {}; } };
  const origCreate = dom.document.createElement.bind(dom.document);
  const patched = (name) => {
    const el = origCreate(name);
    el.getBoundingClientRect = () => rect;
    return el;
  };
  dom.document.createElement = patched;
  dom.document.createElementNS = patched;
  dom.window.matchMedia = () => ({
    matches: false, media: "", addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  });
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.callback([{ target, contentRect: rect }]); }
    unobserve() {}
    disconnect() {}
  }
  dom.window.ResizeObserver = ResizeObserverStub;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  globalThis.ResizeObserver = ResizeObserverStub;
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "ResizeObserver", previous);
    else delete globalThis.ResizeObserver;
  });
}

async function mountWithFixture(t, locale, renderTree, customEmails) {
  const dom = await mountDOM(t);
  stubChartEnv(dom, t);
  const emails = customEmails ?? fixtureEmails();
  const graph = sourceGraph({
    overrides: {
      "email-data.ts": {
        EXTENDED_EMAIL_META: { windowStart: "2026-07-20", windowEnd: "2026-10-20" },
        getEmailMarket: (email) => (email.market ?? "US").trim().toUpperCase() || "US",
        matchesMarket: (email, market) => market === null || email.market === market,
        useExtendedEmails: () => ({
          status: "ready", error: null, emails, total: emails.length, retry: () => {},
          meta: { dataSource: "supabase" },
        }),
      },
    },
  });
  const i18n = graph.load("i18n/index.tsx");
  await i18n.default.changeLanguage(locale);
  const site = graph.load("site-data.tsx");
  await dom.render(h(site.SiteProvider, null, renderTree(graph)));
  await flushPromises();
  return { dom, graph, translate: i18n.translate };
}

const propsOf = (node) => node[Object.keys(node).find((key) => key.startsWith("__reactProps$"))];
async function callProp(node, name, arg) {
  await act(() => { propsOf(node)[name](arg); });
  await flushPromises();
}
const emailAnchors = (root) =>
  descendants(root, (node) => node.nodeName === "A" && (node.getAttribute("href") ?? "").startsWith("#emails/"));

describe("图表迁移到 shadcn Chart（Recharts）", () => {
  it("源码契约：两图改走 Recharts，手写环图弧线公式已移除", () => {
    assert.ok(tdSource.includes('from "recharts"') && tdSource.includes("PieChart"), "环形图必须用 Recharts PieChart");
    assert.ok(tdSource.includes('from "./ui/chart"') && tdSource.includes("ChartContainer"), "环形图必须挂 ChartContainer");
    assert.ok(!tdSource.includes("slicePath"), "手写切片弧线公式应随迁移移除");
    assert.ok(btbSource.includes("BarChart") && btbSource.includes('stackOffset="expand"'), "堆叠条必须用 Recharts 横向 100% 堆叠");
    assert.ok(btbSource.includes("ChartContainer"), "堆叠条必须挂 ChartContainer");
    // 悬停/锁定的淡化与高亮由 CSS 驱动：图表元素 memoize 后状态变化不重建 SVG 节点，
    // 否则聚焦中的切片/分段会被卸载、键盘焦点丢失（复审 P1）。通用淡化在 index.css；
    // 当前主题的恢复规则由组件按数据键动态生成，未知主题键同样覆盖（复审二轮回归点）。
    assert.ok(cssSource.includes('.td-chart[data-hovered]:not([data-hovered=""]) .td-sector-path'), "环形图非悬停切片应有 CSS 淡化规则");
    assert.ok(cssSource.includes('.btb-scope[data-highlighted]:not([data-highlighted=""]) .btb-sector-path'), "堆叠条非锁定分段应有 CSS 淡化规则");
    assert.ok(cssSource.includes(".btb-sector-path:focus-visible"), "分段聚焦描边应由 CSS 提供");
    assert.ok(tdSource.includes('.td-chart[data-hovered="${k}"] .td-sector-link[data-sector-key="${k}"] .td-sector-path'), "环形图恢复规则应由组件按数据键生成");
    assert.ok(btbSource.includes('.btb-scope[data-highlighted="${k}"] .btb-sector-path[data-key="${k}"]'), "堆叠条恢复规则应由组件按数据键生成");
  });

  it("环形图：同 fixture 下封数/占比/中心总数与迁移前一致，开关剔 other 后重算", async (t) => {
    const { dom, translate } = await mountWithFixture(t, "zh", (graph) => {
      const { ThemeDistribution } = graph.load("components/ThemeDistribution.tsx");
      return h(ThemeDistribution);
    });
    const container = dom.container;

    // 切片链接与图例链接各 4 条（price/behavior/new/other）。
    const anchors = emailAnchors(container);
    assert.equal(anchors.length, 8, "切片 4 + 图例 4 条邮件链接");
    assert.deepEqual(
      [...new Set(anchors.map((a) => a.getAttribute("href")))].sort(),
      ["#emails/behavior", "#emails/new", "#emails/other", "#emails/price"],
    );

    // 中心总数与默认文案。
    const centerNumber = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("text-3xl"))[0];
    assert.equal(centerNumber.textContent, "20");
    assert.ok(container.textContent.includes(translate("tdCenterAll")), "中心应显示全部邮件文案");

    // 切片内占比标注（跨度 >= 25° 的四片都标注）。
    const sliceLabels = descendants(container, (n) => n.nodeName === "TEXT")
      .map((n) => n.textContent).filter((text) => /^\d+%$/.test(text));
    assert.deepEqual(sliceLabels.sort(), ["10%", "15%", "20%", "55%"]);

    // 图例卡片的封数与占比（迁移前数值）。
    const legend = descendants(container, (n) => n.getAttribute("role") === "group" && n.getAttribute("aria-label") === translate("tdLegendAria"))[0];
    const legendText = descendants(legend, (n) => n.nodeName === "A").map((a) => a.textContent.replace(/\s+/g, " ").trim());
    assert.ok(legendText.some((text) => text.includes("价格促销") && text.includes("11") && text.includes("55%")), `price 图例应为 11 封 · 55%：${legendText}`);
    assert.ok(legendText.some((text) => text.includes("行为触发") && text.includes("4") && text.includes("20%")), `behavior 图例应为 4 封 · 20%：${legendText}`);
    assert.ok(legendText.some((text) => text.includes("上新") && text.includes("3") && text.includes("15%")), `new 图例应为 3 封 · 15%：${legendText}`);
    assert.ok(legendText.some((text) => text.includes("其他") && text.includes("2") && text.includes("10%")), `other 图例应为 2 封 · 10%：${legendText}`);

    // 悬停切片：中心切换为该主题封数/占比；淡化/描边由 CSS 按 wrapper 的 data-hovered 驱动
    // （规则已在源码契约里钉住），且图表节点不得被替换——聚焦连续性正是复审 P1 的回归点。
    const chartWrap = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("td-chart"))[0];
    assert.ok(chartWrap, "环形图 wrapper 应存在");
    const priceSlice = anchors.find((a) => a.getAttribute("href") === "#emails/price"
      && descendants(a, (n) => n.nodeName === "PATH").length > 0);
    const pricePath = descendants(priceSlice, (n) => n.nodeName === "PATH")[0];
    const behaviorSlice = anchors.find((a) => a.getAttribute("href") === "#emails/behavior"
      && descendants(a, (n) => n.nodeName === "PATH").length > 0);
    const behaviorPath = descendants(behaviorSlice, (n) => n.nodeName === "PATH")[0];
    assert.equal(pricePath.getAttribute("fill"), "var(--sector-color)", "切片填充应走自身主题色变量");
    assert.equal(priceSlice.style["--sector-color"], "var(--theme-price)", "price 切片变量应为既有主题色");
    assert.equal(behaviorSlice.style["--sector-color"], "var(--theme-behavior)");
    await callProp(priceSlice, "onMouseEnter");
    const centerAfter = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("text-3xl"))[0];
    assert.equal(centerAfter.textContent, "11", "悬停 price 后中心应显示该主题封数");
    assert.equal(chartWrap.getAttribute("data-hovered"), "price", "wrapper 应记录悬停主题供 CSS 淡化其余切片");
    assert.ok(emailAnchors(container).includes(priceSlice), "悬停后切片链接节点不得被替换");
    assert.ok(descendants(priceSlice, (n) => n.nodeName === "PATH")[0] === pricePath, "悬停后扇区 path 节点不得被替换");
    assert.ok(descendants(behaviorSlice, (n) => n.nodeName === "PATH")[0] === behaviorPath, "其余切片节点同样不得被替换");

    // 键盘聚焦切片：节点保持挂载且仍是 activeElement；Esc 清除悬停；Enter 跳转邮件锚点。
    priceSlice.focus();
    await callProp(priceSlice, "onFocus");
    assert.equal(dom.document.activeElement, priceSlice, "聚焦后切片链接应仍是焦点元素（未被卸载）");
    assert.equal(chartWrap.getAttribute("data-hovered"), "price");
    let escWrap = priceSlice;
    while (escWrap && !propsOf(escWrap)?.onKeyDownCapture) escWrap = escWrap.parentNode;
    assert.ok(escWrap, "应存在捕获 Esc 的外层容器");
    await callProp(escWrap, "onKeyDownCapture", { key: "Escape" });
    assert.equal(chartWrap.getAttribute("data-hovered"), null, "Esc 应清除悬停主题");
    await callProp(priceSlice, "onKeyDown", { key: "Enter", preventDefault() {}, stopPropagation() {} });
    assert.equal(dom.window.location.hash, "#emails/price", "Enter 应跳转到该主题邮件锚点");
    await callProp(priceSlice, "onMouseLeave");

    // 开「仅营销主题」：分母变 18、other 消失、占比按 activeTotal 重算。
    const toggle = descendants(container, (n) => n.nodeName === "BUTTON" && n.getAttribute("aria-pressed") !== null)[0];
    assert.ok(toggle, "other 在 0 与总数之间时应提供开关");
    await callProp(toggle, "onClick");
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    const anchorsAfter = emailAnchors(container);
    assert.equal(anchorsAfter.length, 6, "剔除 other 后切片 3 + 图例 3");
    assert.ok(!anchorsAfter.some((a) => a.getAttribute("href") === "#emails/other"));
    const centerExcluded = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("text-3xl"))[0];
    assert.equal(centerExcluded.textContent, "18");
    const legendAfter = descendants(container, (n) => n.getAttribute("role") === "group" && n.getAttribute("aria-label") === translate("tdLegendAria"))[0];
    const legendAfterText = descendants(legendAfter, (n) => n.nodeName === "A").map((a) => a.textContent.replace(/\s+/g, " ").trim());
    assert.ok(legendAfterText.some((text) => text.includes("价格促销") && text.includes("61%")), `剔除后 price 应为 61%：${legendAfterText}`);
    assert.ok(legendAfterText.some((text) => text.includes("行为触发") && text.includes("22%")), `剔除后 behavior 应为 22%：${legendAfterText}`);
    assert.ok(legendAfterText.some((text) => text.includes("上新") && text.includes("17%")), `剔除后 new 应为 17%：${legendAfterText}`);
  });

  it("图例英文长名不重叠：名称与计数是独立流式布局，名称可任意断行、计数不换行", async (t) => {
    const { dom } = await mountWithFixture(t, "en", (graph) => {
      const { ThemeDistribution } = graph.load("components/ThemeDistribution.tsx");
      return h(ThemeDistribution);
    });
    const container = dom.container;
    const legend = descendants(container, (n) => n.getAttribute("role") === "group" && n.getAttribute("aria-label") === "Theme legend, click to view matching emails" || (n.getAttribute("role") === "group" && (n.getAttribute("class") ?? "").includes("chart-legend")))[0];
    assert.ok(legend, "应找到图例组");
    const items = descendants(legend, (n) => n.nodeName === "A");
    assert.equal(items.length, 4);
    for (const name of ["Price Promotion", "Behavior-triggered", "New Arrival", "Other"]) {
      const item = items.find((a) => a.textContent.includes(name));
      assert.ok(item, `图例应含 ${name}`);
      const itemClass = item.getAttribute("class") ?? "";
      // 布局结构：grid 两列（名称列 minmax(0,1fr) 可收缩、计数列 auto 固定），无绝对定位。
      assert.ok(itemClass.includes("grid") && itemClass.includes("grid-cols-[minmax(0,1fr)_auto]"), `${name}：图例卡应为名称/计数两列流式网格`);
      assert.ok(!itemClass.includes("absolute"), `${name}：图例卡不得用绝对定位`);
      const nameMatches = descendants(item, (n) => n.nodeName === "SPAN" && n.textContent === name);
      const nameSpan = nameMatches.at(-1);
      assert.ok(nameSpan, `${name}：名称应是独立元素且文本完整未截断`);
      assert.ok((nameSpan.getAttribute("class") ?? "").includes("[overflow-wrap:anywhere]"), `${name}：名称必须允许任意断行`);
      const countSpan = descendants(item, (n) => n.nodeName === "SPAN" && /emails?/.test(n.textContent) && n !== nameSpan
        && !descendants(n, (m) => m === nameSpan).length)[0];
      assert.ok(countSpan, `${name}：计数应是与名称独立的元素`);
      assert.ok((countSpan.getAttribute("class") ?? "").includes("whitespace-nowrap"), `${name}：计数保持单行不换行`);
      assert.ok(!descendants(nameSpan, (n) => n === countSpan).length, `${name}：计数不得嵌套在名称内`);
    }
    // 源码契约同步钉住布局写法，防止回退到会碰撞的写法。
    assert.ok(tdSource.includes("grid-cols-[minmax(0,1fr)_auto]"), "图例布局类必须保留在源码中");
    assert.ok(tdSource.includes("[overflow-wrap:anywhere]"), "图例名称断行类必须保留在源码中");
  });

  it("品牌堆叠条：同 fixture 下分段占比/封数/右侧总数与迁移前一致，点品牌名回调、图例锁定淡化", async (t) => {
    let selected = null;
    const { dom, translate } = await mountWithFixture(t, "zh", (graph) => {
      const { BrandThemeBreakdown } = graph.load("components/BrandThemeBreakdown.tsx");
      return h(BrandThemeBreakdown, { onSelectBrand: (brand) => { selected = brand; } });
    });
    const container = dom.container;

    // 分段（可聚焦 path，aria-label 为迁移前的 btbSegLabel 全文）。
    const segs = descendants(container, (n) => n.nodeName === "PATH" && n.getAttribute("role") === "img");
    assert.equal(segs.length, 5, "Zara 3 段 + Halara 2 段");
    const segLabels = segs.map((s) => s.getAttribute("aria-label"));
    assert.ok(segLabels.includes(translate("btbSegLabel", { brand: "Zara", theme: "价格促销", count: 5, pct: 50, total: 10 })), `Zara price 段标签：${segLabels}`);
    assert.ok(segLabels.includes(translate("btbSegLabel", { brand: "Zara", theme: "上新", count: 3, pct: 30, total: 10 })));
    assert.ok(segLabels.includes(translate("btbSegLabel", { brand: "Zara", theme: "其他", count: 2, pct: 20, total: 10 })));
    assert.ok(segLabels.includes(translate("btbSegLabel", { brand: "Halara", theme: "价格促销", count: 6, pct: 60, total: 10 })));
    assert.ok(segLabels.includes(translate("btbSegLabel", { brand: "Halara", theme: "行为触发", count: 4, pct: 40, total: 10 })));
    for (const seg of segs) assert.equal(seg.getAttribute("tabindex"), "0", "分段应可键盘聚焦");

    // 分段宽度占比与封数占比一致，且每条各段宽之和相同（总长恒为 100%）。
    const widthsByBrand = new Map();
    for (const seg of segs) {
      const [brand] = (seg.getAttribute("aria-label") ?? "").split(" · ");
      const list = widthsByBrand.get(brand) ?? [];
      list.push({ label: seg.getAttribute("aria-label"), w: Number(seg.getAttribute("data-w")) });
      widthsByBrand.set(brand, list);
    }
    const zaraWidths = widthsByBrand.get("Zara");
    const halaraWidths = widthsByBrand.get("Halara");
    const zaraTotalW = zaraWidths.reduce((sum, s) => sum + s.w, 0);
    const halaraTotalW = halaraWidths.reduce((sum, s) => sum + s.w, 0);
    assert.ok(Math.abs(zaraTotalW - halaraTotalW) <= 2, `两品牌条总长应一致（100% 口径）：${zaraTotalW} vs ${halaraTotalW}`);
    const ratioOf = (list, total, needle) => list.find((s) => s.label.includes(needle)).w / total;
    assert.ok(Math.abs(ratioOf(zaraWidths, zaraTotalW, "价格促销") - 0.5) < 0.03, "Zara price 段应占条宽 50%");
    assert.ok(Math.abs(ratioOf(zaraWidths, zaraTotalW, "上新") - 0.3) < 0.03, "Zara new 段应占条宽 30%");
    assert.ok(Math.abs(ratioOf(zaraWidths, zaraTotalW, "其他") - 0.2) < 0.03, "Zara other 段应占条宽 20%");
    assert.ok(Math.abs(ratioOf(halaraWidths, halaraTotalW, "价格促销") - 0.6) < 0.03, "Halara price 段应占条宽 60%");
    assert.ok(Math.abs(ratioOf(halaraWidths, halaraTotalW, "行为触发") - 0.4) < 0.03, "Halara behavior 段应占条宽 40%");

    // 条内百分比标签：宽段（>=14%）全标。
    const pctTexts = descendants(container, (n) => n.nodeName === "TEXT").map((n) => n.textContent);
    for (const pct of ["50%", "30%", "20%", "60%", "40%"]) {
      assert.ok(pctTexts.includes(pct), `条内应标注 ${pct}`);
    }

    // 右侧总数与 0 封品牌注记。
    const totals = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("tabular-nums"))
      .map((n) => n.textContent.replace(/\s+/g, " ").trim());
    assert.ok(totals.filter((text) => text.startsWith("10")).length >= 2, `Zara/Halara 总数应各为 10 封：${totals}`);
    assert.ok(container.textContent.includes(translate("btbZeroNote")), "0 封品牌应有未收录注记");

    // 图例锁定 behavior：淡化由 CSS 按作用域 data-highlighted 驱动（规则已在源码契约钉住），
    // 分段节点不得被替换；聚焦分段后按 Esc 必须能解除锁定（复审 P1 的回归点）。
    const scope = descendants(container, (n) => (n.getAttribute("class") ?? "").includes("btb-scope"))[0];
    assert.ok(scope, "堆叠条作用域 wrapper 应存在");
    const legendButtons = descendants(container, (n) => n.nodeName === "BUTTON" && n.getAttribute("aria-pressed") !== null);
    const behaviorButton = legendButtons.find((b) => b.textContent.includes("行为触发"));
    assert.ok(behaviorButton, "图例应含行为触发按钮");
    const zaraPriceBefore = segs.find((s) => (s.getAttribute("aria-label") ?? "").startsWith("Zara · 价格促销"));
    const halaraBehavior = segs.find((s) => (s.getAttribute("aria-label") ?? "").startsWith("Halara · 行为触发"));
    assert.equal(zaraPriceBefore.getAttribute("fill"), "var(--sector-color)", "分段填充应走自身主题色变量");
    assert.equal(zaraPriceBefore.style["--sector-color"], "var(--theme-price)");
    assert.equal(halaraBehavior.style["--sector-color"], "var(--theme-behavior)");
    await callProp(behaviorButton, "onClick");
    assert.equal(behaviorButton.getAttribute("aria-pressed"), "true");
    assert.equal(scope.getAttribute("data-highlighted"), "behavior", "作用域应记录锁定主题供 CSS 淡化其余分段");
    const segsAfter = descendants(container, (n) => n.nodeName === "PATH" && n.getAttribute("role") === "img");
    assert.ok(segsAfter.includes(zaraPriceBefore), "锁定后分段节点不得被替换");

    // 聚焦 Halara behavior 段：节点保持挂载、焦点不丢；Esc（冒泡到作用域）解除锁定。
    halaraBehavior.focus();
    await callProp(halaraBehavior, "onFocus");
    assert.equal(dom.document.activeElement, halaraBehavior, "聚焦后分段应仍是焦点元素（未被卸载）");
    await callProp(scope, "onKeyDown", { key: "Escape" });
    assert.equal(behaviorButton.getAttribute("aria-pressed"), "false", "Esc 应解除图例锁定");
    assert.equal(scope.getAttribute("data-highlighted"), null);
    assert.ok(descendants(container, (n) => n.nodeName === "PATH" && n.getAttribute("role") === "img").includes(halaraBehavior), "Esc 后分段节点仍应挂载");
    // 再次点击锁定、再点清除的原有行为保留。
    await callProp(behaviorButton, "onClick");
    assert.equal(behaviorButton.getAttribute("aria-pressed"), "true");
    await callProp(behaviorButton, "onClick");
    assert.equal(behaviorButton.getAttribute("aria-pressed"), "false");

    // 点击品牌名 → onSelectBrand 收到聚合品牌。
    const zaraButton = descendants(container, (n) => n.nodeName === "BUTTON" && n.textContent === "Zara")[0];
    await callProp(zaraButton, "onClick");
    assert.ok(selected && selected.name === "Zara" && selected.total === 10, `点品牌名应回调聚合品牌：${JSON.stringify(selected)}`);
  });

  const winbackEmails = () => {
    const mk = (brand, theme, i) => ({
      date: "2026-10-05", brand, theme, keywords: [], market: "US", day_seq: 1, source_index: i,
    });
    return [
      ...Array.from({ length: 5 }, (_, i) => mk("Zara", "price", i)),
      ...Array.from({ length: 5 }, (_, i) => mk("Zara", "winback", 10 + i)),
    ];
  };
  const styleText = (container) => descendants(container, (n) => n.nodeName === "STYLE").map((n) => n.textContent).join("\n");

  it("未知主题键（winback）：环形图恢复规则按数据键生成、悬停状态正确接线", async (t) => {
    const tdMount = await mountWithFixture(t, "zh", (graph) => {
      const { ThemeDistribution } = graph.load("components/ThemeDistribution.tsx");
      return h(ThemeDistribution);
    }, winbackEmails());
    const tdStyle = styleText(tdMount.dom.container);
    assert.ok(tdStyle.includes('.td-chart[data-hovered="winback"] .td-sector-link[data-sector-key="winback"] .td-sector-path'), "环形图应为未知主题生成恢复规则");
    assert.ok(tdStyle.includes('.td-chart[data-hovered="price"] .td-sector-link[data-sector-key="price"] .td-sector-path'), "已知主题的恢复规则同样生成");
    const winbackSlice = emailAnchors(tdMount.dom.container).find((a) => a.getAttribute("href") === "#emails//all/winback"
      && descendants(a, (n) => n.nodeName === "PATH").length > 0);
    assert.ok(winbackSlice, "未知主题应有切片链接");
    await callProp(winbackSlice, "onMouseEnter");
    const chartWrap = descendants(tdMount.dom.container, (n) => (n.getAttribute("class") ?? "").includes("td-chart"))[0];
    assert.equal(chartWrap.getAttribute("data-hovered"), "winback", "悬停未知主题应记录到 wrapper 供生成的规则命中");
  });

  it("未知主题键（winback）：堆叠条恢复规则按数据键生成、锁定状态正确接线", async (t) => {
    const btbMount = await mountWithFixture(t, "zh", (graph) => {
      const { BrandThemeBreakdown } = graph.load("components/BrandThemeBreakdown.tsx");
      return h(BrandThemeBreakdown, { onSelectBrand: () => {} });
    }, winbackEmails());
    const btbStyle = styleText(btbMount.dom.container);
    assert.ok(btbStyle.includes('.btb-scope[data-highlighted="winback"] .btb-sector-path[data-key="winback"]'), "堆叠条应为未知主题生成恢复规则");
    const winbackSegs = descendants(btbMount.dom.container, (n) => n.nodeName === "PATH" && n.getAttribute("role") === "img" && n.getAttribute("data-key") === "winback");
    assert.equal(winbackSegs.length, 1, "未知主题应有分段");
    const legendButtons = descendants(btbMount.dom.container, (n) => n.nodeName === "BUTTON" && n.getAttribute("aria-pressed") !== null);
    assert.equal(legendButtons.length, 2, "图例应含 price 与未知主题 winback");
    const winbackButton = legendButtons.find((b) => b.textContent.includes("winback")) ?? legendButtons[1];
    await callProp(winbackButton, "onClick");
    const scope = descendants(btbMount.dom.container, (n) => (n.getAttribute("class") ?? "").includes("btb-scope"))[0];
    assert.equal(scope.getAttribute("data-highlighted"), "winback", "锁定未知主题应记录到作用域供生成的规则命中");
  });
});
