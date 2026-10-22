import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../src/components/Card.tsx", import.meta.url), "utf8");
const rawCss = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
// 去掉注释后再查规则，避免注释里的旧代码造成误报。
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");

function tokens(className) {
  return className.split(/\s+/).filter(Boolean);
}

// 剥掉 xl:/sm: 等变体前缀，取基础工具类（如 xl:self-start → self-start）。
function baseUtility(cls) {
  return cls.split(":").pop();
}

function overviewSection() {
  const start = app.indexOf('<div id="overview"');
  assert.ok(start >= 0, "必须找到概览网格容器");
  // 概览网格之后紧跟词云/日历的 lg:grid-cols-2 网格，在此之前截断，
  // 避免把那一行同构的包裹层也算进来。
  const end = app.indexOf("lg:grid-cols-2", start);
  assert.ok(end > start, "概览网格必须在词云/日历网格之前结束");
  return app.slice(start, end);
}

function gridClassName() {
  const match = overviewSection().match(/<div id="overview" className="([^"]*)"/)?.[1];
  assert.ok(match, "必须读取概览网格容器的 className");
  return match;
}

it("概览网格同行 stretch 且仅桌面端三列", () => {
  const classTokens = tokens(gridClassName());
  for (const cls of ["dashboard-overview-grid", "grid", "items-stretch"]) {
    assert.ok(classTokens.includes(cls), "概览网格必须含完整类名 " + cls + "，实际：" + classTokens.join(" "));
  }
  const colTokens = classTokens.filter((cls) => cls.includes("grid-cols-"));
  assert.equal(colTokens.length, 1, "概览网格只能有一处列模板定义（桌面端），实际：" + colTokens.join(" "));
  const xlCols = colTokens[0].match(/^xl:grid-cols-\[([^\]]+)\]$/);
  assert.ok(xlCols, "列模板必须是 xl 断点的任意值类，实际：" + colTokens[0]);
  assert.equal(xlCols[1].split("_").length, 3, "桌面端必须恰好三列，实际：" + xlCols[1]);
});

it("三卡包裹层可被网格拉伸且错误回退满高", () => {
  const section = overviewSection();
  const wrappers = [...section.matchAll(/<div className="([^"]*)">\s*<SectionErrorBoundary([^>]*)>/g)];
  assert.equal(wrappers.length, 3, "概览三卡必须各有一个包裹层 + 错误边界，实际：" + wrappers.length);
  const components = ["CampaignOverview", "ThemeDistribution", "BrandThemeBreakdown"];
  wrappers.forEach((match, i) => {
    const classTokens = tokens(match[1]);
    assert.ok(classTokens.includes("min-w-0"), "包裹层必须含 min-w-0，实际：" + match[1]);
    assert.ok(
      !classTokens.some((cls) => baseUtility(cls).startsWith("self-")),
      "包裹层不得用 self-*（含断点变体）顶掉网格拉伸，实际：" + match[1],
    );
    assert.ok(
      match[2].includes('className="h-full"'),
      "错误边界必须给回退框传 h-full，否则报错时回退框不等高，实际：" + match[2],
    );
    const after = section.slice(match.index, match.index + 300);
    assert.ok(after.includes(components[i]), "第 " + (i + 1) + " 个包裹层必须包含 " + components[i]);
  });
});

it("卡片根节点以完整 h-full 类名满高", () => {
  const className = card.match(/<section className="([^"]*)"/)?.[1];
  assert.ok(className, "必须读取 Card 根节点 className");
  const classTokens = tokens(className);
  for (const cls of ["dashboard-card", "h-full"]) {
    assert.ok(classTokens.includes(cls), "Card 根节点必须含完整类名 " + cls + "，实际：" + className);
  }
});

function cssRules() {
  return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
    // 分组选择器按逗号拆成单个分支逐一检查，避免整串包含某类名时跳过另一分支。
    selectors: m[1].split(",").map((s) => s.trim()).filter(Boolean),
    body: m[2],
  }));
}

it("样式表没有任何规则把概览卡改回自然高度或顶掉拉伸", () => {
  for (const { selectors, body } of cssRules()) {
    for (const selector of selectors) {
      if (selector.includes(".dashboard-card")) {
        assert.doesNotMatch(
          body,
          /height\s*:\s*auto/,
          ".dashboard-card 相关规则不得出现 height: auto，否则卡片满高失效：" + selector,
        );
      }
      if (selector.includes(".dashboard-overview-grid") && !selector.includes(".dashboard-card")) {
        // 同一规则内可能有多个 align-items 声明（后者生效），必须逐条检查。
        for (const decl of body.matchAll(/align-items\s*:\s*([a-z-]+)/g)) {
          assert.ok(
            decl[1] === "stretch" || decl[1] === "normal",
            "概览网格不得被 align-items: " + decl[1] + " 顶掉拉伸：" + selector,
          );
        }
      }
    }
  }
});
