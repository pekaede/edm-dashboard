// 可重放的内存变异：必须唯一匹配真实生产源码；正常 npm test 不启用任何变异。
export const wiringMutations = [
  {
    name: "provider-market-only", test: "J1：", path: "site-data.tsx",
    before: "[data.emails, data.status, market],", after: "[market],",
  },
  {
    name: "provider-without-emails", test: "J1：", path: "site-data.tsx",
    before: "[data.emails, data.status, market],", after: "[data.status, market],",
  },
  {
    name: "provider-without-status", test: "J1-status：", path: "site-data.tsx",
    before: "[data.emails, data.status, market],", after: "[data.emails, market],",
  },
  {
    name: "timer-without-force", test: "J2-timer：", path: "email-data.ts",
    before: 'if (document.visibilityState === "visible" && navigator.onLine) loadExtendedEmails(true, true);',
    after: 'if (document.visibilityState === "visible" && navigator.onLine) loadExtendedEmails(true);',
  },
  {
    name: "online-without-force", test: "J2-online：", path: "email-data.ts",
    before: "function handleOnline() {\n  loadExtendedEmails(true, true);\n}",
    after: "function handleOnline() {\n  loadExtendedEmails(true);\n}",
  },
  {
    name: "supabase-without-force", test: "J2-timer：", path: "email-data.ts",
    before: "const { rows, exactTotal } = await fetchEmailDataset(force);",
    after: "const { rows, exactTotal } = await fetchEmailDataset();",
  },
  {
    name: "analysis-without-refresh-subscription", test: "J2-timer：", path: "email-content-analysis-data.ts",
    before: "loadAnalysis(entry, true, event.force);", after: "/* 丢失邮件刷新到分析缓存的接线 */",
  },
  {
    name: "analysis-without-force", test: "J2-online：", path: "email-content-analysis-data.ts",
    before: "loadAnalysis(entry, true, event.force);", after: "loadAnalysis(entry, true);",
  },
  {
    name: "comparison-fixed-live-window", test: "J3：", path: "components/MarketComparison.tsx",
    before: "aggregateComparison(emails, { windowStart, windowEnd })",
    after: 'aggregateComparison(emails, { windowStart: "2026-07-20", windowEnd: "2026-10-20" })',
  },
  {
    name: "url-without-navigation-restore", test: "J4：", path: "use-url-sync.ts",
    before: "setStateInternal(parsed);", after: "/* 导航后未恢复 hook 状态 */",
  },
  {
    name: "app-without-url-market-restore", test: "J4：", path: "App.tsx",
    before: "} else if (urlState.market !== siteMarket) {\n        setSiteMarket(urlState.market);\n      }\n    }\n    prevMarketsRef.current",
    after: "} else if (urlState.market !== siteMarket) {\n        /* URL 导航不再同步到 Provider */\n      }\n    }\n    prevMarketsRef.current",
  },
  {
    name: "url-stale-render-writes", test: "J4：", path: "use-url-sync.ts",
    before: 'const current = syncToHash && typeof window !== "undefined"\n        ? parseHash(window.location.hash)\n        : stateRef.current;',
    after: "const current = state;",
  },
];
