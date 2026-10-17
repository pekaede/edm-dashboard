import { useMemo } from "react";
import { useExtendedEmails } from "../email-data";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";

export function DashboardFooter() {
  // 页脚样本不再用冻结快照 DATA.meta.total = 196（B2）：取 3 周实时聚合 total（默认窗口全市场 211），
  // 市场取逐封数据的 meta.market（"美国 + 英国"）。未就绪时显示 "—"，不回落冻结值。
  const { status, emails, meta } = useExtendedEmails();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  return (
    <footer className="border-t border-slate-200 px-1 pt-5 text-xs leading-5 text-slate-600 lg:flex lg:items-start lg:justify-between lg:gap-8">
      <p className="min-w-0 font-semibold text-slate-700 lg:max-w-md">
        数据来源：{meta.source}（{meta.market}）· {formatWindowRange(data?.window ?? THREE_WEEK_WINDOW)}（美东时间）· 3 周样本 {data ? data.total : "—"} 封
      </p>
      <p className="mt-3 min-w-0 max-w-3xl lg:mt-0 lg:text-right">
        口径说明：计数为 Milled 品牌页在窗口内可见的收录邮件数，非品牌向全量收件人的发送量；主题分类为按主题行 +
        正文主推内容判定，每封只归一类；本页不引用任何竞品原始文案。
      </p>
    </footer>
  );
}
