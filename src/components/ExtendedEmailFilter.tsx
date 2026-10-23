import { useTable, type PaginationState, type Updater } from "@tanstack/react-table";
import { elementScroll, useVirtualizer } from "@tanstack/react-virtual";
import { Download, Search, Star, X } from "lucide-react";
import { emailTableColumns, emailTableFeatures, getEmailRowKey as getEmailKey } from "./email-table-model";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BRAND_ORDER,
  EmailRecord,
  getEmailMarket,
} from "../email-data";
import { downloadFile, EmailExportRow, emailsToCSV } from "../export";
import { translate, useLocale, type DictionaryKey } from "../i18n";
import {
  loadFavorites,
  subscribeFavorites,
  toggleFavorite,
} from "../favorites";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  parseHash,
  URL_SYNC_EVENT,
} from "../url-state";
import { THREE_WEEK_WINDOW } from "../three-week-aggregation";
import { useUrlSync } from "../use-url-sync";
import { Card } from "./Card";
import { themeLabelKeyOf } from "./dashboard";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const PAGE_SIZE = 50;
const EMAIL_LIST_SCROLL_KEY = "edm-emails-list-scroll";
const EMAIL_LIST_ANCHOR_KEY = "edm-emails-list-anchor";
const EMAIL_WINDOW_SCROLL_KEY = "edm-emails-window-scroll";
const EMAIL_VISIBLE_COUNT_KEY = "edm-emails-visible-count";

type EmailScrollAnchor = { key: string; offset: number };

const FILTER_THEMES = [
  { key: "price", labelKey: "themePrice" },
  { key: "behavior", labelKey: "themeBehavior" },
  { key: "new", labelKey: "themeNew" },
  { key: "lifestyle", labelKey: "themeLifestyle" },
  { key: "category", labelKey: "themeCategory" },
  { key: "other", labelKey: "themeOther" },
] as const satisfies readonly { key: string; labelKey: DictionaryKey }[];

const FILTER_BRANDS = BRAND_ORDER;

function themeLabelOf(theme: string): string {
  const key = themeLabelKeyOf(theme);
  return key ? translate(key) : theme;
}

const THEME_BADGE_STYLES: Record<string, string> = {
  price: "border-[var(--theme-price-border)] bg-[var(--theme-price-tint)] text-[var(--theme-price-text)]",
  behavior: "border-[var(--theme-behavior-border)] bg-[var(--theme-behavior-tint)] text-[var(--theme-behavior-text)]",
  new: "border-[var(--theme-new-border)] bg-[var(--theme-new-tint)] text-[var(--theme-new-text)]",
  lifestyle: "border-[var(--theme-lifestyle-border)] bg-[var(--theme-lifestyle-tint)] text-[var(--theme-lifestyle-text)]",
  category: "border-[var(--theme-category-border)] bg-[var(--theme-category-tint)] text-[var(--theme-category-text)]",
  other: "border-[var(--theme-other-border)] bg-[var(--theme-other-tint)] text-[var(--theme-other-text)]",
};

const FILTER_DOT_STYLES: Record<(typeof FILTER_THEMES)[number]["key"], string> = {
  price: "bg-[var(--theme-price)]",
  behavior: "bg-[var(--theme-behavior)]",
  new: "bg-[var(--theme-new)]",
  lifestyle: "bg-[var(--theme-lifestyle)]",
  category: "bg-[var(--theme-category)]",
  other: "bg-[var(--theme-other-indicator)]",
};

/**
 * Text renderer that highlights matching substring from query with accessible styling.
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return <>{text}</>;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={index}
            className="rounded-xs bg-[var(--selection-bg)] px-0.5 font-semibold text-[var(--text-heading)]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ExpandableKeywords({
  email,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  email: EmailRecord;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
}) {
  const { t } = useLocale();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  // A row can remount while already expanded (pagination / filter /
  // sort unmounts the row, expandedRowKeys survives). The only way to
  // reach expanded is via the overflow button, so a remount with
  // isExpanded already true must start with the button visible —
  // otherwise the row could never be collapsed again. Measuring is
  // impossible while expanded (no clamp), so seed from the prop; the
  // collapse path re-measures for real.
  const [isOverflowing, setIsOverflowing] = useState(isExpanded);
  const keywordsKey = email.keywords.join(" · ");

  // Measured overflow, not a keyword-count heuristic: the span is clamped
  // to 2 lines when collapsed, so scrollHeight > clientHeight means the
  // content is actually truncated. While expanded there is no clamp, so
  // keep the last measured value (the button was shown to get here).
  const measureOverflow = useCallback(() => {
    const el = spanRef.current;
    if (!el || isExpanded) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [isExpanded]);

  useLayoutEffect(() => {
    measureOverflow();
    // Highlighting (font-semibold + padding on matches) can change line
    // wrapping without changing the span's box size, so re-measure when
    // the query changes too — ResizeObserver alone would miss it.
  }, [measureOverflow, keywordsKey, searchQuery]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureOverflow]);

  // Font swaps can change line wrapping (scrollHeight) without changing
  // the span's box size, which ResizeObserver would not report.
  // Re-measure once webfonts settle; no-op when expanded or on the server.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) measureOverflow();
    });
    return () => {
      cancelled = true;
    };
  }, [measureOverflow]);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        ref={spanRef}
        className={`transition-all ${
          isExpanded ? "line-clamp-none" : "line-clamp-2"
        }`}
      >
        {email.keywords.map((kw, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="text-[var(--text-muted)]" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
            )}
            <HighlightText text={kw} query={searchQuery} />
          </span>
        ))}
      </span>
      {/* Always offer 收起 while expanded: bulk “展开全部内容” can
          expand a row that measured as fitting (isOverflowing false),
          and overflow cannot be measured while unclamped. Collapsing
          such a row is a no-op visually, but the row must stay
          collapsible per-row. In the collapsed state the button still
          appears only on measured overflow, which is the original fix. */}
      {isOverflowing || isExpanded ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={t("efKwAria", { action: isExpanded ? t("efCollapse") : t("efExpand"), brand: email.brand, date: email.date })}
          className="inline-flex rounded-xs text-xs font-semibold text-[var(--accent-ink)] underline underline-offset-2 hover:underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)]"
        >
          {isExpanded ? t("efCollapse") : t("efExpandAllBtn")}
        </button>
      ) : null}
    </div>
  );
}

