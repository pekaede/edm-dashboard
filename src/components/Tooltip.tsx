import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  label: string;
  // children 含链接、按钮等可交互元素时使用 "group"，保留其语义。
  anchorRole?: "img" | "group";
  className?: string;
  style?: CSSProperties;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type OpenSource = "hover" | "focus" | "click" | null;

function getViewportRect() {
  if (typeof window === "undefined") {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const vv = window.visualViewport;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      width: vv.width,
      height: vv.height,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function Tooltip({
  children,
  content,
  label,
  anchorRole = "img",
  className = "",
  style,
  open: controlledOpen,
  onOpenChange,
}: TooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const suppressNextFocusOpen = useRef(false);
  const openedByRef = useRef<OpenSource>(null);
  const pointerDownInTooltipRef = useRef(false);

  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width?: number;
    maxHeight?: number;
  }>(() => {
    if (typeof window === "undefined") {
      return { top: 0, left: 0 };
    }
    const vp = getViewportRect();
    const margin = 8;
    return {
      top: 0,
      left: 0,
      width: Math.min(288, Math.max(0, vp.width - margin * 2)),
      maxHeight: Math.max(0, vp.height - margin * 2),
    };
  });

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cancelClose();
    openedByRef.current = null;
    setOpen(false);
  }, [cancelClose, setOpen]);

  const handleOpen = useCallback(
    (source: "hover" | "focus" | "click") => {
      cancelClose();
      if (source === "click" || openedByRef.current !== "click") {
        openedByRef.current = source;
      }
      setOpen(true);
    },
    [cancelClose, setOpen],
  );

  const handleCloseLater = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!focused.current) {
        handleClose();
      }
    }, 120);
  }, [cancelClose, handleClose]);

  // 当外部关闭或 open 变为 false 时，重置 openedBy 与定时器；外部 open 为 true 且 openedBy 为 null 时同步为 focus
  useEffect(() => {
    if (!isOpen) {
      cancelClose();
      openedByRef.current = null;
      pointerDownInTooltipRef.current = false;
    } else if (openedByRef.current === null) {
      openedByRef.current = "focus";
    }
  }, [isOpen, cancelClose]);

  // 卸载时清理定时器与标志
  useEffect(() => () => {
    cancelClose();
    pointerDownInTooltipRef.current = false;
  }, [cancelClose]);

  // Esc 键关闭，并将焦点正确返回到 anchor（恢复焦点时抑制这次自动打开）
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        suppressNextFocusOpen.current = true;
        anchorRef.current?.focus();
        queueMicrotask(() => {
          suppressNextFocusOpen.current = false;
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // 触屏与外部点击关闭：点击外部时自动关闭，点击浮层内部时清除关闭定时器
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (tooltipRef.current?.contains(target)) {
        pointerDownInTooltipRef.current = true;
        cancelClose();
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      handleClose();
    };
    const handlePointerUp = () => {
      pointerDownInTooltipRef.current = false;
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isOpen, cancelClose, handleClose]);

  // 视口钳制定位计算与 VisualViewport 缩放适配
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      if (!anchorRef.current || !tooltipRef.current) return;
      const viewport = getViewportRect();
      const margin = 8;

      // 尺寸约束统一基于 visualViewport 尺寸，避免缩放后超出可视区域
      const availableWidth = Math.max(0, viewport.width - margin * 2);
      const availableHeight = Math.max(0, viewport.height - margin * 2);
      const targetWidth = Math.min(288, availableWidth);

      // 直接写入样式确保 measurement 前约束生效
      tooltipRef.current.style.width = `${targetWidth}px`;
      tooltipRef.current.style.maxHeight = `${availableHeight}px`;

      const anchor = anchorRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();

      // 默认优先放在上方；空间不足时尝试下方
      const above = anchor.top - tooltip.height - margin;
      const below = anchor.bottom + margin;
      const minTop = viewport.top + margin;
      const maxTop = Math.max(minTop, viewport.top + viewport.height - tooltip.height - margin);

      const fitsAbove = above >= minTop;
      const fitsBelow = below + tooltip.height <= viewport.top + viewport.height - margin;

      let targetTop = fitsAbove ? above : fitsBelow ? below : Math.max(minTop, above);
      const clampedTop = Math.max(minTop, Math.min(targetTop, maxTop));

      // 水平居中并钳制在 visualViewport 实际可视区域内（统一坐标系并考虑 offsetLeft）
      const idealLeft = anchor.left + anchor.width / 2 - tooltip.width / 2;
      const minLeft = viewport.left + margin;
      const maxLeft = Math.max(minLeft, viewport.left + viewport.width - tooltip.width - margin);
      const clampedLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));

      tooltipRef.current.style.top = `${clampedTop}px`;
      tooltipRef.current.style.left = `${clampedLeft}px`;

      setPosition({
        left: clampedLeft,
        top: clampedTop,
        width: targetWidth,
        maxHeight: availableHeight,
      });
    };

    place();
    const vv = window.visualViewport;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    if (vv) {
      vv.addEventListener("resize", place);
      vv.addEventListener("scroll", place);
    }
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (vv) {
        vv.removeEventListener("resize", place);
        vv.removeEventListener("scroll", place);
      }
    };
  }, [isOpen, content]);

  return (
    <div
      ref={anchorRef}
      tabIndex={0}
      role={anchorRole}
      aria-label={label}
      aria-describedby={isOpen ? tooltipId : undefined}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] ${className}`}
      style={style}
      onMouseEnter={() => handleOpen("hover")}
      onMouseLeave={handleCloseLater}
      onPointerDown={(event) => {
        const target = event.target as Node | null;
        if (target && tooltipRef.current?.contains(target)) {
          cancelClose();
          return;
        }
      }}
      onClick={(event) => {
        const target = event.target as Node | null;
        if (target && tooltipRef.current?.contains(target)) {
          cancelClose();
          return;
        }

        if (!isOpen) {
          handleOpen("click");
        } else if (openedByRef.current === "hover" || openedByRef.current === "focus") {
          cancelClose();
          openedByRef.current = "click";
        } else if (openedByRef.current === "click") {
          handleClose();
        } else {
          // openedBy 为 null 但 isOpen 为 true 时的兜底：按 hover/focus 分支处理（消费本次点击、openedBy 置为 'click'、保持打开）
          cancelClose();
          openedByRef.current = "click";
        }
      }}
      onKeyDown={(event) => {
        const target = event.target as Node | null;
        if (target && tooltipRef.current?.contains(target)) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (isOpen) {
            handleClose();
          } else {
            handleOpen("click");
          }
        }
      }}
      onFocus={() => {
        focused.current = true;
        if (suppressNextFocusOpen.current) {
          suppressNextFocusOpen.current = false;
          return;
        }
        handleOpen("focus");
      }}
      onBlur={(event) => {
        focused.current = false;
        const relatedTarget = event.relatedTarget as Node | null;
        if (relatedTarget && tooltipRef.current?.contains(relatedTarget)) {
          return;
        }
        if (pointerDownInTooltipRef.current) {
          return;
        }
        handleCloseLater();
      }}
    >
      {children}
      {isOpen
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              onMouseEnter={cancelClose}
              onMouseLeave={handleCloseLater}
              onPointerDown={() => {
                pointerDownInTooltipRef.current = true;
                cancelClose();
              }}
              onPointerUp={() => {
                pointerDownInTooltipRef.current = false;
              }}
              onPointerCancel={() => {
                pointerDownInTooltipRef.current = false;
              }}
              onClick={cancelClose}
              className="fixed z-[100] overflow-y-auto whitespace-normal break-words rounded-lg border border-[var(--border-strong)] bg-[var(--surface-tooltip)] px-3 py-2 text-center text-xs leading-5 text-[var(--text-inverse)] shadow-xl"
              style={{
                top: position.top,
                left: position.left,
                width: position.width !== undefined ? `${position.width}px` : undefined,
                maxHeight: position.maxHeight !== undefined ? `${position.maxHeight}px` : undefined,
                overflowWrap: "anywhere",
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
