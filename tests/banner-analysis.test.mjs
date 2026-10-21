import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateBannerAnalysis } from "../src/email-content-analysis.ts";
import { BANNER_COMPOSITIONS, BANNER_SEASONAL_CUES } from "../src/banner-vision-prompt.ts";

// 独立列出规范值，避免枚举和校验同时错误变更时测试仍自洽通过。
const compositions = [
  "text-poster", "fashion-editorial", "single-model", "multi-product",
  "group-shot", "collage", "detail-closeup", "lifestyle-scene",
];
const seasonalCues = [
  "spring", "summer", "autumn", "winter", "new-year", "valentines-day",
  "easter", "mothers-day", "fathers-day", "halloween", "thanksgiving",
  "christmas", "holiday", "black-friday", "cyber-monday", "back-to-school",
  "ramadan", "lunar-new-year", "pride", "graduation", "wedding", "clearance", "other",
];

function banner(overrides = {}) {
  return {
    dominant_colors: ["red", "white"], composition: "text-poster",
    cta_presence: false, cta_position: null, text_image_ratio: "balanced",
    seasonal_cues: [], ...overrides,
  };
}

describe("Banner 契约校验", () => {
  it("规范枚举固定为 8 类构图与 23 个季节标签", () => {
    assert.deepEqual([...BANNER_COMPOSITIONS], compositions);
    assert.deepEqual([...BANNER_SEASONAL_CUES], seasonalCues);
    assert.equal(compositions.length, 8);
    assert.equal(seasonalCues.length, 23);
  });

  it("接受每类构图与每个季节标签的组合", () => {
    for (const composition of compositions) {
      for (const cue of seasonalCues) {
        assert.equal(validateBannerAnalysis(banner({ composition, seasonal_cues: [cue] })), true,
          `${composition} / ${cue}`);
      }
    }
    assert.equal(validateBannerAnalysis(banner({ seasonal_cues: seasonalCues })), true);
    assert.equal(validateBannerAnalysis(banner()), true);
  });

  it("拒绝未知、旧版、大小写错误及非字符串构图", () => {
    for (const composition of [
      "hero-centered", "split-layout", "product-grid", "text-only", "unknown",
      "Text-Poster", " text-poster ", "", null, 8,
    ]) {
      assert.equal(validateBannerAnalysis(banner({ composition })), false, JSON.stringify(composition));
    }
  });

  it("拒绝未知、大小写错误及非字符串季节标签，混入一个也拒绝", () => {
    for (const cue of ["fall", "sale", "christmas-eve", "SPRING", " summer ", "", null, 23]) {
      assert.equal(validateBannerAnalysis(banner({ seasonal_cues: ["spring", cue] })), false,
        JSON.stringify(cue));
    }
    assert.equal(validateBannerAnalysis(banner({ seasonal_cues: ["spring", "spring"] })), false);
    assert.equal(validateBannerAnalysis(banner({ seasonal_cues: "spring" })), false);
  });

  it("CTA 位置遵守枚举和有无 CTA 的字段约束", () => {
    for (const position of ["top", "center", "bottom", "bottom-right", null]) {
      assert.equal(validateBannerAnalysis(banner({ cta_presence: true, cta_position: position })), true);
      assert.equal(validateBannerAnalysis(banner({ cta_position: position })), position === null);
    }
    assert.equal(validateBannerAnalysis(banner({ cta_presence: true, cta_position: "left" })), false);
    assert.equal(validateBannerAnalysis(banner({ cta_presence: "false" })), false);
  });

  it("颜色和图文比保留既有契约，拒绝 Hex、重复和超量颜色", () => {
    for (const dominant_colors of [["#ff0000"], ["red", "red"], ["Red"], ["red", "orange", "yellow", "green", "blue", "white"]]) {
      assert.equal(validateBannerAnalysis(banner({ dominant_colors })), false);
    }
    for (const text_image_ratio of ["text-heavy", "balanced", "image-heavy"]) {
      assert.equal(validateBannerAnalysis(banner({ text_image_ratio })), true);
    }
    assert.equal(validateBannerAnalysis(banner({ text_image_ratio: "unknown" })), false);
  });

  it("拒绝非对象及缺少必需字段的结果", () => {
    for (const value of [null, undefined, [], "text-poster", 8]) {
      assert.equal(validateBannerAnalysis(value), false);
    }
    for (const field of Object.keys(banner())) {
      const incomplete = banner();
      delete incomplete[field];
      assert.equal(validateBannerAnalysis(incomplete), false, field);
    }
  });
});