type DatePresetKey = "all" | "7d" | "3w" | "30d";

const DATE_PRESETS: { key: DatePresetKey; labelKey: DictionaryKey }[] = [
  { key: "all", labelKey: "efRangeAll" },
  { key: "7d", labelKey: "efRange7d" },
  { key: "3w", labelKey: "efRange3w" },
  { key: "30d", labelKey: "efRange30d" },
];

/** ISO 日期平移（UTC 计算，避免时区跨日）。 */
function shiftISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function ExtendedEmailFilter() {
  const { t } = useLocale();
  const emailData = useSiteEmails();
  const { market: selectedMarket, setMarket } = useSiteSelection();
  const { emails, meta, status } = emailData;

  const { state: urlState, setState: setUrlState, setQuery, setDateRange } = useUrlSync({
    isReady: () => status === "ready",
  });

  // 品牌、主题与搜索只从 URL 派生；前进后退及外部链接与控件使用同一状态。
  const selectedTheme = urlState.theme;
  // 切站点保留品牌；新站点无匹配时展示可重置的空态。
  const selectedBrand = urlState.brand === "all" ? null : urlState.brand;
  const searchQuery = urlState.query;
  // 日期范围同样只从 URL 派生（#emails…?from=YYYY-MM-DD&to=YYYY-MM-DD）：
  // 刷新/分享/前进后退后筛选可还原；其他视图的 hash 不携带日期。
  const dateFrom = urlState.dateFrom;
  const dateTo = urlState.dateTo;

  const handleDateFromChange = (value: string) => {
    setDateRange(value, dateTo);
    setVisibleCount(PAGE_SIZE);
  };
  const handleDateToChange = (value: string) => {
    setDateRange(dateFrom, value);
    setVisibleCount(PAGE_SIZE);
  };

  // 三周与看板共用固定闭区间；其他快捷范围以数据窗口末日为锚点。
  const dateRangeForPreset = (key: DatePresetKey) => {
    if (key === "all") return { start: "", end: "" };
    if (key === "3w") return THREE_WEEK_WINDOW;
    const days = key === "7d" ? 7 : 30;
    return { start: shiftISODate(meta.windowEnd, -(days - 1)), end: meta.windowEnd };
  };
  const applyDatePreset = (key: DatePresetKey) => {
    const range = dateRangeForPreset(key);
    setDateRange(range.start, range.end);
    setVisibleCount(PAGE_SIZE);
  };
  const activeDatePreset: DatePresetKey | null =
    DATE_PRESETS.find(({ key }) => {
      const range = dateRangeForPreset(key);
      return dateFrom === range.start && dateTo === range.end;
    })?.key ?? null;

  // Restore visibleCount from storage so returning to list does not reset to PAGE_SIZE and lose position
  const [pagination, setPagination] = useState<PaginationState>(() => {
    if (typeof window === "undefined") return { pageIndex: 0, pageSize: PAGE_SIZE };
    try {
      const saved = sessionStorage.getItem(EMAIL_VISIBLE_COUNT_KEY);
      if (saved !== null) {
        const count = Number(saved);
        if (Number.isFinite(count) && count >= PAGE_SIZE) {
          return { pageIndex: 0, pageSize: Math.floor(count) };
        }
      }
    } catch {
      // Fallback on security error
    }
    return { pageIndex: 0, pageSize: PAGE_SIZE };
  });
  // 用 TanStack 的第一页逐步扩大 pageSize，保留原有“显示更多”及会话存储键。
  const visibleCount = pagination.pageSize;
  const setVisibleCount = useCallback((updater: Updater<number>) => {
    setPagination((previous) => ({
      pageIndex: 0,
      pageSize: typeof updater === "function" ? updater(previous.pageSize) : updater,
    }));
  }, []);

  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;

  // Persist visibleCount whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(EMAIL_VISIBLE_COUNT_KEY, String(visibleCount));
    } catch {
      // SecurityError protection
    }
  }, [visibleCount]);

  // 外部 URL 导航或切站点只重置分页；日期已纳入 URL，同样参与比对。
  const previousFiltersRef = useRef({ selectedMarket, selectedBrand, selectedTheme, searchQuery, dateFrom, dateTo });
  useEffect(() => {
    const previous = previousFiltersRef.current;
    if (
      previous.selectedMarket !== selectedMarket ||
      previous.selectedBrand !== selectedBrand ||
      previous.selectedTheme !== selectedTheme ||
      previous.searchQuery !== searchQuery ||
      previous.dateFrom !== dateFrom ||
      previous.dateTo !== dateTo
    ) {
      setVisibleCount(PAGE_SIZE);
    }
    previousFiltersRef.current = { selectedMarket, selectedBrand, selectedTheme, searchQuery, dateFrom, dateTo };
  }, [selectedMarket, selectedBrand, selectedTheme, searchQuery, dateFrom, dateTo]);

  // Favorites state from localStorage with cross-tab/event sync
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(
    () => new Set(loadFavorites()),
  );
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [favoriteSaveError, setFavoriteSaveError] = useState(false);
  const favoriteSaveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (favoriteSaveErrorTimerRef.current !== null) {
        clearTimeout(favoriteSaveErrorTimerRef.current);
      }
    };
  }, []);

  const showError = () => {
    setFavoriteSaveError(true);
    if (favoriteSaveErrorTimerRef.current !== null) {
      clearTimeout(favoriteSaveErrorTimerRef.current);
    }
    favoriteSaveErrorTimerRef.current = setTimeout(() => {
      favoriteSaveErrorTimerRef.current = null;
      setFavoriteSaveError(false);
    }, 5000);
  };

  // Content expansion state for truncated keyword cells
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const listId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dateFromInputRef = useRef<HTMLInputElement | null>(null);
  const allLoadedRef = useRef<HTMLParagraphElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const lastWindowScrollRef = useRef<number>(0);
  const restoredRef = useRef(false);
  const exhaustedRef = useRef(false);
  const restoringRef = useRef(false);
  const programListTopRef = useRef<number | null>(null);
  const programWindowTopRef = useRef<number | null>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);
  const userInteractedRef = useRef(false);
  const restoreGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  const columnFilters = useMemo(() => [{
    id: "email",
    value: {
      market: selectedMarket, brand: selectedBrand, theme: selectedTheme,
      dateFrom, dateTo, favoritesOnly: showOnlyFavorites, favoriteKeys, query: searchQuery,
    },
  }], [selectedMarket, selectedBrand, selectedTheme, dateFrom, dateTo, showOnlyFavorites, favoriteKeys, searchQuery]);
  const table = useTable({
    features: emailTableFeatures,
    columns: emailTableColumns,
    data: emails,
    getRowId: getEmailKey,
    state: { columnFilters, pagination },
    initialState: { sorting: [{ id: "date", desc: true }] },
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
  });
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredEmails = useMemo(() => filteredRows.map((row) => row.original), [filteredRows]);
  const visibleRows = table.getRowModel().rows;
  const visibleRowsRef = useRef(visibleRows);
  visibleRowsRef.current = visibleRows;
  const visibleEmails = useMemo(() => visibleRows.map((row) => row.original), [visibleRows]);
  // 结果计数播报节流（无障碍）：搜索框逐字输入时过滤结果每击一键就变化；
  // 若把 aria-live 直接挂在计数段落上，读屏器会逐键播报打断阅读。
  // 这里只在计数稳定 600ms 后把文本写入独立播报区；首屏 announced 与初始值一致，不产生播报。
  const countAnnouncement = `${t("efShownPrefix")} ${visibleEmails.length} / ${filteredEmails.length} ${t("marketUnitEmails", { count: filteredEmails.length })}`;
  const [announcedCount, setAnnouncedCount] = useState(countAnnouncement);
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncedCount(countAnnouncement), 600);
    return () => window.clearTimeout(timer);
  }, [countAnnouncement]);
  const getVirtualRowKey = useCallback((index: number) => visibleRows[index].id, [visibleRows]);
  const cancelScrollRestoration = useCallback(() => {
    userInteractedRef.current = true;
    restoringRef.current = false;
    cancelRestoreRef.current?.();
  }, []);
  const hasExternalScroll = useCallback(() => {
    const container = listContainerRef.current;
    return (container !== null && programListTopRef.current !== null && container.scrollTop !== programListTopRef.current) ||
      (programWindowTopRef.current !== null && window.scrollY !== programWindowTopRef.current);
  }, []);
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => listContainerRef.current,
    getItemKey: getVirtualRowKey,
    estimateSize: () => 100,
    overscan: 6,
    scrollToFn: (offset, options, instance) => {
      // 虚拟器的测量补偿和异步定位也属于自身写入；写前先防止覆盖尚未派发 scroll 的用户滚动。
      if (restoringRef.current && hasExternalScroll()) {
        cancelScrollRestoration();
        return;
      }
      elementScroll(offset, options, instance);
      programListTopRef.current = instance.scrollElement?.scrollTop ?? null;
    },
    // 表头占据正常文档流的 48px；占位行仅补齐 tbody 内的虚拟空间。
    scrollMargin: 48,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length ? Math.max(0, virtualRows[0].start - 48) : 0;
  const paddingBottom = virtualRows.length
    ? Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - 48)) : 0;
  const columnCount = selectedMarket === null ? 9 : 8;

  const saveListPosition = useCallback((top: number) => {
    const row = rowVirtualizer.getVirtualItemForOffset(top);
    try {
      sessionStorage.setItem(EMAIL_LIST_SCROLL_KEY, String(top));
      if (row) {
        // 使用视口所在行而非 overscan 首行；offset 允许为负，以保留顶部表头空间。
        const anchor: EmailScrollAnchor = { key: String(row.key), offset: top - row.start };
        sessionStorage.setItem(EMAIL_LIST_ANCHOR_KEY, JSON.stringify(anchor));
      } else {
        sessionStorage.removeItem(EMAIL_LIST_ANCHOR_KEY);
      }
    } catch {
      // SecurityError protection
    }
  }, [rowVirtualizer]);

  // Track container scroll position actively
  const handleContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const top = e.currentTarget.scrollTop;
      if (!restoringRef.current || top !== programListTopRef.current) {
        cancelScrollRestoration();
      }
      lastScrollTopRef.current = top;
      if (!restoringRef.current) {
        saveListPosition(top);
      }
    },
    [saveListPosition, cancelScrollRestoration],
  );

  // Track window scroll position actively
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWindowScroll = () => {
      if (!restoringRef.current || window.scrollY !== programWindowTopRef.current) {
        cancelScrollRestoration();
      }
      lastWindowScrollRef.current = window.scrollY;
    };
    const handleScrollKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ![
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " ", "Spacebar",
      ].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        (target.tagName === "BUTTON" && (event.key === " " || event.key === "Spacebar"))
      )) return;
      cancelScrollRestoration();
    };
    const handleScrollbarPointer = (event: PointerEvent) => {
      // 原生滚动条的按下目标是滚动容器或文档根节点，内容子节点的点击不算拖动。
      if (event.button === 0 && (
        event.target === listContainerRef.current || event.target === document.documentElement || event.target === document
      )) cancelScrollRestoration();
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("wheel", cancelScrollRestoration, { passive: true, capture: true });
    window.addEventListener("touchmove", cancelScrollRestoration, { passive: true, capture: true });
    window.addEventListener("pointerdown", handleScrollbarPointer, true);
    window.addEventListener("keydown", handleScrollKey, true);
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("wheel", cancelScrollRestoration, true);
      window.removeEventListener("touchmove", cancelScrollRestoration, true);
      window.removeEventListener("pointerdown", handleScrollbarPointer, true);
      window.removeEventListener("keydown", handleScrollKey, true);
    };
  }, [cancelScrollRestoration]);

  // Subscribe to favorites changes
  useEffect(() => {
    return subscribeFavorites(() => {
      setFavoriteKeys(new Set(loadFavorites()));
    });
  }, []);

  // Proactively save reading position before unmount / visibility change / page unload / view transition
  const saveReadingPosition = useCallback(() => {
    // StrictMode effect replay safety: only save when restore has completed
    // or user has interacted/scrolled; otherwise do not overwrite stored position with 0
    if (!restoredRef.current && !userInteractedRef.current) {
      return;
    }

    // Always use tracked ref value rather than reading live window.scrollY at unmount/save time,
    // protecting against window scroll collapse during SPA view transitions
    const windowTop = lastWindowScrollRef.current;
    const containerTop =
      listContainerRef.current && listContainerRef.current.scrollTop > 0
        ? listContainerRef.current.scrollTop
        : lastScrollTopRef.current;

    saveListPosition(containerTop);
    try {
      sessionStorage.setItem(EMAIL_WINDOW_SCROLL_KEY, String(windowTop));
      sessionStorage.setItem(
        EMAIL_VISIBLE_COUNT_KEY,
        String(visibleCountRef.current),
      );
    } catch {
      // SecurityError protection
    }
  }, [saveListPosition]);

  // 离开邮件视图前主动保存阅读位置；筛选同步统一交给 useUrlSync。
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUrlOrViewChange = () => {
      const parsed = parseHash(window.location.hash);
      // Synchronously save reading position when switching away from emails view
      if (parsed.view !== "emails") {
        saveReadingPosition();
      }
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (
        target.getAttribute("target") === "_blank" ||
        target.target === "_blank"
      ) {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || !href.startsWith("#")) return;

      const currentHash = window.location.hash || "#";
      const normalizedHref = href.startsWith("#") ? href : `#${href}`;
      if (normalizedHref === currentHash) return;

      const parsed = parseHash(href);
      if (parsed.view !== "emails") {
        saveReadingPosition();
      }
    };

    window.addEventListener("hashchange", handleUrlOrViewChange);
    window.addEventListener("popstate", handleUrlOrViewChange);
    window.addEventListener(URL_SYNC_EVENT, handleUrlOrViewChange);
    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      window.removeEventListener("hashchange", handleUrlOrViewChange);
      window.removeEventListener("popstate", handleUrlOrViewChange);
      window.removeEventListener(URL_SYNC_EVENT, handleUrlOrViewChange);
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [saveReadingPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveReadingPosition();
      }
    };

    window.addEventListener("beforeunload", saveReadingPosition);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveReadingPosition();
      window.removeEventListener("beforeunload", saveReadingPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [saveReadingPosition]);

  // Restore reading position when data is ready and table is rendered (retries with rAF)
  useEffect(() => {
    mountedRef.current = true;
    if (status !== "ready" || typeof window === "undefined") {
      return () => {
        mountedRef.current = false;
      };
    }
    if (restoredRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    restoreGenerationRef.current += 1;
    const currentGeneration = restoreGenerationRef.current;
    // 恢复启动时把组件的 userInteractedRef 重置为 false，并重置 exhaustedRef
    userInteractedRef.current = false;
    exhaustedRef.current = false;

    let savedContainerScroll: string | null = null;
    let savedWindowScroll: string | null = null;
    let savedAnchor: EmailScrollAnchor | null = null;
    try {
      savedContainerScroll = sessionStorage.getItem(EMAIL_LIST_SCROLL_KEY);
      savedWindowScroll = sessionStorage.getItem(EMAIL_WINDOW_SCROLL_KEY);
      const anchor = JSON.parse(sessionStorage.getItem(EMAIL_LIST_ANCHOR_KEY) ?? "null");
      if (anchor && typeof anchor.key === "string" && typeof anchor.offset === "number" && Number.isFinite(anchor.offset)) {
        savedAnchor = anchor;
      }
    } catch {
      // 锚点损坏或存储不可读时，仍可使用已读取的像素位置回退。
    }

    if (savedContainerScroll === null && savedWindowScroll === null && savedAnchor === null) {
      restoredRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }

    let rafId: number | null = null;
    let resetRestoringRaf: number | null = null;
    let attempts = 0;
    const maxAttempts = 30;
    const requiredStableMeasurements = 4;
    let anchorLocated = false;
    let anchorCalibrated = false;
    let previousAnchorMeasurement: { start: number; size: number } | null = null;
    let stableAnchorMeasurements = 0;
    const cancelPendingRestore = () => {
      restoreGenerationRef.current += 1;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resetRestoringRaf !== null) cancelAnimationFrame(resetRestoringRaf);
      rowVirtualizer.cancelScroll();
      if (cancelRestoreRef.current === cancelPendingRestore) cancelRestoreRef.current = null;
    };
    cancelRestoreRef.current = cancelPendingRestore;
    programListTopRef.current = listContainerRef.current?.scrollTop ?? null;
    programWindowTopRef.current = window.scrollY;
    // 首帧之前也要接受主动输入取消。
    restoringRef.current = true;

    const getMeasuredAnchor = () => {
      const container = listContainerRef.current;
      if (!savedAnchor || !container) return null;
      // 实测尺寸等于估算值时不会写入 itemSizeCache；以已挂载行的实际矩形为准。
      const element = rowVirtualizer.elementsCache.get(savedAnchor.key);
      if (!element?.isConnected) return null;
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0) return null;
      const start = container.scrollTop + rect.top - container.getBoundingClientRect().top - (container.clientTop || 0);
      // 展开状态或窗口宽度可能变化；行变短时仍停留在锚点邮件内。
      return {
        start,
        size: rect.height,
        top: Math.max(0, start + Math.min(savedAnchor.offset, Math.max(0, rect.height - 1))),
      };
    };

    const scheduleResetRestoring = () => {
      if (resetRestoringRaf !== null) {
        cancelAnimationFrame(resetRestoringRaf);
      }
      resetRestoringRaf = requestAnimationFrame(() => {
        resetRestoringRaf = requestAnimationFrame(() => {
          restoringRef.current = false;
          resetRestoringRaf = null;
          if ((restoredRef.current || exhaustedRef.current) && cancelRestoreRef.current === cancelPendingRestore) {
            cancelRestoreRef.current = null;
          }
        });
      });
    };

    const tryRestore = () => {
      // 代数仍为本次 setup 的代数且组件仍 mounted 且当前视图仍为目标视图，否则终止
      if (
        !mountedRef.current ||
        restoreGenerationRef.current !== currentGeneration ||
        parseHash(window.location.hash).view !== "emails"
      ) {
        restoringRef.current = false;
        return;
      }

      if (userInteractedRef.current || hasExternalScroll()) {
        cancelScrollRestoration();
        return;
      }

      // 自身恢复执行 scrollTo 前置 true
      restoringRef.current = true;
      try {
        const container = listContainerRef.current;
        const anchorIndex = savedAnchor
          ? visibleRowsRef.current.findIndex((row) => row.id === savedAnchor.key) : -1;
        if (anchorIndex >= 0 && container) {
          const measurement = getMeasuredAnchor();
          if (!anchorLocated || measurement === null) {
            // 先让锚点行挂载并测量，不能把旧缓存下的像素位置直接用于新虚拟器。
            rowVirtualizer.scrollToIndex(anchorIndex, { align: "start" });
            anchorLocated = true;
            anchorCalibrated = false;
          } else {
            rowVirtualizer.scrollToOffset(measurement.top);
            anchorCalibrated = true;
          }
        } else if (savedContainerScroll !== null) {
          const top = Number(savedContainerScroll);
          if (Number.isFinite(top) && container) {
            container.scrollTop = top;
            programListTopRef.current = container.scrollTop;
          }
        }

        if (savedWindowScroll !== null) {
          const top = Number(savedWindowScroll);
          if (Number.isFinite(top)) {
            window.scrollTo({ top, behavior: "instant" });
            programWindowTopRef.current = window.scrollY;
          }
        }

        // 下一帧校验实际位置
        rafId = requestAnimationFrame(() => {
          if (
            !mountedRef.current ||
            restoreGenerationRef.current !== currentGeneration ||
            parseHash(window.location.hash).view !== "emails"
          ) {
            restoringRef.current = false;
            return;
          }

          if (userInteractedRef.current || hasExternalScroll()) {
            cancelScrollRestoration();
            return;
          }

          try {
            let restoredContainer = false;
            let restoredWindow = false;

            const curContainer = listContainerRef.current;
            const measurement = anchorIndex >= 0 ? getMeasuredAnchor() : null;
            // 渐进测量可能先只移动 1px，随后继续变化；位置和行高须连续多次稳定。
            if (measurement) {
              stableAnchorMeasurements = previousAnchorMeasurement?.start === measurement.start &&
                previousAnchorMeasurement.size === measurement.size ? stableAnchorMeasurements + 1 : 1;
            } else {
              stableAnchorMeasurements = 0;
            }
            previousAnchorMeasurement = measurement;
            const containerTarget = anchorIndex >= 0
              ? measurement?.top ?? null : savedContainerScroll !== null ? Number(savedContainerScroll) : null;
            if (anchorIndex >= 0 || savedContainerScroll !== null) {
              if ((anchorIndex < 0 || anchorCalibrated) && containerTarget !== null && Number.isFinite(containerTarget)) {
                const top = containerTarget;
                if (curContainer) {
                  const actual = curContainer.scrollTop;
                  const max = Math.max(
                    0,
                    curContainer.scrollHeight - curContainer.clientHeight,
                  );
                  const tolerance = anchorIndex >= 0 ? 0.5 : 2;
                  const atTarget = Math.abs(actual - top) <= tolerance ||
                    (max > 0 && actual >= max - tolerance && top >= max);
                  if (atTarget && (anchorIndex < 0 || stableAnchorMeasurements >= requiredStableMeasurements)) {
                    restoredContainer = true;
                    lastScrollTopRef.current = actual;
                  }
                }
              } else if (anchorIndex < 0) {
                restoredContainer = true;
              }
            } else {
              restoredContainer = true;
            }

            if (savedWindowScroll !== null) {
              const top = Number(savedWindowScroll);
              if (Number.isFinite(top)) {
                const actual = window.scrollY;
                const max = Math.max(
                  0,
                  document.documentElement.scrollHeight - window.innerHeight,
                );
                if (
                  Math.abs(actual - top) <= 2 ||
                  (max > 0 && actual >= max - 2 && top >= max)
                ) {
                  restoredWindow = true;
                  lastWindowScrollRef.current = actual;
                }
              } else {
                restoredWindow = true;
              }
            } else {
              restoredWindow = true;
            }

            attempts++;
            if ((restoredContainer && restoredWindow) || attempts >= maxAttempts) {
              // 无论稳定还是耗尽，按本次最后的 DOM 实测收尾，不再启动虚拟器的异步定位循环。
              rowVirtualizer.cancelScroll();
              if (curContainer && measurement) {
                curContainer.scrollTop = measurement.top;
                programListTopRef.current = curContainer.scrollTop;
                lastScrollTopRef.current = curContainer.scrollTop;
              }
              restoredRef.current = restoredContainer && restoredWindow;
              exhaustedRef.current = !restoredRef.current;
              return;
            }

            // 未成功继续重试
            rafId = requestAnimationFrame(tryRestore);
          } catch {
            // Protection against scroll errors
          } finally {
            scheduleResetRestoring();
          }
        });
      } catch {
        // Protection against scroll errors
      } finally {
        scheduleResetRestoring();
      }
    };

    rafId = requestAnimationFrame(tryRestore);
    return () => {
      mountedRef.current = false;
      cancelPendingRestore();
      restoringRef.current = false;
    };
  }, [status, rowVirtualizer, hasExternalScroll, cancelScrollRestoration]);

  const handleSearchChange = (val: string) => {
    setVisibleCount(PAGE_SIZE);
    setQuery(val);
  };

  const handleClearSearch = () => {
    setVisibleCount(PAGE_SIZE);
    setQuery("");
    searchInputRef.current?.focus();
  };

  // 清除日期按钮随日期置空而卸载：显式把焦点交还给起始日期输入框，
  // 避免键盘/读屏用户焦点掉到 body（与 handleClearSearch 同模式）。
  const handleClearDates = () => {
    setDateRange("", "");
    setVisibleCount(PAGE_SIZE);
    dateFromInputRef.current?.focus();
  };

  const handleToggleFavorite = (email: EmailRecord) => {
    const key = getEmailKey(email);
    if (!toggleFavorite(key)) {
      showError();
    }
  };

  const toggleRowExpand = (key: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Content expansion semantics: allExpanded is derived, collapsing all clears set, per-row toggle works anytime
  const allExpanded = useMemo(() => {
    if (visibleEmails.length === 0) return false;
    return visibleEmails.every((email) =>
      expandedRowKeys.has(getEmailKey(email)),
    );
  }, [visibleEmails, expandedRowKeys, getEmailKey]);

  const handleToggleAllExpand = () => {
    if (allExpanded) {
      setExpandedRowKeys(new Set());
    } else {
      setExpandedRowKeys(new Set(visibleEmails.map((e) => getEmailKey(e))));
    }
  };
  const selectedThemeLabel = selectedTheme ? themeLabelOf(selectedTheme) : t("calAllBrands");
  const selectedBrandLabel = selectedBrand ?? t("calAllBrands");
  const selectedMarketLabel = getMarketLabel(selectedMarket);
  const dateRangeLabel =
    dateFrom || dateTo
      ? t("efDateRange", { from: dateFrom || t("efUnlimited"), to: dateTo || t("efUnlimited") })
      : t("efRangeAll");
  const filterSummary = t("efFilterSummary", { market: selectedMarketLabel, brand: selectedBrandLabel, theme: selectedThemeLabel, date: dateFrom || dateTo ? t("efSummaryDate", { range: dateRangeLabel }) : "", fav: showOnlyFavorites ? t("efSummaryFav") : "", search: searchQuery.trim() ? t("efSummarySearch", { q: searchQuery.trim() }) : "" });
  const hasMore = visibleEmails.length < filteredEmails.length;
  // 空依赖的加载回调通过 ref 读取本次渲染的完成判定。
  const willLoadAllRef = useRef(false);
  willLoadAllRef.current = hasMore && visibleEmails.length + PAGE_SIZE >= filteredEmails.length;

  // Load more without layout jump / scroll position loss
  const handleLoadMore = useCallback(() => {
    const willLoadAll = willLoadAllRef.current;
    const container = listContainerRef.current;
    const prevContainerTop = container ? container.scrollTop : 0;
    const prevWindowY = lastWindowScrollRef.current;

    setVisibleCount((count) => count + PAGE_SIZE);

    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = prevContainerTop;
      }
      window.scrollTo({ top: prevWindowY, behavior: "instant" });
      if (willLoadAll) allLoadedRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // Export full filtered dataset (not just visible subset) to RFC4180 CSV
  const handleExportCSV = useCallback(() => {
    if (filteredEmails.length === 0) return;
    const rows: EmailExportRow[] = filteredEmails.map((email) => ({
      market: getEmailMarket(email),
      brand: email.brand,
      sent_date: email.date,
      theme: email.theme,
      keywords: email.keywords,
      original_url: email.url ?? "",
    }));
    const csv = emailsToCSV(rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`edm-emails-${dateStr}.csv`, csv, "text/csv;charset=utf-8;");
  }, [filteredEmails]);

  const selectBrand = (brand: string | null) => {
    setUrlState((current) => ({
      ...current,
      brand: brand ?? "all",
    }));
    setVisibleCount(PAGE_SIZE);
  };

  const selectTheme = (theme: string | null) => {
    setUrlState((current) => ({
      ...current,
      theme,
    }));
    setVisibleCount(PAGE_SIZE);
  };

  const hint = t("efHint", { range: meta.range, market: meta.market });

  if (status !== "ready") {
    return (
      <Card title={t("efTitle")} hint={hint}>
        <ExtendedEmailsState {...emailData} />
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card title={t("efTitle")} hint={hint}>
        <div className="py-6">
          <EmptyState
            title={t("stEmptyMarketTitle", { market: selectedMarketLabel })}
            description={t("efEmptyMarketDesc", { range: meta.range })}
            actionLabel={selectedMarket ? t("efSwitchAll") : t("efRetry")}
            onAction={selectedMarket ? () => setMarket(null) : emailData.retry}
          />
        </div>
      </Card>
    );
  }

  const favoriteCount = favoriteKeys.size;

  return (
    <Card title={t("efTitle")} hint={hint}>
      <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-page)]">
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {/* Header summary banner */}
          <div className="flex flex-col gap-4 border-b border-[var(--border-strong)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                Editorial email index
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-email-intro)] sm:text-base">
                {t("efIntro")}
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 text-[var(--text-heading)]">
              <strong className="text-3xl font-extrabold leading-none tracking-tight tabular-nums sm:text-4xl">
                {filteredEmails.length}
              </strong>
              <span className="pb-1 text-sm font-semibold">{t("efUnitEmails", { count: filteredEmails.length })}</span>
            </div>
          </div>

          {/* Filter options (Brand & Theme) */}
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  {t("efFilterByBrand")}
                </p>
                <p className="text-xs text-[var(--text-description)]">
                  {t("marketCurrent")}{selectedBrandLabel}
                </p>
              </div>

              <Select value={selectedBrand ?? "all"} onValueChange={(value) => selectBrand(value === "all" ? null : value)}>
                <SelectTrigger className="min-h-12 max-w-md" aria-label={t("efBrandGroupAria")}>
                  <SelectValue>{selectedBrandLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("calAllBrands")}</SelectItem>
                  {selectedBrand && !FILTER_BRANDS.some((brand) => brand === selectedBrand) ? <SelectItem value={selectedBrand}>{selectedBrand}</SelectItem> : null}
                  {FILTER_BRANDS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  {t("efFilterByTheme")}
                </p>
                <p
                  className="text-xs text-[var(--text-description)]"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {t("marketCurrent")}{selectedThemeLabel}
                </p>
              </div>

              <Select value={selectedTheme === null ? "__all__" : `theme:${selectedTheme}`} onValueChange={(value) => selectTheme(value === "__all__" ? null : value.slice(6))}>
                <SelectTrigger className="min-h-12 max-w-md" aria-label={t("efThemeGroupAria")}>
                  <SelectValue>{selectedThemeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("calAllBrands")}</SelectItem>
                  {selectedTheme && !FILTER_THEMES.some((theme) => theme.key === selectedTheme) ? <SelectItem value={`theme:${selectedTheme}`}>{selectedThemeLabel}</SelectItem> : null}
                  {FILTER_THEMES.map((theme) => (
                    <SelectItem key={theme.key} value={`theme:${theme.key}`} textValue={t(theme.labelKey)}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`size-2 rounded-full ${FILTER_DOT_STYLES[theme.key]}`} aria-hidden="true" />
                        {t(theme.labelKey)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  {t("efFilterByDate")}
                </p>
                <p
                  className="text-xs text-[var(--text-description)]"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {t("marketCurrent")}{dateRangeLabel}
                </p>
              </div>
              <div
                className="mb-3 flex flex-wrap gap-2.5"
                role="group"
                aria-label={t("efDateGroupAria")}
              >
                {DATE_PRESETS.map((preset) => {
                  const isActive = activeDatePreset === preset.key;
                  return (
                    <button
                      type="button"
                      key={preset.key}
                      onClick={() => applyDatePreset(preset.key)}
                      aria-pressed={isActive}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isActive
                          ? "border-[var(--control-active-border)] bg-[var(--control-active-bg)] text-[var(--control-active-text)] shadow-[var(--shadow-filter-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      {t(preset.labelKey)}
                    </button>
                  );
                })}
              </div>
              {/* 自定义日期输入区：与上方日期预设组（role="group"）保持一致的组语义，复用既有 efFilterByDate 键 */}
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-2.5"
                role="group"
                aria-label={t("efFilterByDate")}
              >
                <label className="flex items-center gap-2 text-base font-semibold text-[var(--text-description)]">
                  {t("efDateFrom")}
                  <input
                    type="date"
                    ref={dateFromInputRef}
                    value={dateFrom}
                    min={meta.windowStart}
                    max={dateTo || meta.windowEnd}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="min-w-44 rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                  />
                </label>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  —
                </span>
                <label className="flex items-center gap-2 text-base font-semibold text-[var(--text-description)]">
                  {t("efDateTo")}
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || meta.windowStart}
                    max={meta.windowEnd}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="min-w-44 rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                  />
                </label>
                {dateFrom || dateTo ? (
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="rounded-full border border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] px-4 py-2 text-sm font-bold text-[var(--text-control)] transition hover:bg-[var(--control-filter-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                  >
                    {t("efClearDates")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Interactive Toolbar: Search, Favorites filter, Expand all, Export CSV */}
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <label htmlFor={`${listId}-search`} className="sr-only">
                {t("efSearchLabel")}
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                <Search className="size-4" aria-hidden="true" />
              </div>
              <input
                id={`${listId}-search`}
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("efSearchPlaceholder")}
                className="w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] py-2 pr-9 pl-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label={t("efClearSearchAria")}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--text-muted)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-1 rounded-sm"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* Actions group: Favorites toggle, Expand toggle, Export button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOnlyFavorites((prev) => !prev);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-pressed={showOnlyFavorites}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm ${
                  showOnlyFavorites
                    ? "border-[var(--theme-behavior-border)] bg-[var(--theme-behavior-tint)] text-[var(--theme-behavior-text)] shadow-xs"
                    : "border-[var(--control-border)] bg-[var(--control-bg)] text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
                }`}
              >
                <Star className="size-4" fill={showOnlyFavorites ? "currentColor" : "none"} aria-hidden="true" />
                <span>{t("efFavOnly", { n: favoriteCount })}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAllExpand}
                aria-pressed={allExpanded}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-xs font-semibold text-[var(--control-text)] transition hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm"
              >
                <span>{allExpanded ? t("efCollapseAll") : t("efExpandAll")}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredEmails.length === 0}
                aria-label={t("efExportAria", { n: filteredEmails.length })}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm ${
                  filteredEmails.length > 0
                    ? "border-[var(--control-active-border)] bg-[var(--control-active-bg)] text-[var(--control-active-text)] hover:bg-[var(--control-active-hover-bg)] hover:border-[var(--control-active-hover-bg)]"
                    : "cursor-not-allowed border-[var(--control-disabled-border)] bg-[var(--control-disabled-bg)] text-[var(--control-disabled-text)] opacity-60"
                }`}
              >
                <Download className="size-4" aria-hidden="true" />
                <span>{t("efExportLabel", { n: filteredEmails.length })}</span>
              </button>
            </div>
          </div>
          {favoriteSaveError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {t("efFavoriteSaveFailed")}
            </div>
          ) : null}
        </div>

        {/* Empty state when filters or search yield 0 results */}
        {filteredEmails.length === 0 ? (
          <div className="border-y border-[var(--border-strong)] bg-[var(--surface-card)] p-4 sm:p-6">
            <EmptyState
              title={t("efNoResultTitle")}
              description={t("efNoResultDesc", { summary: filterSummary })}
              actionLabel={t("efResetFilterSearch")}
              onAction={() => {
                // 重置走 replace 语义：不把空结果页本身写入历史栈，避免按后退又退回空结果。
                setUrlState(
                  (current) => ({ ...current, brand: "all", theme: null, query: "", dateFrom: "", dateTo: "" }),
                  { replace: true },
                );
                setShowOnlyFavorites(false);
                setVisibleCount(PAGE_SIZE);
                searchInputRef.current?.focus();
              }}
            />
          </div>
        ) : (
          /* Scrollable email table */
          <div
            id={listId}
            ref={listContainerRef}
            onScroll={handleContainerScroll}
            className="max-h-[min(42rem,65dvh)] overflow-auto border-y border-[var(--border-strong)] bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-ink)]"
            tabIndex={0}
            aria-label={t("efTableAria", { summary: filterSummary })}
          >
            <table
              aria-rowcount={visibleRows.length + 1}
              data-email-table
              data-filtered-rows={filteredRows.length}
              data-page-size={pagination.pageSize}
              className="w-full min-w-[92rem] table-fixed border-separate border-spacing-0 text-left text-sm text-[var(--text-email-table)]"
            >
              <caption className="sr-only">
                {t("efCaption", { summary: filterSummary })}
              </caption>
              <colgroup>
                <col className="w-16" /><col className="w-32" /><col className="w-40" />
                {selectedMarket === null ? <col className="w-24" /> : null}
                <col className="w-36" /><col className="w-56" /><col className="w-56" />
                <col className="w-80" /><col className="w-24" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--surface-table-header)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-table-inverse)] shadow-[var(--shadow-table-header)]">
                <tr>
                  <th scope="col" className="w-16 px-4 py-4 text-center">
                    {t("efColFav")}
                  </th>
                  <th scope="col" className="w-32 px-5 py-4">
                    {t("efColDate")}
                  </th>
                  <th scope="col" className="w-40 px-5 py-4">
                    {t("efColBrand")}
                  </th>
                  {selectedMarket === null && (
                    <th scope="col" className="w-24 px-5 py-4">
                      {t("efColMarket")}
                    </th>
                  )}
                  <th scope="col" className="w-36 px-5 py-4">
                    {t("efColTheme")}
                  </th>
                  <th scope="col" className="min-w-56 px-5 py-4">
                    {t("efColSubject")}
                  </th>
                  <th scope="col" className="min-w-56 px-5 py-4">
                    {t("efColPreheader")}
                  </th>
                  <th scope="col" className="px-5 py-4">
                    {t("efColKeywords")}
                  </th>
                  <th scope="col" className="w-24 whitespace-nowrap px-5 py-4">
                    {t("efColOriginal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paddingTop > 0 ? <tr aria-hidden="true"><td colSpan={columnCount} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr> : null}
                {virtualRows.map((virtualRow) => {
                  const index = virtualRow.index;
                  const row = visibleRows[index];
                  const email = row.original;
                  const emailKey = row.id;
                  const isFav = favoriteKeys.has(emailKey);
                  const isExpanded = expandedRowKeys.has(emailKey);
                  const hasKeywords = email.keywords.length > 0;

                  return (
                    <tr
                      key={emailKey}
                      data-index={index}
                      data-email-row={emailKey}
                      aria-rowindex={index + 2}
                      ref={rowVirtualizer.measureElement}
                      className={`transition-colors hover:bg-[var(--surface-table-hover)] ${
                        index % 2 === 0
                          ? "bg-[var(--surface-card)]"
                          : "bg-[var(--surface-table-stripe)]"
                      }`}
                    >
                      {/* Favorite toggle cell */}
                      <td className="w-16 border-b border-[var(--divider-email)] px-4 py-4 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(email)}
                          aria-label={t("efFavAria", { action: isFav ? t("efFavRemove") : t("efFavAdd"), brand: email.brand, date: email.date })}
                          aria-pressed={isFav}
                          className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] ${
                            isFav
                              ? "text-[var(--theme-behavior-text)] underline underline-offset-2 hover:underline-offset-4 hover:decoration-2 hover:bg-[var(--control-hover-bg)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--text-heading)]"
                          }`}
                        >
                          <Star className="size-5" fill={isFav ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
                      </td>

                      {/* Date cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 font-mono text-xs font-medium tabular-nums text-[var(--text-label)]">
                        <HighlightText
                          text={email.date}
                          query={searchQuery}
                        />
                      </td>

                      {/* Brand cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        <span className="font-bold tracking-[-0.01em] text-[var(--text-email-brand)]">
                          <HighlightText
                            text={email.brand}
                            query={searchQuery}
                          />
                        </span>
                      </td>

                      {/* Market cell: shown only in all-markets mode, redundant when a single site is selected */}
                      {selectedMarket === null && (
                        <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle text-[var(--text-detail)]">
                          {getMarketLabel(getEmailMarket(email))}
                        </td>
                      )}

                      {/* Theme cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        <span
                          className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold ${
                            THEME_BADGE_STYLES[email.theme] ??
                            THEME_BADGE_STYLES.other
                          }`}
                        >
                          <HighlightText
                            text={themeLabelOf(email.theme)}
                            query={searchQuery}
                          />
                        </span>
                      </td>

                      {/* Subject cell */}
                      <td className="max-w-md border-b border-[var(--divider-email)] px-5 py-4 align-middle leading-6 text-[var(--text-detail)]">
                        {email.subject ? (
                          <span className="line-clamp-2" title={email.subject}>
                            {email.subject}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Preheader cell */}
                      <td className="max-w-md border-b border-[var(--divider-email)] px-5 py-4 align-middle leading-6 text-[var(--text-detail)]">
                        {email.preheader ? (
                          <span className="line-clamp-2" title={email.preheader}>
                            {email.preheader}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Keywords cell with highlight and expandable truncation */}
                      <td className="max-w-xl border-b border-[var(--divider-email)] px-5 py-4 leading-6 text-[var(--text-detail)]">
                        {hasKeywords ? (
                          <ExpandableKeywords
                            email={email}
                            isExpanded={isExpanded}
                            onToggle={() => toggleRowExpand(emailKey)}
                            searchQuery={searchQuery}
                          />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Original URL cell */}
                      <td className="whitespace-nowrap border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        {email.url ? (
                          <a
                            href={email.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("efOriginalAria", { brand: email.brand, date: email.date })}
                            className="rounded-xs font-semibold text-[var(--accent-ink)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                          >
                            {t("efColOriginal")}
                          </a>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 ? <tr aria-hidden="true"><td colSpan={columnCount} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr> : null}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: Pagination / Load more and record count */}
        {filteredEmails.length > 0 ? (
          <div className="flex flex-col gap-4 bg-[var(--surface-page)] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p
              className="text-xs leading-5 text-[var(--text-caption)]"
            >
              {t("efShownPrefix")}{" "}
              <strong className="text-[var(--text-control)]">
                {visibleEmails.length}
              </strong>{" "}
              / {filteredEmails.length} {t("marketUnitEmails", { count: filteredEmails.length })}
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {t("efSortDesc")}
            </p>

            {hasMore ? (
              <button
                type="button"
                onClick={handleLoadMore}
                aria-controls={listId}
                className="min-h-11 rounded-full border border-[var(--control-active-border)] bg-[var(--control-active-bg)] px-5 py-2.5 text-sm font-bold text-[var(--control-active-text)] transition hover:-translate-y-0.5 hover:border-[var(--control-active-hover-bg)] hover:bg-[var(--control-active-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
              >
                {t("efLoadMore", { n: filteredEmails.length - visibleEmails.length })}
              </button>
            ) : (
              <p ref={allLoadedRef} tabIndex={-1} className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-notice)]">
                {t("efLoadedAll")}
              </p>
            )}
          </div>
        ) : null}
        {/* 独立播报区：与可视计数分离，由上方防抖逻辑驱动；DOM 常驻，空态时仍可播报。 */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announcedCount}
        </span>
      </div>
    </Card>
  );
}
