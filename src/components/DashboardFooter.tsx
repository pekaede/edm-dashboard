import { useMemo } from "react";
import { useExtendedEmails } from "../email-data";
import { useSiteEmails } from "../site-data";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";

export function DashboardFooter() {
  const { status, emails, meta } = useSiteEmails();
  const allEmails = useExtendedEmails();

  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const safeThreeWeekTotal = data ? `${data.total} 封` : status === "loading" ? "加载中…" : "—";
  const safeSiteTotal = status === "ready" ? `${emails.length} 封` : status === "loading" ? "加载中…" : "—";
  const safeGlobalTotal = allEmails.status === "ready" ? `${allEmails.total} 封` : allEmails.status === "loading" ? "加载中…" : "—";

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
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-heading)]">
              数据来源：{meta.dataSource === "supabase" ? "Supabase（实时只读）" : "JSON 回滚快照（历史 US）"} · Milled 收录
            </span>
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              统计窗口：2026-07-16 至 2026-10-15（美东时间）
            </span>
            <span className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
              固定截止日：2026-10-15
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--text-body)]">
            <span>当前站点样本：<strong className="text-[var(--text-heading)]">{safeSiteTotal}</strong></span>
            <span aria-hidden="true" className="text-[var(--border-strong)]">|</span>
            <span>近 3 周聚合：<strong className="text-[var(--text-heading)]">{safeThreeWeekTotal}</strong>（{formatWindowRange(THREE_WEEK_WINDOW)}）</span>
            <span aria-hidden="true" className="text-[var(--border-strong)]">|</span>
            <span>{meta.dataSource === "supabase" ? "全局多市场样本：" : "历史 US 样本："}<strong className="text-[var(--text-heading)]">{safeGlobalTotal}</strong></span>
          </div>
        </div>
      </div>

      {/* 核心口径三列分栏说明 */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 第一列：数据源与总数含义 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            数据来源与总数含义
          </h3>
          {meta.dataSource === "supabase" ? (
            <p>
              底层数据源自 <strong className="font-semibold text-[var(--text-body)]">Supabase</strong> 实时数据库（<code>emails</code> 表），记录直接映射自 <strong className="font-semibold text-[var(--text-body)]">Milled</strong> 公开归档库。数据源出处（Provenance）：{meta.provenance}
            </p>
          ) : (
            <p>
              当前运行于 <strong className="font-semibold text-[var(--text-body)]">JSON 回滚快照</strong> 模式（离线备用数据源）。数据范围仅限历史 US 样本，不连接 Supabase 实时数据库，不暗示实时多市场全量。数据源出处（Provenance）：{meta.provenance}
            </p>
          )}
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
            <strong className="font-semibold text-[var(--text-body)]">固定截止日：</strong>本期研究设定固定截止日为 <strong className="font-semibold text-[var(--text-body)]">2026-10-15</strong>，整体分析覆盖 <strong className="font-semibold text-[var(--text-body)]">2026-07-16 至 2026-10-15</strong> 的三个月固定历史基线窗口。固定截止日确保各品牌与站点在恒定时间区间内具备横向对比的可比性与复现性，历史窗口不随访问自然日动态滑动。
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">时间与校验：</strong>所有发送日期均按邮件发出时的 <strong className="font-semibold text-[var(--text-body)]">美东时间（EDT/EST）</strong> 归档与对齐；{meta.dataSource === "supabase" ? "前端加载时实时与 Supabase 校验精确行数与完整性。" : "前端加载时校验静态 JSON 快照的行数与完整性（仅历史 US 范围）。"}
          </p>
        </div>

        {/* 第三列：市场覆盖与分析规则 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-heading)]">
            市场覆盖与分析规则
          </h3>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">市场覆盖：</strong>系统共配置 8 个市场（US、UK、AU、FR、DE、IT、NL、ES），当前 7 个市场已有收录记录，西班牙（ES）收录为 0（选择将展示空态）。按基准核对总量 1420 封 = US 770 + UK 89 + AU 33 + FR 49 + DE 38 + IT 250 + NL 191 + ES 0。意大利（IT）与荷兰（NL）均已入库，非待收录状态。{meta.dataSource === "json" ? "（当前处于 JSON 回滚模式，仅展示历史 US 770 封样本，多市场全量请切换至 Supabase 模式。）" : ""}
          </p>
          <p>
            <strong className="font-semibold text-[var(--text-body)]">品牌与分类：</strong>监测包含 Zara、lululemon、ALO Yoga、Halara、Temu、SHEIN 共 6 个品牌。主题分类依据主题行与正文推介判定，每封邮件唯一归入一个主导主题；词频按包含该词的去重邮件篇数计算；看板严格遵守合规边界，不引用任何竞品未经授权的原始文案。
          </p>
        </div>
      </div>
    </footer>
  );
}
