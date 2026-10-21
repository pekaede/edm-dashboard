import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// 只处理被测 src/*.ts 及其扩展名省略的相对导入；不替换被测实现或浏览器环境。
const sourceRoot = new URL("../src/", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.startsWith(sourceRoot) &&
      /^\.{1,2}\//.test(specifier) &&
      !/\.[^/]+$/.test(specifier)
    ) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith(sourceRoot) || !url.endsWith(".ts")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: new URL(url).pathname,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
