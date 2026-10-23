import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

const snapshotPath = new URL("../src/snapshot.ts", import.meta.url);
const snapshotStatePath = new URL("../src/components/SnapshotState.tsx", import.meta.url);

describe("dead snapshot chain removal", () => {
  it("removes src/snapshot.ts", () => {
    // src/snapshot.ts 没有调用方，属于零调用方死代码。
    assert.equal(existsSync(snapshotPath), false);
  });

  it("removes src/components/SnapshotState.tsx", () => {
    // SnapshotState.tsx 在 src/tests 中没有调用方，属于零调用方死代码。
    assert.equal(existsSync(snapshotStatePath), false);
  });
});
