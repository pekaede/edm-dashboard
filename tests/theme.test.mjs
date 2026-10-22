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
      assert.equal(button().textContent, "");
      assert.equal(button().getAttribute("aria-label"), i18n.translate(key));
      assert.equal(button().getAttribute("title"), i18n.translate(key));
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

it("契约：主题按钮为纯图标按钮——带 aria-label 与 title 提示、无任何可见文字", async (t) => {
  const dom = await mountDOM(t);
  dom.document.documentElement.setAttribute("data-theme", "light");
  const { ThemeToggle } = sourceGraph().load("components/ThemeToggle.tsx");
  await dom.render(h(ThemeToggle));
  const button = descendants(dom.container, (node) => node.nodeName === "BUTTON")[0];
  assert.ok(button, "主题切换按钮必须存在");
  assert.equal(button.textContent.trim(), "", "按钮不得渲染可见文字，只保留图标");
  const label = button.getAttribute("aria-label");
  assert.ok(label, "纯图标按钮必须带 aria-label");
  assert.equal(button.getAttribute("title"), label, "悬停提示应与无障碍标签一致");
  const icons = descendants(button, (node) => node.getAttribute("class")?.includes("lucide-"));
  assert.equal(icons.length, 1, "按钮内应恰有一个 Lucide 图标");
  assert.equal(button.childNodes.filter((node) => node.nodeType === 1).length, 1, "按钮只能有图标一个子元素");
});

it("中英语言按钮始终使用 ghost，只有激活项使用 accent 柔和底色与文字色", async (t) => {
  const dom = await mountDOM(t);
  const variants = [];
  const { Button } = sourceGraph().load("components/ui/button.tsx");
  // 观察实际传入的 variant，再委托真实 Button 合并样式；仅看最终 class 会漏掉被覆盖的 default。
  const graph = sourceGraph({ overrides: {
    "components/ui/button.tsx": { Button: (props) => {
      variants.push(props.variant);
      return h(Button, props);
    } },
  } });
  const i18n = graph.load("i18n/index.tsx");
  const { LanguageToggle } = graph.load("i18n/LanguageToggle.tsx");
  await act(() => i18n.default.changeLanguage("zh"));
  await dom.render(h(LanguageToggle));
  for (const locale of ["zh", "en"]) {
    variants.length = 0;
    await act(() => i18n.default.changeLanguage(locale));
    await dom.render(h(LanguageToggle));
    assert.ok(variants.length >= 2, "必须观察到两种语言按钮的真实 props");
    assert.ok(variants.every((variant) => variant === "ghost"), `${locale} 激活和未激活项的 variant 均须为 ghost`);
    const buttons = descendants(dom.container, (node) => node.nodeName === "BUTTON");
    assert.equal(buttons.length, 2);
    const active = buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
    assert.equal(active.length, 1, "每次只能激活一个语言");
    assert.equal(active[0].textContent, locale === "zh" ? "中文" : "EN");
    for (const button of buttons) {
      const classes = button.getAttribute("class").split(/\s+/);
      assert.ok(classes.every((name) => !name.includes("--control-active-")), "语言按钮不得沿用实心激活 token（含悬停态）");
      for (const name of ["bg-[var(--accent-tint)]", "text-[var(--accent-ink)]", "hover:bg-[var(--accent-tint)]", "hover:text-[var(--accent-ink)]"]) {
        assert.equal(classes.includes(name), button === active[0], `${locale}：${name} 仅用于激活项`);
      }
    }
  }
});

// mounted-dom 不计算布局：读取真实 Button 合并后的 Tailwind 类，按默认 16px 根字号、4px 间距单位换算。
function utilityPixels(node, utility) {
  const pattern = new RegExp(`^${utility}-(\\d+(?:\\.\\d+)?|\\[(\\d+(?:\\.\\d+)?)(px|rem)\\])$`);
  const matches = node.getAttribute("class").split(/\s+/).flatMap((name) => {
    if (utility === "border" && name === "border") return [1];
    const match = name.match(pattern);
    if (!match) return [];
    return [match[2] ? Number(match[2]) * (match[3] === "rem" ? 16 : 1) : Number(match[1]) * (utility === "border" ? 1 : 4)];
  });
  assert.equal(matches.length, 1, `${utility} 必须有唯一、可换算的尺寸类：${node.getAttribute("class")}`);
  return matches[0];
}

it("主题按钮与语言控件的组成尺寸在中英激活态下均合计为 34px", async (t) => {
  const dom = await mountDOM(t);
  const graph = sourceGraph();
  const i18n = graph.load("i18n/index.tsx");
  const { ThemeToggle } = graph.load("components/ThemeToggle.tsx");
  const { LanguageToggle } = graph.load("i18n/LanguageToggle.tsx");
  await dom.render(h("div", null, h(ThemeToggle), h(LanguageToggle)));
  for (const locale of ["zh", "en"]) {
    await act(() => i18n.default.changeLanguage(locale));
    const group = descendants(dom.container, (node) => node.getAttribute("role") === "group")[0];
    assert.ok(group, "语言分段控件必须存在");
    const theme = descendants(dom.container, (node) => node.nodeName === "BUTTON" && !group.contains(node))[0];
    assert.ok(theme, "主题按钮必须存在");
    const themeHeight = utilityPixels(theme, "h");
    assert.equal(themeHeight, 34, "主题按钮高度必须为 34px");
    assert.equal(utilityPixels(theme, "min-h"), 0, "主题按钮不得被通用最小高度撑大");
    // 外框由内容撑高，禁止另加高度或纵向覆盖类使下方的组成公式失效。
    assert.doesNotMatch(group.getAttribute("class"), /(?:^|\s)(?:h|min-h|max-h|size|py|pt|pb|border-y|border-t|border-b)-/);
    const padding = utilityPixels(group, "p");
    const border = utilityPixels(group, "border");
    assert.equal(padding, 2, "语言外框上下内边距各为 2px");
    assert.equal(border, 1, "语言外框上下边框各为 1px");
    const buttons = descendants(group, (node) => node.nodeName === "BUTTON");
    assert.equal(buttons.length, 2);
    for (const button of buttons) {
      const height = utilityPixels(button, "h");
      const minHeight = utilityPixels(button, "min-h");
      assert.equal(height, 28, "语言按钮高度必须为 28px");
      assert.equal(minHeight, 28, "语言按钮最小高度必须覆盖通用 Button 的尺寸");
      const languageHeight = Math.max(height, minHeight) + 2 * padding + 2 * border;
      assert.equal(languageHeight, 34, "语言总高度 = 28 + 2×2 + 1×2 = 34px");
      assert.equal(languageHeight, themeHeight, "主题按钮与语言控件必须等高");
    }
  }
});

it("中英翻译键完全一致，外观按钮的无障碍标签和悬停提示都有翻译", () => {
  const zh = JSON.parse(readFileSync(new URL("../src/i18n/locales/zh.json", import.meta.url), "utf8"));
  const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of ["appearanceSwitchLight", "appearanceSwitchDark"]) {
    assert.ok(zh[key]);
    assert.ok(en[key]);
    assert.notEqual(zh[key], en[key]);
  }
});
