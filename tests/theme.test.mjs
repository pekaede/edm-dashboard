import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { act, createElement as h, StrictMode } from "react";
import { resolveInitialTheme } from "../src/theme.ts";
import { descendants, mountDOM } from "./mounted-dom.mjs";
import { sourceGraph } from "./mounted-source.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const initializer = html.match(/<script id="theme-init">([\s\S]*?)<\/script>/)?.[1];
assert.ok(initializer, "必须保留首屏内联初始化脚本");

const decisions = [
  { name: "保存 dark 优先于系统 light", saved: "dark", media: false, expected: "dark", mediaCalls: 0 },
  { name: "保存 light 优先于系统 dark", saved: "light", media: true, expected: "light", mediaCalls: 0 },
  { name: "无记录跟随系统 dark", media: true, expected: "dark", mediaCalls: 1 },
  { name: "无记录跟随系统 light", media: false, expected: "light", mediaCalls: 1 },
  { name: "无效记录回退系统偏好", saved: "invalid", media: true, expected: "dark", mediaCalls: 1 },
  { name: "读取 storage 抛错仍跟随系统", storageError: true, media: true, expected: "dark", mediaCalls: 1 },
  { name: "无媒体查询 API 默认 light", noMedia: true, expected: "light", mediaCalls: 0 },
  { name: "媒体查询抛错默认 light", mediaError: true, expected: "light", mediaCalls: 1 },
  { name: "两个 API 都不可用默认 light", storageError: true, noMedia: true, expected: "light", mediaCalls: 0 },
];

for (const scenario of decisions) {
  it(`主题初始化：${scenario.name}，运行时与首屏脚本结果一致`, () => {
    for (const run of ["runtime", "inline"]) {
      let mediaCalls = 0;
      const browser = {
        get localStorage() {
          if (scenario.storageError) throw new Error("storage denied");
          return { getItem(key) {
            assert.equal(key, "edm-theme");
            return scenario.saved ?? null;
          } };
        },
        matchMedia: scenario.noMedia ? undefined : (query) => {
          mediaCalls += 1;
          assert.equal(query, "(prefers-color-scheme: dark)");
          if (scenario.mediaError) throw new Error("media denied");
          return { matches: scenario.media };
        },
      };
      let theme;
      if (run === "runtime") theme = resolveInitialTheme(browser);
      else runInNewContext(initializer, {
        window: browser,
        document: { documentElement: { setAttribute(name, value) {
          assert.equal(name, "data-theme");
          theme = value;
        } } },
      });
      assert.equal(theme, scenario.expected, run);
      assert.equal(mediaCalls, scenario.mediaCalls, `${run}: 已保存主题时无需查询系统`);
    }
  });
}

it("无浏览器环境的初始化默认 light", () => {
  assert.equal(resolveInitialTheme(), "light");
});

for (const locale of ["zh", "en"]) {
  it(`真实 ThemeToggle 挂载沿用首屏主题，双向切换持久化，重挂载恢复（${locale}）`, async (t) => {
    const dom = await mountDOM(t);
    const saved = new Map([["edm-theme", "light"], ["unrelated", "kept"]]);
    dom.window.localStorage = {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    };
    // 首屏脚本是当前页面主题的权威来源，挂载不应重新查询 storage 或媒体偏好。
    dom.document.documentElement.setAttribute("data-theme", "dark");
    dom.window.matchMedia = () => { throw new Error("挂载不应重新查询系统"); };
    const graph = sourceGraph();
    const i18n = graph.load("i18n/index.tsx");
    await i18n.default.changeLanguage(locale);
    const { ThemeToggle } = graph.load("components/ThemeToggle.tsx");
    const button = () => descendants(dom.container, (node) => node.nodeName === "BUTTON")[0];
    const click = () => act(() => {
      const props = button()[Object.keys(button()).find((key) => key.startsWith("__reactProps$"))];
      props.onClick();
    });
    const check = (theme, key, icon) => {
      assert.equal(dom.document.documentElement.getAttribute("data-theme"), theme);
      assert.equal(button().textContent, i18n.translate(key));
      assert.equal(button().getAttribute("aria-label"), i18n.translate(key));
      assert.equal(button().getAttribute("type"), "button");
      assert.ok(descendants(button(), (node) => node.getAttribute("class")?.includes(`lucide-${icon}`)).length);
    };
    await dom.render(h(StrictMode, null, h(ThemeToggle)));
    check("dark", "appearanceSwitchLight", "sun");
    await click();
    check("light", "appearanceSwitchDark", "moon");
    assert.equal(saved.get("edm-theme"), "light");
    await click();
    check("dark", "appearanceSwitchLight", "sun");
    assert.equal(saved.get("edm-theme"), "dark");
    assert.equal(saved.get("unrelated"), "kept");
    // 模拟刷新：重新执行实际首屏脚本，再挂载新的按钮。
    await dom.render(null);
    dom.document.documentElement.removeAttribute("data-theme");
    runInNewContext(initializer, { window: dom.window, document: dom.document });
    await dom.render(h(ThemeToggle));
    check("dark", "appearanceSwitchLight", "sun");
  });
}

it("持久化被禁用时按钮仍双向切换当前页面主题", async (t) => {
  const dom = await mountDOM(t);
  dom.document.documentElement.setAttribute("data-theme", "light");
  Object.defineProperty(dom.window, "localStorage", { get() { throw new Error("denied"); } });
  const { ThemeToggle } = sourceGraph().load("components/ThemeToggle.tsx");
  await dom.render(h(ThemeToggle));
  for (const theme of ["dark", "light"]) {
    const button = descendants(dom.container, (node) => node.nodeName === "BUTTON")[0];
    await act(() => button[Object.keys(button).find((key) => key.startsWith("__reactProps$"))].onClick());
    assert.equal(dom.document.documentElement.getAttribute("data-theme"), theme);
  }
});

it("中英翻译键完全一致，外观按钮的可见文案和无障碍标签都有翻译", () => {
  const zh = JSON.parse(readFileSync(new URL("../src/i18n/locales/zh.json", import.meta.url), "utf8"));
  const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of ["appearanceSwitchLight", "appearanceSwitchDark"]) {
    assert.ok(zh[key]);
    assert.ok(en[key]);
    assert.notEqual(zh[key], en[key]);
  }
});
