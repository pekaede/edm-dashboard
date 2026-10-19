const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim();
const viewPaths = new Map([
  ["dashboard", "/dashboard"],
  ["report", "/report"],
  ["emails", "/emails"],
]);

declare global {
  interface Window {
    umami?: {
      track: (payload: { website: string; url: string }) => unknown;
    };
  }
}

let initialization: Promise<boolean> | null = null;
let scriptReady = false;
let retryAfter = 0;

export function initAnalytics(): Promise<boolean> {
  if (!websiteId || typeof window === "undefined") {
    return Promise.resolve(false);
  }
  if (initialization) return initialization;
  if (typeof window.umami?.track === "function") {
    scriptReady = true;
    initialization = Promise.resolve(true);
    return initialization;
  }
  if (Date.now() < retryAfter) return Promise.resolve(false);

  initialization = new Promise<boolean>((resolve) => {
    try {
      const script = document.createElement("script");
      script.src = "https://cloud.umami.is/script.js";
      script.async = true;
      script.dataset.websiteId = websiteId;
      script.dataset.autoTrack = "false";
      script.dataset.doNotTrack = "true";
      script.onload = () => {
        scriptReady = typeof window.umami?.track === "function";
        resolve(scriptReady);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } catch {
      resolve(false);
    }
  }).then((ready) => {
    if (!ready) {
      initialization = null;
      retryAfter = Date.now() + 5_000;
    }
    return ready;
  });

  return initialization;
}

export function trackView(view: string): void {
  if (!websiteId || typeof window === "undefined") return;
  const path = viewPaths.get(view);
  if (!path) return;

  try {
    if (!scriptReady) void initAnalytics();
    if (!scriptReady || typeof window.umami?.track !== "function") return;
    void Promise.resolve(
      window.umami.track({ website: websiteId, url: path }),
    ).catch(() => {});
  } catch {}
}
