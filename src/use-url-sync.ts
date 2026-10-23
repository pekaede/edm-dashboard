import { useCallback, useEffect, useRef, useState } from "react";
import { translateIn, type DictionaryKey } from "./i18n";
import {
  DEFAULT_PAGE_STATE,
  PageState,
  ViewType,
  buildHash,
  isEqualPageState,
  notifyUrlChanged,
  parseHash,
  URL_SYNC_EVENT,
} from "./url-state";

/** aria-label 随语言切换：就绪探针的选择器须同时匹配中英取值，文案以字典为单一来源。 */
function ariaLabelSelectors(element: string, key: DictionaryKey, suffix: string, contains = false): string {
  const op = contains ? "*=" : "=";
  return (["zh", "en"] as const)
    .map((locale) => `${element}[aria-label${op}"${translateIn(locale, key)}"]${suffix}`)
    .join(", ");
}

const SCROLL_STORAGE_PREFIX = "edm_reading_scroll_";
const scrollPositionCache = new Map<string, number>();
const lastScrollSnapshotByView = new Map<string, number>();

/**
 * Saves the current scroll / reading position for a given view or list.
 */
export function saveReadingPosition(view: string, position?: number): void {
  if (typeof window === "undefined") return;

  let y: number;
  if (position !== undefined) {
    if (!Number.isFinite(position)) return;
    y = position;
  } else {
    // 省略参数分支绝不能默认写 0：
    // 若该视图在 Map 中无快照，先读 sessionStorage 已有值：已有值则直接返回、不写回；无值也直接返回（无可保存内容）。即省略参数时永不写入 0。
    const snapshot =
      lastScrollSnapshotByView.get(view) ?? scrollPositionCache.get(view);
    if (snapshot !== undefined) {
      y = snapshot;
    } else {
      try {
        const raw = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${view}`);
        if (raw !== null) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            scrollPositionCache.set(view, parsed);
          }
        }
      } catch {
        // Fail silently
      }
      return;
    }
  }

  scrollPositionCache.set(view, y);
  lastScrollSnapshotByView.set(view, y);
  try {
    sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${view}`, String(y));
  } catch {
    // Fail silently when storage quota or privacy mode blocks sessionStorage
  }
}

/**
 * Gets the saved reading position for a given view.
 */
export function getSavedReadingPosition(view: string): number | null {
  if (scrollPositionCache.has(view)) {
    return scrollPositionCache.get(view) ?? null;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${view}`);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        scrollPositionCache.set(view, parsed);
        return parsed;
      }
    }
  } catch {
    // Fail silently
  }
  return null;
}

/**
 * Restores the reading scroll position for a given view.
 * Returns true if a saved position was found and restored.
 */
export function restoreReadingPosition(
  view: string,
  options?: { behavior?: ScrollBehavior; containerSelector?: string },
): boolean {
  if (typeof window === "undefined") return false;
  const saved = getSavedReadingPosition(view);
  if (saved === null) return false;

  const behavior = options?.behavior ?? "instant";

  // If a container selector is provided and exists, restore its scroll top
  if (options?.containerSelector) {
    const el = document.querySelector(options.containerSelector);
    if (el) {
      el.scrollTop = saved;
      return true;
    }
  }

  window.scrollTo({
    top: saved,
    behavior,
  });
  return true;
}

/**
 * Clears saved reading position for a specific view or all views.
 */
export function clearReadingPosition(view?: string): void {
  if (view) {
    scrollPositionCache.delete(view);
    lastScrollSnapshotByView.delete(view);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`${SCROLL_STORAGE_PREFIX}${view}`);
      } catch {
        // Ignore
      }
    }
  } else {
    scrollPositionCache.clear();
    lastScrollSnapshotByView.clear();
    if (typeof window !== "undefined") {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(SCROLL_STORAGE_PREFIX)) {
            toRemove.push(key);
          }
        }
        for (const key of toRemove) {
          sessionStorage.removeItem(key);
        }
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Fallback ready check ensuring view-specific content exists and no loading markers remain.
 */
function isTargetViewReady(
  view: ViewType,
  isReadyCallback?: (view: ViewType) => boolean,
): boolean {
  if (typeof document === "undefined") return false;
  if (isReadyCallback) {
    try {
      return Boolean(isReadyCallback(view));
    } catch {
      return false;
    }
  }

  const main = document.querySelector("main");
  if (!main) return false;

  // 必须满足“无加载标记”：检查 main 自身及子元素中的 aria-busy=true
  if (
    main.matches?.('[aria-busy="true"]') ||
    main.matches?.('[aria-busy=true]') ||
    main.getAttribute("aria-busy") === "true" ||
    main.querySelector('[aria-busy="true"], [aria-busy=true]')
  ) {
    return false;
  }

  // 检查 main 自身是否为包含加载指示的 role=status
  if (
    main.matches?.('[role="status"]') ||
    main.matches?.('[role=status]') ||
    main.getAttribute("role") === "status"
  ) {
    const mainText = main.textContent || "";
    if (!mainText.trim() || /加载|载入|loading/i.test(mainText)) {
      return false;
    }
  }

  const statusElements = main.querySelectorAll('[role="status"], [role=status]');
  for (let i = 0; i < statusElements.length; i++) {
    const text = statusElements[i].textContent || "";
    if (/加载|载入|loading/i.test(text)) {
      return false;
    }
  }

  switch (view) {
    case "emails": {
      // 必须有数据行 tbody tr
      const row =
        main.querySelector(ariaLabelSelectors("section", "viewEmails", " table tbody tr")) ||
        main.querySelector("table tbody tr");
      return Boolean(row);
    }
    case "report": {
      // 必须在专属 article 容器内有实际报告内容（如 header 或 h2），非仅加载占位
      const article = main.querySelector("article.markdown-report");
      if (!article) return false;
      return Boolean(
        article.querySelector("header") || article.querySelector("h2"),
      );
    }
    case "calendar": {
      // 必须在日历专属容器内有实际控件/内容（如品牌筛选组或日历内容），非仅加载占位
      const calendar =
        main.querySelector("section.calendar-view") ||
        main.querySelector(".calendar-view");
      if (!calendar) return false;
      return Boolean(
        calendar.querySelector('[role="group"]') ||
          calendar.querySelector(ariaLabelSelectors("", "calBrandFilterAria", "", true)) ||
          calendar.querySelector(".calendar-heatmap") ||
          calendar.querySelector("table"),
      );
    }
    case "dashboard": {
      return Boolean(
        main.querySelector(ariaLabelSelectors("section", "sectionSummary", "")) ||
          main.querySelector(".dashboard-overview-grid") ||
          main.querySelector('section[aria-labelledby="kpi-title"]'),
      );
    }
    default:
      return false;
  }
}

export interface UseUrlSyncOptions {
  /** Optional initial partial state overriding parsed hash defaults */
  initialState?: Partial<PageState>;
  /** Callback fired whenever the state changes from internal or external sources */
  onChange?: (state: PageState) => void;
  /** Whether to sync state changes to window.location.hash. Defaults to true. */
  syncToHash?: boolean;
  /** Whether to automatically save and restore reading scroll position per view. Defaults to true. */
  preserveScroll?: boolean;
  /** Optional callback to check if current view is ready for scroll restoration */
  isReady?: (view: ViewType) => boolean;
}

export interface UseUrlSyncResult {
  state: PageState;
  setState: (
    updater: PageState | ((prev: PageState) => PageState),
    options?: { replace?: boolean },
  ) => void;
  setView: (view: ViewType, options?: { replace?: boolean }) => void;
  setMarket: (market: string | null, options?: { replace?: boolean }) => void;
  setBrand: (brand: string, options?: { replace?: boolean }) => void;
  setTheme: (theme: string | null, options?: { replace?: boolean }) => void;
  setQuery: (query: string, options?: { replace?: boolean }) => void;
  /**
   * 邮件列表的日期范围（YYYY-MM-DD；空字符串表示未限定）。
   * 走与品牌/主题相同的 push 历史语义：每次提交都是一个可回退的筛选快照。
   */
  setDateRange: (
    dateFrom: string,
    dateTo: string,
    options?: { replace?: boolean },
  ) => void;
  saveScrollPosition: (view?: string, pos?: number) => void;
  restoreScrollPosition: (view?: string) => boolean;
  /**
   * 原始 URL hash（window.location.hash）。解析状态相同时也随 hash 变化而更新：
   * 如 #unknown/UK 与 #report/UK 都解析为 report/UK，但原始视图不同（未知→看板），
   * App 必须靠它知道视图变了，否则视图、站点对齐和滚动逻辑都不会执行。
   */
  hash: string;
}

/**
 * Hook for synchronizing PageState with URL hash, supporting:
 * - reading initial state from hash
 * - writing state changes back to hash (with push or replace)
 * - browser back / forward navigation restoration
 * - preserving reading scroll position when switching views / returning to list
 */
export function useUrlSync(options: UseUrlSyncOptions = {}): UseUrlSyncResult {
  const {
    initialState,
    onChange,
    syncToHash = true,
    preserveScroll = true,
    isReady,
  } = options;

  const getHashState = useCallback((): PageState => {
    if (typeof window === "undefined") {
      return { ...DEFAULT_PAGE_STATE, ...initialState };
    }
    const parsed = parseHash(window.location.hash);
    return {
      ...parsed,
      ...(initialState ?? {}),
    };
  }, [initialState]);

  const [state, setStateInternal] = useState<PageState>(getHashState);

  // 原始 hash 状态：任何导航事件（hashchange/popstate/URL_SYNC_EVENT）都更新，
  // 即使解析后的 PageState 相同（见 UseUrlSyncResult.hash 注释）。
  const [rawHash, setRawHash] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const rawHashRef = useRef(rawHash);

  // Keep refs to avoid stale closures in event listeners
  const stateRef = useRef<PageState>(state);
  stateRef.current = state;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  // Track window scroll positions bucketed by view, last scrolled view, restore state, and interaction
  const lastScrollByViewRef = useRef<Record<string, number>>({});
  const lastScrolledViewRef = useRef<string | null>(null);
  const restoredByViewRef = useRef<Record<string, boolean>>({});
  const exhaustedByViewRef = useRef<Record<string, boolean>>({});
  const userInteractedByViewRef = useRef<Record<string, boolean>>({});
  const pendingRestoreViewRef = useRef<string | null>(null);
  const restoringRef = useRef<boolean>(false);
  const restoreGenerationRef = useRef<number>(0);
  const [restoreTrigger, setRestoreTrigger] = useState<number>(0);

  // Track window scroll position actively under current view.
  // preserveScroll: false 的实例不做滚动恢复/持久化，滚动监听一并门控，
  // 避免重复实例上多余的 scroll 监听与共享快照 Map 写入（监听本身不触发任何
  // 状态更新，只写本实例 refs 与共享 Map，false 实例侧无任何消费者）。
  useEffect(() => {
    if (!preserveScroll || typeof window === "undefined") return;

    const handleWindowScroll = () => {
      const currentView = stateRef.current.view;
      const y = window.scrollY;
      if (!restoringRef.current) {
        userInteractedByViewRef.current[currentView] = true;
        // User actively scrolled; cancel pending restore for this view so we don't fight user
        if (pendingRestoreViewRef.current === currentView) {
          pendingRestoreViewRef.current = null;
        }
      }
      lastScrollByViewRef.current[currentView] = y;
      lastScrolledViewRef.current = currentView;
      lastScrollSnapshotByView.set(currentView, y);
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [preserveScroll]);

  // Proactively save reading position snapshot using lastScrollByViewRef with restore/interaction protection
  const saveScrollSnapshot = useCallback((targetView: string) => {
    const isRestored = Boolean(restoredByViewRef.current[targetView]);
    const isInteracted = Boolean(userInteractedByViewRef.current[targetView]);
    // 只有恢复已完成或用户已滚动/交互才保存；否则跳过保存，绝不用初始 0 覆盖既有位置
    if (!isRestored && !isInteracted) {
      return;
    }
    const pos = lastScrollByViewRef.current[targetView];
    if (pos !== undefined && Number.isFinite(pos)) {
      saveReadingPosition(targetView, pos);
    }
  }, []);

  // Write state changes to URL hash
  const writeHash = useCallback(
    (nextState: PageState, replace = false) => {
      if (!syncToHash || typeof window === "undefined") return;
      const targetHash = buildHash(nextState);
      if (window.location.hash === targetHash) return;

      if (replace) {
        window.history.replaceState(null, "", targetHash);
      } else {
        window.history.pushState(null, "", targetHash);
      }
      notifyUrlChanged();
    },
    [syncToHash],
  );

  // External setter for callers (side effects kept out of state updaters)
  const setState = useCallback(
    (
      updater: PageState | ((prev: PageState) => PageState),
      setOpts?: { replace?: boolean },
    ) => {
      // 多个 hook 实例可能在同一轮渲染前连续写入；所有字段都以最新 URL 为准，
      // 避免切站点或连续更改筛选时，用旧品牌/主题覆盖刚写入的值。
      const current = syncToHash && typeof window !== "undefined"
        ? parseHash(window.location.hash)
        : stateRef.current;
      const proposed = typeof updater === "function" ? updater(current) : updater;
      // 内存状态与最终可恢复的 URL 使用同一套归一规则。
      const next = parseHash(buildHash(proposed));
      if (isEqualPageState(current, next) && isEqualPageState(stateRef.current, next)) {
        writeHash(next, true);
        return;
      }

      // Save scroll position for the current view before switching view
      if (
        preserveScroll &&
        current.view !== next.view &&
        typeof window !== "undefined"
      ) {
        saveScrollSnapshot(current.view);
      }

      stateRef.current = next;
      setStateInternal(next);
      writeHash(next, setOpts?.replace ?? false);
      onChangeRef.current?.(next);
    },
    [preserveScroll, saveScrollSnapshot, syncToHash, writeHash],
  );

  const setView = useCallback(
    (view: ViewType, setOpts?: { replace?: boolean }) => {
      setState((prev) => ({ ...prev, view }), setOpts);
    },
    [setState],
  );

  const setMarket = useCallback(
    (market: string | null, setOpts?: { replace?: boolean }) => {
      // 任何程序化市场设置都是显式指定：写回 URL 时带市场段
      // （null → "all"），使前进后退能恢复该市场/全部市场。
      setState((prev) => ({ ...prev, market, marketSpecified: true }), setOpts);
    },
    [setState],
  );

  const setBrand = useCallback(
    (brand: string, setOpts?: { replace?: boolean }) => {
      setState((prev) => ({ ...prev, brand }), setOpts);
    },
    [setState],
  );

  const setTheme = useCallback(
    (theme: string | null, setOpts?: { replace?: boolean }) => {
      setState((prev) => ({ ...prev, theme }), setOpts);
    },
    [setState],
  );

  const setQuery = useCallback(
    (query: string, setOpts?: { replace?: boolean }) => {
      // Typically typing search queries should replace history rather than flood it
      const shouldReplace = setOpts?.replace ?? true;
      setState((prev) => ({ ...prev, query }), { replace: shouldReplace });
    },
    [setState],
  );

  const setDateRange = useCallback(
    (dateFrom: string, dateTo: string, setOpts?: { replace?: boolean }) => {
      setState((prev) => ({ ...prev, dateFrom, dateTo }), setOpts);
    },
    [setState],
  );

  // Listen for browser navigation (forward / back / external hashchange) and document click capture
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleNavigation = () => {
      const nextHash = window.location.hash;
      if (rawHashRef.current !== nextHash) {
        rawHashRef.current = nextHash;
        setRawHash(nextHash);
      }
      const parsed = parseHash(nextHash);
      const current = stateRef.current;

      if (!isEqualPageState(current, parsed)) {
        // If view is changing, save scroll position for current view
        if (preserveScroll && current.view !== parsed.view) {
          saveScrollSnapshot(current.view);
        }

        stateRef.current = parsed;
        setStateInternal(parsed);
        onChangeRef.current?.(parsed);
      }
    };

    // Document click capture phase to capture and save scroll position before browser executes anchor scroll
    const handleDocumentClick = (e: MouseEvent) => {
      if (!preserveScroll) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (target.getAttribute("target") === "_blank" || target.target === "_blank") {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || !href.startsWith("#")) return;

      const currentHash = window.location.hash || "#";
      const normalizedHref = href.startsWith("#") ? href : `#${href}`;
      if (normalizedHref === currentHash) return;

      saveScrollSnapshot(stateRef.current.view);
    };

    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener(URL_SYNC_EVENT, handleNavigation);
    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener(URL_SYNC_EVENT, handleNavigation);
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [preserveScroll, saveScrollSnapshot]);

  // If view is waiting for ready, watch DOM mutations to re-trigger restore when ready
  useEffect(() => {
    if (!preserveScroll || typeof window === "undefined") return;
    if (typeof MutationObserver === "undefined") return;

    let lastReady = false;

    const observer = new MutationObserver(() => {
      try {
        // (d) 恢复进行中（restoringRef 为 true）时 observer 不再递增
        if (restoringRef.current) return;

        const currentView = stateRef.current.view;
        if (pendingRestoreViewRef.current !== currentView) {
          lastReady = false;
          return;
        }

        // (a) observer 回调先判断 fallback 是否 ready，未 ready 不递增
        const ready = isTargetViewReady(currentView, isReadyRef.current);
        // (b) 只在 ready 状态由 false→true 跳变时触发一次（记录上次 ready 状态）
        if (!lastReady && ready) {
          lastReady = true;
          setRestoreTrigger((prev) => prev + 1);
        } else if (!ready) {
          lastReady = false;
        }
      } catch {
        // 吞掉异常，回调抛错后观察器仍继续工作
      }
    });

    const targetNode = document.documentElement || document.body;
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ["aria-busy", "role", "class", "hidden", "aria-hidden"],
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [preserveScroll]);

  let isCurrentViewReady: boolean | undefined = undefined;
  if (isReady) {
    try {
      isCurrentViewReady = isReady(state.view);
    } catch {
      isCurrentViewReady = false;
    }
  }

  // Handle restoring reading position on view changes with retry loop
  useEffect(() => {
    if (!preserveScroll || typeof window === "undefined") return;

    const currentView = state.view;
    restoreGenerationRef.current += 1;
    const currentGeneration = restoreGenerationRef.current;

    const saved = getSavedReadingPosition(currentView);
    if (saved !== null && Number.isFinite(saved)) {
      // 启动恢复，将 pending 登记为当前视图；仅当位置校验成功后才清除
      pendingRestoreViewRef.current = currentView;
      // 对目标视图启动恢复时，先把该视图的 userInteracted 重置为 false，只有恢复完成后用户的真实滚动才计入交互
      userInteractedByViewRef.current[currentView] = false;
      restoredByViewRef.current[currentView] = false;
      exhaustedByViewRef.current[currentView] = false;
      let attempts = 0;
      const maxAttempts = 40;
      let rafId: number | null = null;
      let resetRestoringRaf: number | null = null;

      const scheduleResetRestoring = () => {
        if (resetRestoringRaf !== null) {
          cancelAnimationFrame(resetRestoringRaf);
        }
        resetRestoringRaf = requestAnimationFrame(() => {
          resetRestoringRaf = requestAnimationFrame(() => {
            restoringRef.current = false;
            resetRestoringRaf = null;
          });
        });
      };

      const finishRestore = (success: boolean) => {
        restoredByViewRef.current[currentView] = success;
        pendingRestoreViewRef.current = success ? null : currentView;
        // 完成后置 false（覆盖 scrollTo 后同帧/下一帧内紧跟的滚动事件）
        scheduleResetRestoring();
      };

      const tryRestore = () => {
        // 恢复循环每帧校验当前视图仍为目标视图，视图已变则停止
        if (
          restoreGenerationRef.current !== currentGeneration ||
          stateRef.current.view !== currentView ||
          parseHash(window.location.hash).view !== currentView
        ) {
          restoringRef.current = false;
          return;
        }

        // 用户在恢复期间发生滚动交互则立即终止，保留用户滚动位置
        if (userInteractedByViewRef.current[currentView]) {
          pendingRestoreViewRef.current = null;
          restoringRef.current = false;
          return;
        }

        const ready = isTargetViewReady(currentView, isReadyRef.current);
        const maxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );

        if (ready) {
          // (a) 加 restoringRef 标志——恢复执行 scrollTo 前置 true
          restoringRef.current = true;
          try {
            window.scrollTo({ top: saved, behavior: "instant" });
            const actual = window.scrollY;
            lastScrollByViewRef.current[currentView] = actual;
            lastScrolledViewRef.current = currentView;
            lastScrollSnapshotByView.set(currentView, actual);

            // 实际位置与目标差距 ≤2px 视为成功；或实际位置已等于最大可滚动距离且目标 ≥ 最大值（已顶到头、无可再滚）也视为成功
            const isRestored =
              Math.abs(actual - saved) <= 2 ||
              (maxScroll > 0 && actual >= maxScroll - 2 && saved >= maxScroll);

            if (isRestored) {
              finishRestore(true);
              return;
            }
            // 校验未通过保留 pending
            pendingRestoreViewRef.current = currentView;
          } catch {
            // scrollTo 抛错时把 pending 重新登记为当前视图，以便后续 ready 跳变/重试能恢复
            pendingRestoreViewRef.current = currentView;
          } finally {
            scheduleResetRestoring();
          }
        } else {
          // 未 ready 时保留 pending
          pendingRestoreViewRef.current = currentView;
        }

        if (attempts >= maxAttempts) {
          // 耗尽时只置 exhausted、调用 finishRestore(false)，永不在未校验位置时标成功
          exhaustedByViewRef.current[currentView] = true;
          finishRestore(false);
          return;
        }

        attempts++;
        rafId = requestAnimationFrame(tryRestore);
      };

      rafId = requestAnimationFrame(tryRestore);
      return () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        if (resetRestoringRaf !== null) {
          cancelAnimationFrame(resetRestoringRaf);
        }
        restoringRef.current = false;
      };
    } else {
      restoredByViewRef.current[currentView] = true;
      pendingRestoreViewRef.current = null;
      restoringRef.current = false;
    }
  }, [preserveScroll, state.view, isCurrentViewReady, restoreTrigger]);

  // Save scroll position when window unloads or hides or unmounts
  useEffect(() => {
    if (!preserveScroll || typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      const activeView = lastScrolledViewRef.current ?? stateRef.current.view;
      saveScrollSnapshot(activeView);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const activeView = lastScrolledViewRef.current ?? stateRef.current.view;
        saveScrollSnapshot(activeView);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Cleanup saves using snapshot's view (view where scrolling last occurred), NOT current stateRef.view
      const cleanupView = lastScrolledViewRef.current;
      if (cleanupView) {
        saveScrollSnapshot(cleanupView);
      }
    };
  }, [preserveScroll, saveScrollSnapshot]);

  const saveScroll = useCallback(
    (view?: string, pos?: number) => {
      const targetView = view ?? stateRef.current.view;
      const targetPos =
        pos !== undefined
          ? pos
          : (lastScrollByViewRef.current[targetView] ?? lastScrollSnapshotByView.get(targetView));
      if (targetPos !== undefined) {
        saveReadingPosition(targetView, targetPos);
      }
    },
    [],
  );

  const restoreScroll = useCallback(
    (view?: string) => {
      return restoreReadingPosition(view ?? stateRef.current.view);
    },
    [],
  );

  return {
    state,
    setState,
    setView,
    setMarket,
    setBrand,
    setTheme,
    setQuery,
    setDateRange,
    saveScrollPosition: saveScroll,
    restoreScrollPosition: restoreScroll,
    hash: rawHash,
  };
}

export default useUrlSync;
