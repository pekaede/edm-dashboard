import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App, { ErrorBoundary } from "./App";
import { useLocale } from "./i18n";

function PageErrorFallback() {
  // useLocale 可使用已初始化的全局 i18n 实例，App 的 Provider 失败时仍能翻译。
  const { t } = useLocale();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] p-6 text-[var(--text-body)]">
      <div role="alert" className="max-w-lg rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--surface-card)] p-8">
        <h1 className="text-xl font-semibold text-[var(--text-heading)]">{t("ebPageTitle")}</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{t("ebPageDesc")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-11 rounded-lg border border-[var(--border-default)] px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)]"
        >
          {t("ebReload")}
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
