import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// 发布检查入口回归锁：package.json 的 verify 脚本必须串联
// 回归测试（npm test）、类型检查 + 构建（npm run build）与 dist SEO 自验。
// 新增脚本时保持 verify 为唯一串联入口，避免发布流程绕过测试。
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("release verify entrypoint", () => {
  it("defines a verify script that runs tests before build", () => {
    const verify = pkg.scripts?.verify;
    assert.ok(typeof verify === "string" && verify.length > 0, "scripts.verify 必须存在");
    const parts = verify.split("&&").map((part) => part.trim());
    const testIndex = parts.findIndex((part) => part === "npm test" || part === "npm run test");
    const buildIndex = parts.findIndex(
      (part) => part === "npm run build" || part === "build",
    );
    assert.ok(testIndex !== -1, "verify 必须包含回归测试（npm test）");
    assert.ok(buildIndex !== -1, "verify 必须包含类型检查 + 构建（npm run build）");
    assert.ok(
      testIndex < buildIndex,
      "测试必须在构建之前执行，构建产物只来自全绿测试",
    );
  });

  // dist SEO 自验必须在构建后执行，确保检查本次生成的最终产物。
  it("runs dist SEO verification after build", () => {
    const verify = pkg.scripts?.verify;
    assert.ok(typeof verify === "string" && verify.length > 0, "scripts.verify 必须存在");
    const parts = verify.split("&&").map((part) => part.trim());
    const buildIndex = parts.findIndex(
      (part) => part === "npm run build" || part === "build",
    );
    const seoIndex = parts.findIndex((part) => part === "node scripts/verify-seo.mjs");
    assert.ok(buildIndex !== -1, "verify 必须包含类型检查 + 构建（npm run build）");
    assert.ok(seoIndex !== -1, "verify 必须包含 dist SEO 自验（node scripts/verify-seo.mjs）");
    assert.ok(
      buildIndex < seoIndex,
      "dist SEO 自验必须在构建之后执行，确保校验最终产物",
    );
  });

  it("keeps build running the type check before vite", () => {
    const build = pkg.scripts?.build ?? "";
    const parts = build.split("&&").map((part) => part.trim());
    assert.ok(parts.some((part) => part.startsWith("tsc")), "build 必须先跑类型检查");
  });
});
