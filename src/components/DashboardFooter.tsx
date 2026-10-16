export function DashboardFooter() {
  return (
    <footer className="border-t border-slate-200/80 px-1 pt-2 text-xs leading-6 text-slate-500 sm:flex sm:items-start sm:justify-between sm:gap-8">
      <p className="shrink-0 font-medium text-slate-600">
        数据来源：Milled（美国市场）· 2026-09-24 至 2026-10-15（美东时间）· 样本 196 封
      </p>
      <p className="mt-2 max-w-3xl sm:mt-0 sm:text-right">
        口径说明：计数为 Milled 品牌页在窗口内可见的收录邮件数，非品牌向全量收件人的发送量；主题分类为按主题行 +
        正文主推内容判定，每封只归一类；本页不引用任何竞品原始文案。
      </p>
    </footer>
  );
}
