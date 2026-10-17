import { useEffect, useState } from "react";

export interface PageNavSection {
  id: string;
  label: string;
}

export interface PageNavProps {
  sections: PageNavSection[];
}

export function PageNav({ sections }: PageNavProps) {
  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? "");

  // Update activeId if sections change and current activeId is invalid
  useEffect(() => {
    if (sections.length > 0 && !sections.some((s) => s.id === activeId)) {
      setActiveId(sections[0].id);
    }
  }, [sections, activeId]);

  useEffect(() => {
    if (typeof window === "undefined" || sections.length === 0) {
      return;
    }

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top
          );
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));

    const handleScroll = () => {
      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60;
      if (isAtBottom && sections.length > 0) {
        setActiveId(sections[sections.length - 1].id);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [sections]);

  const handleNavClick = (id: string) => {
    setActiveId(id);
    const element = document.getElementById(id);
    if (element) {
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      if (!element.hasAttribute("tabindex")) {
        element.setAttribute("tabindex", "-1");
      }
      element.focus({ preventScroll: true });
    }
  };

  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="页面内容导航"
      className="sticky top-0 z-20 border-b border-[#e5dbce] bg-[#fffdf9]/95 backdrop-blur-sm shadow-xs transition-colors"
    >
      <div className="dashboard-container">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none sm:gap-2">
          {sections.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => handleNavClick(id)}
                className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a13f2d] focus-visible:ring-offset-1 sm:text-sm ${
                  isActive
                    ? "bg-[#29231f] text-white shadow-xs"
                    : "text-[#685d53] hover:bg-[#f2eade] hover:text-[#29231f]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
