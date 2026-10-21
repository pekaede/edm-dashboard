import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { compileFunction } from "node:vm";
import ts from "typescript";

const requireDependency = createRequire(import.meta.url);

// 在内存中编译完整生产模块，只替换外部依赖/时钟并开放指定私有函数。
// 不重写被测函数；每次加载有独立模块状态，不污染原有测试的导入缓存。
export function loadSourceModule(path, {
  imports = {}, env = {}, importMeta = {}, expose = [], globals = {},
  resolveImport, transformSource = (source) => source,
} = {}) {
  const url = new URL(`../src/${path}`, import.meta.url);
  for (const name of expose) assert.match(name, /^[A-Za-z_$][\w$]*$/);
  const source = transformSource(readFileSync(url, "utf8"), path)
    + (expose.length ? `\nexport { ${expose.join(", ")} };` : "");
  const { outputText } = ts.transpileModule(source, {
    fileName: url.pathname,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
    transformers: {
      before: [(context) => {
        const visit = (node) => {
          if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "meta") {
            return ts.factory.createIdentifier("__testImportMeta");
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit);
      }],
    },
  });
  const module = { exports: {} };
  const require = (specifier) => {
    if (Object.hasOwn(imports, specifier)) return imports[specifier];
    if (!specifier.startsWith(".")) return requireDependency(specifier);
    if (resolveImport) return resolveImport(specifier, path);
    throw new Error(`测试须显式提供生产模块依赖：${path} → ${specifier}`);
  };
  compileFunction(outputText, ["require", "module", "exports", "__testImportMeta", ...Object.keys(globals)], {
    filename: url.pathname,
  })(require, module, module.exports, { env, ...importMeta }, ...Object.values(globals));
  return module.exports;
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

// 只推进注入模块的时钟/定时器，测试不等待真实的五分钟或三十秒。
export function createClock() {
  let now = 1_000;
  let sequence = 0;
  const timers = new Map();
  class ClockDate extends Date {
    static now() { return now; }
  }
  return {
    globals: {
      Date: ClockDate,
      setTimeout(callback, delay) {
        const id = ++sequence;
        timers.set(id, { at: now + delay, callback });
        return id;
      },
      clearTimeout(id) { timers.delete(id); },
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = target;
    },
    pendingCount: () => timers.size,
  };
}

// 等待 Promise.race/finally/then 形成的队列全部结算，不依赖任意睡眠时长。
export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
