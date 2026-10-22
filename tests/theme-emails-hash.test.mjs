import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEFAULT_PAGE_STATE, buildHash, parseHash } from "../src/url-state.ts";

const source = readFileSync(new URL("../src/components/ThemeDistribution.tsx", import.meta.url), "utf8");

describe("主题分布邮件链接", () => {
  it("未知主题使用位置段往返保留原键且不指定市场", () => {
    for (const theme of ["winback", "US", "Winback / 联名 & + #?"]) {
      const state = { ...DEFAULT_PAGE_STATE, view: "emails", theme };
      const hash = buildHash(state);
      assert.equal(hash, `#emails//all/${encodeURIComponent(theme)}`);
      const restored = parseHash(hash);
      assert.equal(restored.theme, theme);
      assert.equal(restored.market, null);
      assert.equal(restored.marketSpecified, false);
      assert.deepEqual(restored, state);
    }
  });

  it("已知主题 price 保持旧短链接并正确往返", () => {
    const state = { ...DEFAULT_PAGE_STATE, view: "emails", theme: "price" };
    const hash = buildHash(state);
    assert.equal(hash, "#emails/price");
    assert.deepEqual(parseHash(hash), state);
  });

  it("winback 手拼短链接被解析为市场，buildHash 生成的链接保留主题", () => {
    const legacy = parseHash("#emails/winback");
    assert.equal(legacy.market, "WINBACK");
    assert.equal(legacy.marketSpecified, true);
    assert.equal(legacy.theme, null);

    const state = { ...DEFAULT_PAGE_STATE, view: "emails", theme: "winback" };
    const hash = buildHash(state);
    assert.equal(hash, "#emails//all/winback");
    assert.deepEqual(parseHash(hash), state);
  });

  it("源码契约：图例与扇形导航统一使用 themeEmailsHash，不再手拼主题短链接", () => {
    assert.match(source, /import \{ buildHash \} from "\.\.\/url-state";/);
    assert.match(source, /function themeEmailsHash\(key: string\): string \{\s*return buildHash\(/);
    assert.equal(
      [...source.matchAll(/href=\{themeEmailsHash\(theme\.key\)\}/g)].length,
      2,
      "图例与扇形 href 必须均使用 themeEmailsHash",
    );
    assert.match(source, /onKeyDown=\{\(event\) => \{[\s\S]*?window\.location\.hash = themeEmailsHash\(theme\.key\);/);
    assert.doesNotMatch(source, /`#emails\//);
  });
});
