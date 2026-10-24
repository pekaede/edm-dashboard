import assert from "node:assert/strict";
import { it } from "node:test";
import { extractStaticRoot } from "../scripts/extract-static-root.mjs";

const content = '<div class="shell"><div><h1>静态首页</h1></div><p>完整静态内容</p></div>';
const head = '<head><script id="theme-init">window.theme = "head-script";</script></head>';
const trailing = `<noscript><div>tail-noscript</div></noscript>
  <script id="boot-watchdog">window.watchdog = "<div>tail-script</div>";</script>`;

it("AB1 旧布局：root 后直接闭合 body，提取全部嵌套内容", () => {
  const html = `<html>${head}<body><div id="root">${content}</div></body></html>`;
  const staticRoot = extractStaticRoot(html);
  assert.equal(staticRoot, content);
  assert.ok(staticRoot.includes("<h1"));
  assert.doesNotMatch(staticRoot, /head-script|tail-script|boot-watchdog/);
});

it("AB1 现布局：root 后的 noscript 和 boot-watchdog 不进入捕获内容", () => {
  const html = `<html>${head}<body><div id="root">${content}</div>\n${trailing}</body></html>`;
  const staticRoot = extractStaticRoot(html);
  assert.equal(staticRoot, content);
  assert.ok(staticRoot.includes("<h1"));
  assert.doesNotMatch(staticRoot, /head-script|tail-noscript|tail-script|boot-watchdog/);
});

it("AB1 无 root：即使存在 H1 和尾部脚本也返回 undefined", () => {
  const html = `<html>${head}<body>${content}${trailing}</body></html>`;
  const staticRoot = extractStaticRoot(html);
  assert.equal(staticRoot, undefined);
  assert.equal(staticRoot?.includes("<h1"), undefined);
});
