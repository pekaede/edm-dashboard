import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSourceModule } from "./source-module.mjs";

const website = "test-website-id";

function loadAnalytics(env = { VITE_UMAMI_WEBSITE_ID: website }) {
  const calls = [];
  const { trackView } = loadSourceModule("analytics.ts", {
    env,
    globals: {
      window: {
        umami: {
          track(payload) { calls.push(payload); },
        },
      },
    },
  });
  return { trackView, calls };
}

describe("Umami 视图路径", () => {
  for (const view of ["dashboard", "report", "emails", "brands"]) {
    it(`trackView("${view}") 以 /${view} 和 website 调用 umami.track`, () => {
      const { trackView, calls } = loadAnalytics();

      trackView(view);

      assert.deepEqual(calls, [{ website, url: `/${view}` }]);
    });
  }

  it("未知视图静默丢弃，不调用 umami.track", () => {
    const { trackView, calls } = loadAnalytics();

    assert.doesNotThrow(() => trackView("未知视图"));
    assert.deepEqual(calls, []);
  });

  it("未设置 websiteId 时直接返回，不抛错且不调用 umami.track", () => {
    const { trackView, calls } = loadAnalytics({});

    assert.doesNotThrow(() => trackView("brands"));
    assert.deepEqual(calls, []);
  });
});
