import { useMemo } from "react";
import { useSiteEmails } from "../site-data";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";

export function DashboardFooter() {
  const { status, emails, meta } = useSiteEmails();
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
