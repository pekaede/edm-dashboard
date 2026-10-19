import { useMemo } from "react";
import { useSiteEmails } from "../site-data";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";

export function DashboardFooter() {
  const { status, emails, meta } = useSiteEmails();

  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const safeThreeWeekTotal = data ? `${data.total} 封` : status === "loading" ? "加载中…" : "—";
  const safeSiteTotal = status === "ready" ? `${emails.length} 封` : status === "loading" ? "加载中…" : "—";
  // 窗口天数由 meta 起止推导（live 93 天；JSON 历史快照 92 天），不硬编码。
  const windowDays = Math.round(
    (Date.parse(meta.windowEnd) - Date.parse(meta.windowStart)) / 86_400_000,
  ) + 1;

  return (
    <footer
      role="contentinfo"
      aria-label="数据说明与口径"
      className="mt-12 border-t border-[var(--border-default)] pt-8 pb-12 text-xs leading-relaxed text-[var(--text-secondary)]"
    >
      {/* 顶部数据范围与核心指标摘要 */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              统计窗口：{meta.range}（各市场当地日期）
            </span>
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              固定截止日：{meta.windowEnd}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--text-body)]">
            <span>当前站点样本：<strong className="text-[var(--text-heading)]">{safeSiteTotal}</strong></span>
            <span aria-hidden="true" className="text-[var(--border-strong)]">|</span>
            <span>近 3 周聚合：<strong className="text-[var(--text-heading)]">{safeThreeWeekTotal}</strong>（{formatWindowRange(THREE_WEEK_WINDOW)}）</span>
          </div>
        </div>
      </div>

      {/* 核心口径三列分栏说明 */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 第一列：总数含义 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            总数含义
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">总数含义：</strong>看板统计的所有封数均为 Milled 品牌归档在统计窗口内公开可见并被收录的邮件样本量，反映竞品公开营销动作、排期频次与主题节奏；<strong className="font-semibold text-[var(--text-body)]">非品牌向其私域受众全量发送的投递总量（Delivery Volume）</strong>。
          </p>
        </div>

        {/* 第二列：固定截止日与时间更新口径 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            固定截止日与时间口径
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">固定截止日：</strong>{meta.dataSource === "json" ? (
              <>本期研究为历史快照，截止日为 <strong className="font-semibold text-[var(--text-body)]">{meta.windowEnd}</strong>，整体分析覆盖 <strong className="font-semibold text-[var(--text-body)]">{meta.range}</strong> 的 {windowDays} 天历史窗口。快照窗口固定，不随每日任务或访问自然日滑动。</>
            ) : (
              <>本期研究设定固定截止日为 <strong className="font-semibold text-[var(--text-body)]">{meta.windowEnd}</strong>，整体分析覆盖 <strong className="font-semibold text-[var(--text-body)]">{meta.range}</strong> 的 {windowDays} 天滑动窗口。截止日由每日更新任务在成功后推进，窗口随之滑动并保持 {windowDays} 天，确保各品牌与站点在恒定长度时间区间内具备横向对比的可比性与复现性；窗口不随访问自然日自动推进。</>
            )}
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">时间口径：</strong>所有发送日期均按邮件发出时 <strong className="font-semibold text-[var(--text-body)]">各市场当地日历日期</strong> 归档与对齐。
          </p>
        </div>

        {/* 第三列：市场覆盖与分析规则 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            市场覆盖与分析规则
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">市场覆盖：</strong>系统共配置 8 个市场（US、UK、AU、FR、DE、IT、NL、ES），当前 7 个市场已有收录记录，西班牙（ES）收录为 0（选择后暂无邮件）。意大利（IT）与荷兰（NL）已有收录记录。{meta.dataSource === "json" ? "（当前为离线快照，仅展示历史 US 770 封样本。）" : ""}
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">品牌与分类：</strong>监测包含 Zara、lululemon、ALO Yoga、Halara、Temu、SHEIN 共 6 个品牌。主题分类依据主题行与正文推介判定，每封邮件唯一归入一个主导主题；词频按包含该词的去重邮件篇数计算；看板严格遵守合规边界，不引用任何竞品未经授权的原始文案。
          </p>
        </div>
      </div>
    </footer>
  );
}
