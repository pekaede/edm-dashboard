import { useId, useMemo, useState } from "react";
import { BRAND_ORDER, getEmailMarket } from "../email-data";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { Card } from "./Card";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const PAGE_SIZE = 50;

const FILTER_THEMES = [
  { key: "price", label: "价格促销" },
  { key: "behavior", label: "行为触发" },
  { key: "new", label: "上新" },
  { key: "lifestyle", label: "生活方式" },
  { key: "category", label: "品类聚焦" },
  { key: "other", label: "其他" },
] as const;

const FILTER_BRANDS = BRAND_ORDER;

type FilterTheme = (typeof FILTER_THEMES)[number]["key"];
type FilterBrand = (typeof FILTER_BRANDS)[number];

const THEME_LABELS: Record<string, string> = {
  price: "价格促销",
  behavior: "行为触发",
  new: "上新",
  lifestyle: "生活方式",
  category: "品类聚焦",
  other: "其他",
};

const THEME_BADGE_STYLES: Record<string, string> = {
  price: "border-[var(--theme-price-border)] bg-[var(--theme-price-tint)] text-[var(--theme-price-text)]",
  behavior: "border-[var(--theme-behavior-border)] bg-[var(--theme-behavior-tint)] text-[var(--theme-behavior-text)]",
  new: "border-[var(--theme-new-border)] bg-[var(--theme-new-tint)] text-[var(--theme-new-text)]",
  lifestyle: "border-[var(--theme-lifestyle-border)] bg-[var(--theme-lifestyle-tint)] text-[var(--theme-lifestyle-text)]",
  category: "border-[var(--theme-category-border)] bg-[var(--theme-category-tint)] text-[var(--theme-category-text)]",
  other: "border-[var(--theme-other-border)] bg-[var(--theme-other-tint)] text-[var(--theme-other-text)]",
};

const FILTER_DOT_STYLES: Record<FilterTheme, string> = {
  price: "bg-[var(--theme-price)]",
  behavior: "bg-[var(--theme-behavior)]",
  new: "bg-[var(--theme-new)]",
  lifestyle: "bg-[var(--theme-lifestyle)]",
  category: "bg-[var(--theme-category)]",
  other: "bg-[var(--theme-other-indicator)]",
};

