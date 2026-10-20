import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 框架与 i18n 运行时单独成包：版本稳定、可长期缓存，且与业务代码并行下载。
        // 用函数式匹配：数组式对 react-dom/client 这类子路径导入不可靠（会被吸回主包）。
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/i18next") ||
            id.includes("node_modules/react-i18next/") ||
            id.includes("node_modules/@formatjs/") ||
            id.includes("node_modules/intl-messageformat/")
          ) {
            return "vendor-i18n";
          }
          return undefined;
        },
      },
    },
  },
});
