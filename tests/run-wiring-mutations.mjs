// 执行：node tests/run-wiring-mutations.mjs
// 子进程重新加载生产模块，仅在编译前改变内存字符串；无需修改或恢复 src/ 文件。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { wiringMutations } from "./wiring-mutations.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
function run(mutation) {
  const env = { ...process.env };
  delete env.EDM_WIRING_MUTATION;
  if (mutation) env.EDM_WIRING_MUTATION = mutation.name;
  // 本机沙箱拒绝子进程 pipe 的 socket 操作；使用普通临时文件接收 TAP。
  const directory = mkdtempSync(join(tmpdir(), "edm-wiring-mutation-"));
  const path = join(directory, "result.tap");
  const fd = openSync(path, "w");
  try {
    const result = spawnSync(process.execPath, [
      "--import", "./tests/register-typescript.mjs", "--test", "--test-isolation=none", "--test-reporter=tap",
      ...(mutation ? [`--test-name-pattern=${mutation.test}`] : []),
      "tests/production-wiring.test.mjs",
    ], { cwd, env, stdio: ["ignore", fd, fd], timeout: 30_000 });
    assert.ifError(result.error);
    return { ...result, stdout: readFileSync(path, "utf8"), stderr: "" };
  } finally {
    closeSync(fd);
    rmSync(directory, { recursive: true, force: true });
  }
}
function green(label) {
  const result = run();
  assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`);
  console.log(`${label}：通过`);
}
green("原始接线基线");
for (const mutation of wiringMutations) {
  const result = run(mutation);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, `${mutation.name} 必须变红\n${output}`);
  assert.match(output, /ERR_ASSERTION/, `${mutation.name} 必须因业务断言失败\n${output}`);
  assert.doesNotMatch(output, /变异锚点须唯一|未知变异|SyntaxError|ReferenceError|TypeError/, output);
  const failure = output.match(/error: \|-\n\s+([^\n]+)/)?.[1]
    ?? output.match(/error: (.+)/)?.[1] ?? "业务断言失败";
  console.log(`${mutation.name} → ${mutation.test} 变红：${failure}`);
}
green("移除全部内存变异后");
