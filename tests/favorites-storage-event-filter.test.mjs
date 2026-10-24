import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSourceModule } from "./source-module.mjs";

function createSubscription() {
  const window = new EventTarget();
  const { subscribeFavorites } = loadSourceModule("favorites.ts", {
    globals: { window },
  });
  let calls = 0;
  const unsubscribe = subscribeFavorites(() => { calls += 1; });
  return { window, unsubscribe, callbackCount: () => calls };
}

function dispatchStorage(window, key) {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  window.dispatchEvent(event);
}

describe("subscribeFavorites storage 事件过滤", () => {
  it("无关键的 storage 事件不触发回调", () => {
    const { window, callbackCount } = createSubscription();
    for (const key of ["edm-theme", "edm-lang", "edm-favorites-v2", ""]) {
      dispatchStorage(window, key);
    }
    assert.equal(callbackCount(), 0);
  });

  it("收藏键的 storage 事件触发回调恰一次", () => {
    const { window, callbackCount } = createSubscription();
    dispatchStorage(window, "edm-favorites-v1");
    assert.equal(callbackCount(), 1);
  });

  it("key 为 null 的 clear 事件触发回调", () => {
    const { window, callbackCount } = createSubscription();
    dispatchStorage(window, null);
    assert.equal(callbackCount(), 1);
  });

  it("同页自定义事件无条件触发回调", () => {
    const { window, callbackCount } = createSubscription();
    window.dispatchEvent(new CustomEvent("edm-favorites-changed"));
    assert.equal(callbackCount(), 1);
  });

  it("unsubscribe 后 storage 和自定义事件均不再触发回调", () => {
    const { window, unsubscribe, callbackCount } = createSubscription();
    dispatchStorage(window, "edm-favorites-v1");
    window.dispatchEvent(new CustomEvent("edm-favorites-changed"));
    assert.equal(callbackCount(), 2);

    unsubscribe();
    dispatchStorage(window, "edm-favorites-v1");
    dispatchStorage(window, null);
    window.dispatchEvent(new CustomEvent("edm-favorites-changed"));
    assert.equal(callbackCount(), 2);
  });
});
