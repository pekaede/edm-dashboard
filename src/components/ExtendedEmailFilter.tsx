import { useId, useMemo, useState } from "react";
import { EXTENDED_3MONTH } from "../data";
import { Card } from "./Card";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

const PAGE_SIZE = 50;

const FILTER_THEMES = [
  { key: "price", label: "价格促销" },
  { key: "behavior", label: "行为触发" },
  { key: "new", label: "上新" },
  { key: "lifestyle", label: "生活方式" },
  { key: "category", label: "品类聚焦" },
] as const;

type FilterTheme = (typeof FILTER_THEMES)[number]["key"];

const THEME_LABELS: Record<string, string> = {
  price: "价格促销",
  behavior: "行为触发",
  new: "上新",
  lifestyle: "生活方式",
  category: "品类聚焦",
  other: "其他",
};

const ALL_EMAILS = EXTENDED_3MONTH.brands
  .flatMap((brand) =>
    brand.emails.map((email, index) => ({
      ...email,
      brand: brand.name,
      brandPage: brand.brandPage,
      id: `${brand.name}-${email.date}-${index}`,
    })),
  )
  .sort((a, b) => b.date.localeCompare(a.date));

function getFilterButtonStyle(theme: FilterTheme, isSelected: boolean) {
  if (!isSelected) {
    return undefined;
  }

  return {
    backgroundColor: THEME_TINTS[theme],
    borderColor: THEME_COLORS[theme],
    color: "rgb(15 23 42)",
  };
}

export function ExtendedEmailFilter() {
  const [selectedTheme, setSelectedTheme] = useState<FilterTheme | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listId = useId();

  const filteredEmails = useMemo(
    () =>
      selectedTheme
        ? ALL_EMAILS.filter((email) => email.theme === selectedTheme)
        : ALL_EMAILS,
    [selectedTheme],
  );

  const visibleEmails = filteredEmails.slice(0, visibleCount);
  const selectedLabel = selectedTheme ? THEME_LABELS[selectedTheme] : "全部";
  const hasMore = visibleEmails.length < filteredEmails.length;

  const selectTheme = (theme: FilterTheme | null) => {
    setSelectedTheme((currentTheme) =>
      theme !== null && currentTheme === theme ? null : theme,
    );
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <Card
      title="3 个月邮件筛选"
      hint={`${EXTENDED_3MONTH.meta.range} · ${EXTENDED_3MONTH.meta.market} · 逐封记录按日期倒序`}
    >
      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="按邮件主题筛选"
        >
          <button
            type="button"
            onClick={() => selectTheme(null)}
            aria-pressed={selectedTheme === null}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none ${
              selectedTheme === null
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-950"
            }`}
          >
            全部
          </button>

          {FILTER_THEMES.map((theme) => {
            const isSelected = selectedTheme === theme.key;

            return (
              <button
                type="button"
                key={theme.key}
                onClick={() => selectTheme(theme.key)}
                aria-pressed={isSelected}
                aria-label={`${theme.label}主题${isSelected ? "，当前已选中，再次点击清除筛选" : ""}`}
                className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 focus-visible:outline-none"
                style={getFilterButtonStyle(theme.key, isSelected)}
              >
                {theme.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <p className="text-base font-bold text-slate-950" aria-live="polite" aria-atomic="true">
            {selectedLabel} · {filteredEmails.length} 封
          </p>
          <p className="text-xs leading-5 text-slate-500">
            当前显示 {visibleEmails.length} 封，每次加载 {PAGE_SIZE} 封
          </p>
        </div>

        <div
          id={listId}
          className="overflow-x-auto rounded-xl border border-slate-200"
          tabIndex={0}
          aria-label={`${selectedLabel}邮件列表，可横向滚动`}
        >
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              {selectedLabel}主题的 3 个月邮件记录，按日期从新到旧排列
            </caption>
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="w-32 px-4 py-3">日期</th>
                <th scope="col" className="w-36 px-4 py-3">品牌</th>
                <th scope="col" className="w-36 px-4 py-3">主题</th>
                <th scope="col" className="px-4 py-3">关键词</th>
                <th scope="col" className="w-28 px-4 py-3">品牌页</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleEmails.map((email) => (
                <tr key={email.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-slate-600">
                    {email.date}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{email.brand}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {THEME_LABELS[email.theme] ?? email.theme}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {email.keywords.length > 0 ? email.keywords.join("、") : ""}
                  </td>
                  <td className="px-4 py-3">
                    {email.brandPage ? (
                      <a
                        href={email.brandPage}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`在新窗口打开 ${email.brand} 的 Milled 品牌页`}
                        className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                      >
                        查看品牌页
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400" aria-label={`${email.brand} 未提供品牌页链接`}>
                        未提供
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              aria-controls={listId}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none"
            >
              加载更多（剩余 {filteredEmails.length - visibleEmails.length} 封）
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
