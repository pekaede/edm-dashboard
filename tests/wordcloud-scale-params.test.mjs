import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSourceModule } from "./source-module.mjs";

function loadWordCloud() {
  return loadSourceModule("components/WordCloud.tsx", {
    expose: ["getScaleParams", "getWordSize"],
    imports: {
      react: { useMemo: () => {}, useState: () => {} },
      "../i18n": { useLocale: () => ({ t: () => "" }) },
      "../site-data": { useSiteEmails: () => ({}), useSiteSelection: () => ({}) },
      "../word-cloud-groups": {
        MAX_WORDS_PER_CATEGORY: 10,
        NOISE_WORDS: new Set(),
        filterEmailsByWindow: () => [],
      },
      "../three-week-aggregation": { formatWindowRange: () => "", THREE_WEEK_WINDOW: {} },
      "./Card": {},
      "./empty-state-class": loadSourceModule("components/empty-state-class.ts"),
      "./EmptyState": {},
      "./ExtendedEmailsState": {},
      "./MarketFilter": { getMarketLabel: () => "" },
      "./Tooltip": {},
    },
  });
}

describe("WordCloud 缩放参数", () => {
  it("多词乱序时精确返回 min/max", () => {
    const { getScaleParams } = loadWordCloud();

    assert.deepEqual(getScaleParams([{ text: "mid", count: 7 }, { text: "low", count: 2 }, { text: "high", count: 12 }]), {
      minCount: 2,
      maxCount: 12,
    });
  });

  it("单词时 min/max 都等于该词 count", () => {
    const { getScaleParams } = loadWordCloud();

    assert.deepEqual(getScaleParams([{ text: "only", count: 5 }]), { minCount: 5, maxCount: 5 });
  });

  it("空数组返回防御值", () => {
    const { getScaleParams } = loadWordCloud();

    assert.deepEqual(getScaleParams([]), { minCount: 0, maxCount: 1 });
  });
});

describe("WordCloud 词字号", () => {
  const { getWordSize } = loadWordCloud();

  it("count 等于 min 时返回最小字号", () => {
    assert.equal(getWordSize(2, 2, 12), "0.95rem");
  });

  it("count 等于 max 时返回最大字号", () => {
    assert.equal(getWordSize(12, 2, 12), "2rem");
  });

  it("按比例线性插值", () => {
    assert.equal(getWordSize(7, 2, 12), "1.475rem");
  });

  it("min 等于 max 时使用 range 保底", () => {
    assert.equal(getWordSize(5, 5, 5), "0.95rem");
  });
});

it("新两步调用与旧逻辑对一组词逐项等价", () => {
  const { getScaleParams, getWordSize } = loadWordCloud();
  const words = [
    { text: "one", count: 12 },
    { text: "two", count: 2 },
    { text: "three", count: 7 },
    { text: "four", count: 5 },
    { text: "five", count: 10 },
    { text: "six", count: 3 },
  ];
  const { minCount, maxCount } = getScaleParams(words);
  const expected = words.map((word) => {
    const counts = words.map((entry) => entry.count);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const range = Math.max(max - min, 1);
    const scale = (word.count - min) / range;
    return `${0.95 + scale * 1.05}rem`;
  });
  const actual = words.map((word) => getWordSize(word.count, minCount, maxCount));

  assert.deepEqual(actual, expected);
});
