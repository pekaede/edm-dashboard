import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const metaPattern = /<meta name="theme-color" content="([^"]+)" \/>/;
const scriptPattern = /<script id="theme-init">([\s\S]*?)<\/script>/;

function runDuringParsing(markup) {
  const meta = markup.match(metaPattern);
  const script = markup.match(scriptPattern);
  assert.ok(meta, "真实模板应包含 theme-color meta");
  assert.ok(script, "真实模板应包含 theme-init 脚本");
  const parsedMarkup = markup.slice(0, script.index);
  let content = meta[1];
  let theme;
  const metaNode = {
    setAttribute(name, value) {
      assert.equal(name, "content");
      content = value;
    },
  };
  runInNewContext(script[1], {
    window: {
      localStorage: {
        getItem(key) {
          assert.equal(key, "edm-theme");
          return "dark";
        },
      },
    },
    document: {
      documentElement: {
        setAttribute(name, value) {
          assert.equal(name, "data-theme");
          theme = value;
        },
      },
      querySelector(selector) {
        assert.equal(selector, 'meta[name="theme-color"]');
        return parsedMarkup.includes(meta[0]) ? metaNode : null;
      },
    },
  });
  return { content, theme };
}

describe("theme-color meta 的首屏解析顺序", () => {
  it("真实 index.html 中 meta 严格早于 theme-init 脚本", () => {
    const meta = html.match(metaPattern);
    const script = html.match(scriptPattern);
    assert.ok(meta, "真实模板应包含 theme-color meta");
    assert.ok(script, "真实模板应包含 theme-init 脚本");
    assert.ok(meta.index < script.index, "theme-color meta 必须在 theme-init 执行前完成解析");
  });

  it("仅已解析节点可见时，保存 dark 的首屏 meta 更新为深色", () => {
    assert.deepEqual(runDuringParsing(html), { content: "#111318", theme: "dark" });
  });

  it("对照：meta 在脚本之后时，保存 dark 仍保留浅色 meta", () => {
    const meta = html.match(metaPattern);
    assert.ok(meta, "真实模板应包含 theme-color meta");
    const lateMetaHtml = html.replace(meta[0], "").replace(scriptPattern, (script) => `${script}\n    ${meta[0]}`);
    assert.deepEqual(runDuringParsing(lateMetaHtml), { content: "#f7f8fa", theme: "dark" });
  });
});
