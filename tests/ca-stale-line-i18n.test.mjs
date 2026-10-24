import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { createElement as h } from "react";
import { mountDOM } from "./mounted-dom.mjs";
import { mountedClock, sourceGraph } from "./mounted-source.mjs";

// i18n 单例在全量测试中共享，最后恢复中文，避免影响后续 SEO 断言。
for (const [language, expected] of [
  ["en", "Stale / awaiting update 2 (20%)"],
  ["zh", "过期/待更新 2 封 (20%)"],
]) {
  it(`OutcomeBreakdown 过期行使用字典插值（${language}）`, async (t) => {
    const dom = await mountDOM(t);
    const clock = mountedClock();
    Object.assign(dom.window, clock.globals, {
      localStorage: globalThis.sessionStorage,
    });
    const graph = sourceGraph({ globals: { ...clock.globals } });
    const locale = graph.load("i18n/index.tsx");
    await locale.default.changeLanguage(language);
    const { OutcomeBreakdown } = graph.load("components/ContentAnalysis.tsx");
    await dom.render(h(OutcomeBreakdown, {
      label: "分析结果",
      counts: { success: 3, queued: 1, failed: 0, missing: 0, skipped: 0, expired: 2 },
      sample: 10,
    }));

    const translated = locale.translate("caStaleLine", { e: 2, ep: "20%" });
    assert.equal(translated, expected);
    assert.ok(dom.container.textContent.includes(translated), "过期行应渲染字典插值结果");
  });
}

it("OutcomeBreakdown 不再内联判断语言，且中英字典都含 caStaleLine", () => {
  const source = readFileSync(new URL("../src/components/ContentAnalysis.tsx", import.meta.url), "utf8");
  const outcomeBreakdown = source.match(/export function OutcomeBreakdown\([\s\S]*?^\}$/m);
  assert.ok(outcomeBreakdown, "应找到导出的 OutcomeBreakdown 函数");
  assert.doesNotMatch(outcomeBreakdown[0], /locale\s*===\s*"en"/);

  for (const language of ["en", "zh"]) {
    const dictionary = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), "utf8"));
    assert.ok(Object.hasOwn(dictionary, "caStaleLine"), `${language} 字典应包含 caStaleLine`);
  }
});
