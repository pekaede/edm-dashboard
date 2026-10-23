import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { act, createElement } from "react";
import * as seo from "../src/seo.ts";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";
import { createClock, loadSourceModule } from "./source-module.mjs";

// 变异只改本测试读取/编译的内存源码；可用 run-boot-recovery-mutations.mjs 重放。
const mutation = process.env.EDM_BOOT_MUTATION ? JSON.parse(process.env.EDM_BOOT_MUTATION) : null;
function mutate(path, source) {
  if (mutation?.path !== path) return source;
  assert.equal(source.split(mutation.before).length - 1, 1, "变异锚点须唯一");
  return source.replace(mutation.before, mutation.after);
}
const readSource = (path) => mutate(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const html = readSource("index.html");
const watchdog = (document) => document.match(/<script id="boot-watchdog">([\s\S]*?)<\/script>/)?.[1];

async function fixture(t, lang = "zh-CN") {
  const dom = await mountDOM(t);
  const clock = createClock();
  // 补齐宿主未实现的原生 DOM 查询与 lang 反射，不模拟任何启动业务逻辑。
  dom.container.setAttribute("id", "root");
  dom.document.getElementById = (id) => descendants(dom.document, (node) => node.getAttribute("id") === id)[0] ?? null;
  Object.defineProperty(dom.document.documentElement, "lang", {
    get() { return this.getAttribute("lang") ?? ""; },
  });
  dom.document.documentElement.setAttribute("lang", lang);
  const intro = dom.container.appendChild(dom.document.createElement("header"));
  const link = intro.appendChild(dom.document.createElement("a"));
  link.setAttribute("href", "/#emails");
  link.textContent = "邮件";
  let reloads = 0;
  dom.window.location.reload = () => { reloads += 1; };
  // 记录真实监听器的捕获选项；宿主不模拟 DOM 冒泡，下面显式派发资源事件。
  const listeners = new Map();
  const add = dom.window.addEventListener.bind(dom.window);
  const remove = dom.window.removeEventListener.bind(dom.window);
  dom.window.addEventListener = (name, listener, capture) => {
    if (name === "error") listeners.set(listener, capture);
    add(name, listener, capture);
  };
  dom.window.removeEventListener = (name, listener, capture) => {
    if (name === "error") listeners.delete(listener);
    remove(name, listener, capture);
  };
  function resourceError(tag = "script", type = "module") {
    const target = dom.document.createElement(tag);
    target.setAttribute("type", type);
    const event = new Event("error");
    Object.defineProperty(event, "target", { value: target });
    dom.window.dispatchEvent(event);
  }
  function start() {
    const script = watchdog(html);
    assert.ok(script, "首页必须包含看门狗");
    runInNewContext(script, { window: dom.window, document: dom.document, ...clock.globals });
  }
  return {
    ...dom, clock, intro, link, listeners, resourceError, start,
    panels: () => descendants(dom.container, (node) => node.getAttribute("id") === "boot-error"),
    reloads: () => reloads,
  };
}

function bootEntry(dom) {
  return act(() => loadSourceModule("main.tsx", {
    transformSource: (source) => mutate("src/main.tsx", source),
    imports: {
      "./index.css": {},
      "./App": {
        __esModule: true,
        default: () => createElement("main", null, "Application mounted"),
        ErrorBoundary: ({ children }) => children,
      },
      "./i18n": { useLocale: () => ({ t: (key) => key }) },
      "react-dom/client": { createRoot(container) {
        assert.equal(dom.window.__edmBooted, true, "创建 React root 前必须标记启动");
        assert.equal(container, dom.container);
        return dom.root;
      } },
    },
  }));
}

it("N3 noscript：双语提示通过 html lang 选择，无需 JavaScript 或外部 CSS", () => {
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
  assert.ok(noscript);
  assert.match(noscript, /<p id="js-required-zh" lang="zh">请启用 JavaScript 以使用本站<\/p>/);
  assert.match(noscript, /<p id="js-required-en" lang="en">JavaScript is required to use this site<\/p>/);
  assert.match(noscript, /<style>[\s\S]*#js-required-en\s*\{\s*display:\s*none;\s*\}/);
  assert.match(noscript, /html:lang\(en\) #js-required-zh\s*\{\s*display:\s*none;\s*\}/);
  assert.match(noscript, /html:lang\(en\) #js-required-en\s*\{\s*display:\s*block;\s*\}/);
});

it("N3 接线：经典看门狗先于 module，捕获资源错误并注册 9 秒超时", () => {
  const script = watchdog(html);
  assert.ok(script);
  assert.ok(html.indexOf('<script id="boot-watchdog">') < html.indexOf('<script type="module"'));
  assert.match(script, /window\.addEventListener\("error", onError, true\)/);
  assert.match(script, /target\.tagName === "SCRIPT" && target\.getAttribute\("type"\) === "module"/);
  assert.match(script, /setTimeout\(showFailure, 9000\)/);
  assert.match(script, /window\.__edmBooted/);
  assert.match(script, /document\.documentElement\.lang/);
});

it("N3 入口：main.tsx 在创建 React root 前置启动标志", () => {
  const source = readSource("src/main.tsx");
  assert.match(source, /window\.__edmBooted = true;/);
  assert.ok(source.indexOf("window.__edmBooted = true;") < source.indexOf("createRoot(document"));
});

for (const [lang, message, label] of [
  ["zh-CN", "页面资源加载失败，请检查网络后重新加载。", "重新加载"],
  ["en-US", "Page resources failed to load. Check your connection and reload.", "Reload"],
]) {
  it(`N3 超时（${lang}）：保留预渲染介绍，追加失败面板且按钮实际调用 reload`, async (t) => {
    const dom = await fixture(t, lang);
    dom.start();
    assert.deepEqual([...dom.listeners.values()], [true]);
    dom.clock.advance(8999);
    assert.deepEqual(dom.container.childNodes, [dom.intro], "超时前不得创建占位面板");
    dom.clock.advance(1);
    const [panel] = dom.panels();
    assert.ok(panel, "入口未启动时超时必须显示失败面板");
    assert.equal(panel.getAttribute("role"), "alert");
    assert.equal(panel.firstChild.textContent, message);
    assert.equal(dom.container.firstChild, dom.intro);
    assert.equal(dom.link.getAttribute("href"), "/#emails");
    const buttons = descendants(panel, (node) => node.nodeName === "BUTTON");
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].textContent, label);
    assert.equal(buttons[0].getAttribute("type"), "button");
    buttons[0].dispatchEvent(new Event("click"));
    assert.equal(dom.reloads(), 1, "重载按钮必须接到 window.location.reload");
    dom.resourceError();
    dom.clock.advance(9000);
    assert.equal(dom.panels().length, 1, "错误与超时不得重复注入");
    assert.equal(dom.clock.pendingCount(), 0);
    assert.equal(dom.listeners.size, 0);
  });
}

it("N3 资源错误：入口或静态依赖失败传到 module 元素时立即显示面板", async (t) => {
  const dom = await fixture(t);
  dom.start();
  dom.resourceError();
  assert.equal(dom.panels().length, 1, "资源错误不应等待超时");
  assert.equal(dom.clock.pendingCount(), 0);
  assert.equal(dom.listeners.size, 0);
});

it("N3 无关错误：图片、经典脚本与运行时 error 不提前触发失败面板", async (t) => {
  const dom = await fixture(t);
  dom.start();
  dom.resourceError("img");
  dom.resourceError("script", "text/javascript");
  dom.window.dispatchEvent(new Event("error"));
  assert.deepEqual(dom.container.childNodes, [dom.intro]);
  dom.clock.advance(9000);
  assert.equal(dom.panels().length, 1);
});

it("N3 已启动：置标志后 module 错误与超时都不留下任何面板节点", async (t) => {
  const dom = await fixture(t);
  dom.window.__edmBooted = true;
  dom.start();
  dom.resourceError();
  dom.clock.advance(9000);
  assert.deepEqual(dom.container.childNodes, [dom.intro]);
  assert.equal(dom.panels().length, 0);
  assert.equal(dom.clock.pendingCount(), 0);
  assert.equal(dom.listeners.size, 0);
});

it("N3 正常加载：计时中置标志，超时后 DOM 无残留且移除监听器", async (t) => {
  const dom = await fixture(t);
  dom.start();
  dom.clock.advance(1000);
  dom.window.__edmBooted = true;
  dom.clock.advance(8000);
  assert.deepEqual(dom.container.childNodes, [dom.intro]);
  assert.equal(dom.clock.pendingCount(), 0);
  assert.equal(dom.listeners.size, 0);
});

it("N3 入口挂载：执行真实 main.tsx 后 React 正常提交，超时无面板", async (t) => {
  const dom = await fixture(t);
  dom.start();
  await bootEntry(dom);
  assert.equal(dom.window.__edmBooted, true);
  dom.clock.advance(9000);
  assert.equal(dom.container.textContent, "Application mounted");
  assert.equal(dom.panels().length, 0);
});

it("N3 延迟启动：超时面板与介绍在首次 React commit 时一并替换", async (t) => {
  const dom = await fixture(t);
  dom.start();
  dom.clock.advance(9000);
  assert.equal(dom.panels().length, 1);
  await bootEntry(dom);
  assert.equal(dom.container.textContent, "Application mounted");
  assert.equal(dom.panels().length, 0);
});

it("N3 预渲染：执行真实 SEO hook 保留 noscript/看门狗，不生成失败面板或污染市场页", () => {
  const { SiteIntroduction } = sourceGraph().load("components/SiteIntroduction.tsx");
  const { seoPlugin } = loadSourceModule("../scripts/seo-plugin.ts", {
    imports: { vite: {}, "../src/components/SiteIntroduction": { SiteIntroduction }, "../src/seo": seo },
  });
  const output = seoPlugin().transformIndexHtml.handler(html);
  assert.equal(watchdog(output), watchdog(html));
  assert.equal(output.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0], html.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0]);
  assert.match(output, /<div id="root"><div class="dashboard-shell/);
  assert.match(output, /<h1\b/);
  for (const view of ["emails", "dashboard", "report"]) assert.ok(output.includes(`href="/#${view}"`));
  assert.doesNotMatch(output, /<section\b[^>]*id="boot-error"/);
  for (const market of seo.SEO_MARKETS) {
    const page = seo.renderMarketDocument(output, seo.buildMarketPage(market, null, "2026-10-23"));
    assert.doesNotMatch(page, /boot-watchdog|boot-error|<noscript>|type="module"/);
    assert.ok(page.includes(market.name));
  }
});