export function ExtendedEmailFilter({
  initialTheme,
}: {
  initialTheme?: string | null;
}) {
  const emailData = useSiteEmails();
  const { market: selectedMarket } = useSiteSelection();
  const { emails, meta, status } = emailData;
  const [selectedTheme, setSelectedTheme] = useState<FilterTheme | null>(() =>
    FILTER_THEMES.some((theme) => theme.key === initialTheme)
      ? (initialTheme as FilterTheme)
      : null,
  );
  const [selectedBrand, setSelectedBrand] = useState<FilterBrand | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listId = useId();

  const filteredEmails = useMemo(
    () =>
      emails.filter(
        (email) =>
          (!selectedBrand || email.brand === selectedBrand) &&
          (!selectedTheme || email.theme === selectedTheme),
      ),
    [emails, selectedBrand, selectedTheme],
  );

  const visibleEmails = filteredEmails.slice(0, visibleCount);
  const selectedThemeLabel = selectedTheme ? THEME_LABELS[selectedTheme] : "全部";
  const selectedBrandLabel = selectedBrand ?? "全部";
  const selectedMarketLabel = getMarketLabel(selectedMarket);
  const filterSummary = `市场：${selectedMarketLabel}，品牌：${selectedBrandLabel}，主题：${selectedThemeLabel}`;
  const hasMore = visibleEmails.length < filteredEmails.length;

  const selectBrand = (brand: FilterBrand | null) => {
    setSelectedBrand((currentBrand) =>
      brand !== null && currentBrand === brand ? null : brand,
    );
    setVisibleCount(PAGE_SIZE);
  };

  const selectTheme = (theme: FilterTheme | null) => {
    setSelectedTheme((currentTheme) =>
      theme !== null && currentTheme === theme ? null : theme,
    );
    setVisibleCount(PAGE_SIZE);
  };

  const hint = `${meta.range} · ${meta.market} · 逐封记录按日期倒序`;
  if (status !== "ready") {
    return (
      <Card title="3 个月邮件筛选" hint={hint}>
        <ExtendedEmailsState {...emailData} />
      </Card>
    );
  }

  return (
    <Card
      title="3 个月邮件筛选"
      hint={hint}
    >
      <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-page)]">
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="flex flex-col gap-4 border-b border-[var(--border-strong)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                Editorial email index
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-email-intro)] sm:text-base">
                从品牌与主题切入三个月邮件触达（含服务/法务通知），快速定位品牌的沟通重心与发送节奏。
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 text-[var(--text-heading)]">
              <strong className="text-3xl font-extrabold leading-none tracking-tight tabular-nums sm:text-4xl">
                {filteredEmails.length}
              </strong>
              <span className="pb-1 text-sm font-semibold">封邮件</span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  按品牌筛选
                </p>
                <p className="text-xs text-[var(--text-description)]">
                  当前：{selectedBrandLabel}
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7"
                role="group"
                aria-label="按邮件品牌筛选"
              >
                <button
                  type="button"
                  onClick={() => selectBrand(null)}
                  aria-pressed={selectedBrand === null}
                  className={`min-h-12 rounded-full border px-4 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                    selectedBrand === null
                      ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-white shadow-[var(--shadow-filter-active)]"
                      : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                  }`}
                >
                  全部
                </button>

                {FILTER_BRANDS.map((brand) => {
                  const isSelected = selectedBrand === brand;

                  return (
                    <button
                      type="button"
                      key={brand}
                      onClick={() => selectBrand(brand)}
                      aria-pressed={isSelected}
                      aria-label={`${brand}品牌${isSelected ? "，当前已选中，再次点击清除筛选" : ""}`}
                      className={`flex min-h-12 items-center justify-center rounded-full border px-3 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isSelected
                          ? "border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-[var(--shadow-filter-accent-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  按主题筛选
                </p>
                <p className="text-xs text-[var(--text-description)]" aria-live="polite" aria-atomic="true">
                  当前：{selectedThemeLabel}
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
                role="group"
                aria-label="按邮件主题筛选"
              >
                <button
                  type="button"
                  onClick={() => selectTheme(null)}
                  aria-pressed={selectedTheme === null}
                  className={`min-h-12 rounded-full border px-4 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                    selectedTheme === null
                      ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-white shadow-[var(--shadow-filter-active)]"
                      : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
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
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isSelected
                          ? "border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-[var(--shadow-filter-accent-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${isSelected ? "bg-white/80" : FILTER_DOT_STYLES[theme.key]}`}
                        aria-hidden="true"
                      />
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {filteredEmails.length === 0 ? (
          <div
            className="border-y border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-10 text-center sm:px-6"
            role="status"
          >
            <p className="text-sm font-bold text-[var(--text-control)]">无符合当前筛选的邮件</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-description)]">
              {filterSummary}。请切换市场、品牌或主题，或清除筛选。
            </p>
          </div>
        ) : (
        <div
          id={listId}
          className="max-h-[min(42rem,65dvh)] overflow-auto border-y border-[var(--border-strong)] bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-ink)]"
          tabIndex={0}
          aria-label={`${filterSummary}的邮件列表，可横向滚动`}
        >
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left text-sm text-[var(--text-email-table)]">
            <caption className="sr-only">
              {filterSummary}的 3 个月邮件记录，按日期从新到旧排列
            </caption>
            <thead className="sticky top-0 z-10 bg-[var(--surface-table-header)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--surface-table-stripe)] shadow-[var(--shadow-table-header)]">
              <tr>
                <th scope="col" className="w-32 px-5 py-4">日期</th>
                <th scope="col" className="w-44 px-5 py-4">品牌</th>
                <th scope="col" className="w-24 px-5 py-4">市场</th>
                <th scope="col" className="w-40 px-5 py-4">主题</th>
                <th scope="col" className="px-5 py-4">关键词</th>
                <th scope="col" className="w-24 whitespace-nowrap px-5 py-4">原文</th>
              </tr>
            </thead>
            <tbody>
              {visibleEmails.map((email, index) => (
                <tr
                  key={JSON.stringify([getEmailMarket(email), email.brand, email.date, email.source_index, email.day_seq])}
                  className={`transition-colors hover:bg-[var(--surface-table-hover)] ${index % 2 === 0 ? "bg-[var(--surface-card)]" : "bg-[var(--surface-table-stripe)]"}`}
                >
                  <td className="border-b border-[var(--divider-email)] px-5 py-4 font-mono text-xs font-medium tabular-nums text-[var(--text-label)]">
                    {email.date}
                  </td>
                  <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                    <span className="font-bold tracking-[-0.01em] text-[var(--text-email-brand)]">{email.brand}</span>
                  </td>
                  <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle text-[var(--text-detail)]">
                    {getMarketLabel(getEmailMarket(email))}
                  </td>
                  <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                    <span
                      className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold ${THEME_BADGE_STYLES[email.theme] ?? THEME_BADGE_STYLES.other}`}
                    >
                      {THEME_LABELS[email.theme] ?? email.theme}
                    </span>
                  </td>
                  <td className="max-w-xl border-b border-[var(--divider-email)] px-5 py-4 leading-6 text-[var(--text-detail)]">
                    <span className="line-clamp-2">
                      {email.keywords.length > 0 ? email.keywords.join(" · ") : "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                    {email.url ? (
                      <a
                        href={email.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`查看 ${email.brand} ${email.date} 的邮件原文（新窗口打开）`}
                        className="rounded-sm font-semibold text-[var(--accent-ink)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2"
                      >
                        原文
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="flex flex-col gap-4 bg-[var(--surface-page)] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-xs leading-5 text-[var(--text-caption)]" aria-live="polite">
            已显示 <strong className="text-[var(--text-control)]">{visibleEmails.length}</strong> / {filteredEmails.length} 封
            <span className="mx-2" aria-hidden="true">·</span>
            按日期倒序
          </p>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              aria-controls={listId}
              className="min-h-11 rounded-full border border-[var(--text-control)] bg-[var(--text-control)] px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-ink)] hover:border-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
            >
              加载更多（剩余 {filteredEmails.length - visibleEmails.length} 封）
            </button>
          ) : (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-notice)]">已加载全部</p>
          )}
        </div>
      </div>
    </Card>
  );
}
