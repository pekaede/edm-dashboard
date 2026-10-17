import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Tooltip({ children, content, label, className, style }: {
  children: ReactNode;
  content: ReactNode;
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }

  function open() {
    cancelClose();
    setIsOpen(true);
  }

  function closeLater() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!focused.current) setIsOpen(false);
    }, 120);
  }

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      if (!anchorRef.current || !tooltipRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const above = anchor.top - tooltip.height - 8;
      setPosition({
        left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - tooltip.width / 2, viewportWidth - tooltip.width - 8)),
        top: Math.max(8, Math.min(above >= 8 ? above : anchor.bottom + 8, viewportHeight - tooltip.height - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, content]);

  return (
    <div ref={anchorRef} tabIndex={0} role="img" aria-label={label} aria-describedby={isOpen ? tooltipId : undefined}
      className={className} style={style} onMouseEnter={open} onMouseLeave={closeLater}
      onFocus={() => { focused.current = true; open(); }} onBlur={() => { focused.current = false; closeLater(); }}>
      {children}
      {isOpen ? createPortal(
        <div ref={tooltipRef} id={tooltipId} role="tooltip" onMouseEnter={cancelClose} onMouseLeave={closeLater}
          className="fixed z-[100] overflow-y-auto whitespace-normal break-words rounded-lg bg-slate-950 px-3 py-2 text-center text-xs leading-5 text-white shadow-xl"
          style={{ ...position, width: "min(18rem, calc(100vw - 1rem))", maxHeight: "calc(100dvh - 1rem)", overflowWrap: "anywhere" }}>
          {content}
        </div>, document.body,
      ) : null}
    </div>
  );
}
