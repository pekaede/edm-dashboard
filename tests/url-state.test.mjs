import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PAGE_STATE, buildHash, parseHash } from "../src/url-state.ts";

describe("URL 状态恢复", () => {
  it("解析和生成均将市场归一为大写", () => {
    for (const market of ["us", "uK", "au", "fr", "de", "it", "nl", "es", "eu"]) {
      const expected = {
        ...DEFAULT_PAGE_STATE, view: "emails", market: market.toUpperCase(), marketSpecified: true,
      };
      assert.deepEqual(parseHash(`#emails/${market}`), expected, market);
      assert.equal(buildHash({ ...expected, market: ` ${market} ` }), `#emails/${market.toUpperCase()}`);
    }
  });

  it("已知主题归一为小写，兼容旧主题短链接", () => {
    for (const theme of ["price", "behavior", "new", "lifestyle", "category", "other"]) {
      const expected = { ...DEFAULT_PAGE_STATE, view: "emails", theme };
      assert.deepEqual(parseHash(`#emails/${theme.toUpperCase()}`), expected, theme);
      assert.equal(buildHash({ ...expected, theme: ` ${theme.toUpperCase()} ` }), `#emails/${theme}`);
      assert.equal(parseHash(`#emails/US/all/${theme.toUpperCase()}`).theme, theme);
    }
  });

  it("所有视图往返保留市场、品牌、主题与含特殊字符的搜索词", () => {
    for (const view of ["report", "emails", "calendar", "dashboard"]) {
      const input = {
        view, market: " uk ", marketSpecified: true,
        brand: "Zara / 联名 & + #?", theme: " PRICE ", query: "  春夏 sale + 50% & q=二 #? /  ",
        dateFrom: "", dateTo: "",
      };
      const hash = buildHash(input);
      const restored = parseHash(hash);
      assert.deepEqual(restored, { ...input, market: "UK", theme: "price" });
      assert.equal(buildHash(restored), hash);
    }
  });

  it("搜索词解码区分加号与空格，生成后可再次恢复", () => {
    const state = parseHash("#emails/uk/SHEIN/PRICE?q=linen+sale%2B%26%E6%98%A5");
    assert.deepEqual(state, {
      view: "emails", market: "UK", marketSpecified: true,
      brand: "SHEIN", theme: "price", query: "linen sale+&春",
      dateFrom: "", dateTo: "",
    });
    assert.equal(buildHash(state), "#emails/UK/SHEIN/price?q=linen%20sale%2B%26%E6%98%A5");
    assert.deepEqual(parseHash(buildHash(state)), state);
  });

  it("区分未指定市场和显式全部市场，并保留筛选组合", () => {
    for (const hash of [
      "#emails", "#emails/all", "#emails//Zara/price?q=sale",
      "#emails/all/Zara/price?q=sale", "#calendar/all/SHEIN?q=linen",
    ]) {
      const state = parseHash(hash);
      assert.equal(state.market, null);
      assert.equal(state.marketSpecified, hash.includes("/all"));
      assert.equal(buildHash(state), hash);
      assert.deepEqual(parseHash(buildHash(state)), state);
    }
  });

  it("与市场同名的显式主题及未知主题往返不丢失", () => {
    const marketNamedTheme = parseHash("#emails/theme:US");
    assert.equal(marketNamedTheme.market, null);
    assert.equal(marketNamedTheme.theme, "US");
    assert.equal(buildHash(marketNamedTheme), "#emails//all/US");
    assert.deepEqual(parseHash(buildHash(marketNamedTheme)), marketNamedTheme);

    const state = { ...DEFAULT_PAGE_STATE, view: "emails", brand: "Zara", theme: "Flash Event" };
    assert.deepEqual(parseHash(buildHash(state)), state);
  });

  it("空 hash 使用默认值，损坏编码不会使状态恢复抛错", () => {
    assert.deepEqual(parseHash(""), DEFAULT_PAGE_STATE);
    const state = parseHash("#emails/us/%E0%A4%A/NEW?q=sale");
    assert.equal(state.brand, "%E0%A4%A");
    assert.equal(state.market, "US");
    assert.equal(state.theme, "new");
    assert.deepEqual(parseHash(buildHash(state)), state);
  });

  it("邮件列表日期范围写入 URL 查询参数并可往返恢复", () => {
    const hash = "#emails/US/all/price?from=2026-10-01&to=2026-10-20";
    const state = parseHash(hash);
    assert.equal(state.dateFrom, "2026-10-01");
    assert.equal(state.dateTo, "2026-10-20");
    assert.equal(buildHash(state), hash);
    assert.deepEqual(parseHash(buildHash(state)), state);
  });

  it("日期参数只在 emails 视图生效，其他视图写入与解析均丢弃", () => {
    const reportState = parseHash("#report?from=2026-10-01&to=2026-10-20");
    assert.equal(reportState.dateFrom, "");
    assert.equal(reportState.dateTo, "");
    const built = buildHash({
      ...DEFAULT_PAGE_STATE, view: "report",
      dateFrom: "2026-10-01", dateTo: "2026-10-20",
    });
    assert.equal(built.includes("from="), false);
    assert.equal(built.includes("to="), false);
  });

  it("非法日期参数被丢弃，不污染邮件列表筛选", () => {
    const state = parseHash("#emails?from=abc&to=2026/10/01");
    assert.equal(state.dateFrom, "");
    assert.equal(state.dateTo, "");
    assert.equal(buildHash(state), "#emails");
  });

  it("不存在的日历日期被丢弃", () => {
    const state = parseHash("#emails?from=2026-99-99&to=2026-10-20");
    assert.equal(state.dateFrom, "");
    assert.equal(state.dateTo, "2026-10-20");
    assert.equal(buildHash(state), "#emails?to=2026-10-20");
  });

  it("仅设单边日期时只写一个查询参数", () => {
    const state = { ...DEFAULT_PAGE_STATE, view: "emails", dateFrom: "2026-10-01" };
    assert.equal(buildHash(state), "#emails?from=2026-10-01");
    assert.deepEqual(parseHash(buildHash(state)), state);
  });
});
