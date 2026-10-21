import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSourceModule } from "./source-module.mjs";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));

// 每个测试建立独立的生产依赖图。除显式列出的边界外，相对导入递归加载原始 TS/TSX/JSON。
// import.meta.glob 仅模拟 Vite 的文件发现；读取的仍是六份真实 JSON 快照。
// 变异只在编译前改内存字符串，绝不写入 src/；匹配失败直接报错，防止“未注入也通过”。
export function sourceGraph({ env = {}, globals = {}, overrides = {}, mutation } = {}) {
  const modules = new Map();
  const mutations = new Set();
  function findModule(specifier, parent = sourceRoot) {
    const base = resolve(parent, specifier);
    const path = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, resolve(base, "index.tsx")]
      .find((candidate) => existsSync(candidate) && /\.(tsx?|json)$/.test(candidate));
    assert.ok(path, `无法解析生产依赖 ${specifier}`);
    return relative(sourceRoot, path).split(sep).join("/");
  }
  function load(path) {
    if (Object.hasOwn(overrides, path)) return overrides[path];
    if (modules.has(path)) return modules.get(path);
    if (path.endsWith(".json")) {
      const value = JSON.parse(readFileSync(resolve(sourceRoot, path), "utf8"));
      modules.set(path, value);
      return value;
    }
    const value = loadSourceModule(path, {
      env, globals,
      expose: path === "App.tsx" ? ["Dashboard"] : [],
      resolveImport: (specifier, parent) => load(findModule(specifier, dirname(resolve(sourceRoot, parent)))),
      importMeta: {
        glob(patterns) {
          return Object.fromEntries(patterns.map((pattern) => [pattern, async () =>
            JSON.parse(readFileSync(resolve(sourceRoot, pattern), "utf8"))]));
        },
      },
      transformSource(source, currentPath) {
        if (mutation?.path !== currentPath) return source;
        assert.equal(source.split(mutation.before).length - 1, 1, `变异锚点须唯一：${mutation.name}`);
        mutations.add(mutation.name);
        return source.replace(mutation.before, mutation.after);
      },
    });
    modules.set(path, value);
    return value;
  }
  return { load, mutations };
}

// 生产模块共用同一时钟，支持 interval；推进时间同步执行真实注册的回调。
// 不替换 React/Scheduler 自身的全局计时器。
export function mountedClock() {
  let now = 1_000;
  let sequence = 0;
  const timers = new Map();
  class ClockDate extends Date { static now() { return now; } }
  const add = (callback, delay, interval = false) => {
    const id = ++sequence;
    timers.set(id, { callback, delay, at: now + delay, interval });
    return id;
  };
  return {
    globals: {
      Date: ClockDate,
      setTimeout: (callback, delay) => add(callback, delay),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (callback, delay) => add(callback, delay, true),
      clearInterval: (id) => timers.delete(id),
    },
    now: () => now,
    intervals: () => [...timers.values()].filter((timer) => timer.interval).length,
    pending: () => timers.size,
    advance(milliseconds) {
      const target = now + milliseconds;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next || next[1].at > target) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.interval) timer.at += timer.delay;
        else timers.delete(id);
        timer.callback();
      }
      now = target;
    },
  };
}
