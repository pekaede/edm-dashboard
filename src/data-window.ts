/**
 * 数据窗口常量（单一来源）：滑动窗口时只改这里，email-data.ts 的元数据与
 * supabase.ts 的查询边界都从本文件取值，避免多处字面量漂移。
 * 三周窗口不在此处——它由 three-week-aggregation.ts 的 THREE_WEEK_WINDOW 定义。
 */

/** live Supabase 窗口（93 天，随每日任务滑动）。 */
export const LIVE_WINDOW = {
  start: "2026-07-18",
  end: "2026-10-18",
} as const;

/** JSON 回滚快照窗口（历史 US 样本，固定不滑动）。 */
export const SNAPSHOT_WINDOW = {
  start: "2026-07-16",
  end: "2026-10-15",
} as const;
