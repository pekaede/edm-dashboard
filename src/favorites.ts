const FAVORITES_STORAGE_KEY = "edm-favorites-v1";
const FAVORITES_EVENT = "edm-favorites-changed";

function dispatchFavoritesChange(): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
    } catch {
      // Ignore in environments lacking CustomEvent
    }
  }
}

function readFavoritesOrThrow(): string[] {
  if (typeof window === "undefined") {
    throw new Error("Favorites storage is unavailable");
  }
  const storage = window.localStorage;
  if (!storage) {
    throw new Error("Favorites storage is unavailable");
  }
  const raw = storage.getItem(FAVORITES_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === "string");
  }
  return [];
}

/**
 * Loads favorite email keys from localStorage.
 * Returns an empty array if unavailable or parsing fails.
 */
export function loadFavorites(): string[] {
  try {
    return readFavoritesOrThrow();
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const storage = window.localStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    dispatchFavoritesChange();
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether the given email key is in favorites.
 */
export function isFavorite(key: string): boolean {
  try {
    if (!key) return false;
    return loadFavorites().includes(key);
  } catch {
    return false;
  }
}

/**
 * Adds an email key to favorites if not already present.
 */
export function addFavorite(key: string): void {
  try {
    if (!key) return;
    const favorites = loadFavorites();
    if (!favorites.includes(key)) {
      favorites.push(key);
      saveFavorites(favorites);
    }
  } catch {
    // Fail silently when storage access fails
  }
}

/**
 * Removes an email key from favorites.
 */
export function removeFavorite(key: string): void {
  try {
    if (!key) return;
    const favorites = loadFavorites();
    const next = favorites.filter((k) => k !== key);
    if (next.length !== favorites.length) {
      saveFavorites(next);
    }
  } catch {
    // Fail silently when storage access fails
  }
}

/**
 * Toggles favorite state of an email key. Returns whether the write succeeded.
 */
export function toggleFavorite(key: string): boolean {
  try {
    if (!key) return false;
    const favorites = readFavoritesOrThrow();
    const index = favorites.indexOf(key);
    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.push(key);
    }
    return saveFavorites(favorites);
  } catch {
    return false;
  }
}

/**
 * Formats standard email favorite key: market|brand|sent_date|source_index|day_seq
 */
export function createFavoriteKey(params: {
  market: string;
  brand: string;
  sent_date: string;
  source_index: number | string;
  day_seq: number | string;
}): string {
  return `${params.market}|${params.brand}|${params.sent_date}|${params.source_index}|${params.day_seq}`;
}

/**
 * Subscribes to favorite changes (local and cross-tab storage events).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeFavorites(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  const storageHandler = (event: StorageEvent) => {
    if (event.key === FAVORITES_STORAGE_KEY || event.key === null) {
      callback();
    }
  };
  window.addEventListener(FAVORITES_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
