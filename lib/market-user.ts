export interface MarketUserProductSnapshot {
  id: string;
  name: string;
  description?: string;
  price?: number;
  discountPrice?: number;
  images: string[];
  category?: string;
  productType?: "product" | "service";
  vendorMongoId?: string;
  vendorName?: string;
  vendorSubdomain?: string;
  vendorPhone?: string;
  region?: string;
  area?: string;
  viewedAt?: string;
  bookmarkedAt?: string;
}

export interface MarketUserRegistration {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  region: string;
  area: string;
  selectedProductIds?: string[];
  selectedProductNames?: string[];
  registeredAt: string;
  lastActiveAt?: string;
}

export const MARKET_USER_REG_KEY = "marketUserRegistration";
export const MARKET_USER_HISTORY_KEY = "marketUserViewedProducts";
export const MARKET_USER_BOOKMARKS_KEY = "marketUserBookmarkedProducts";
export const MARKET_USER_EVENT = "market-user-updated";

const HISTORY_LIMIT = 40;
const BOOKMARK_LIMIT = 60;

function emitMarketUserUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MARKET_USER_EVENT));
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emitMarketUserUpdate();
}

function normalizeRegistration(payload: Partial<MarketUserRegistration>): MarketUserRegistration | null {
  if (!payload?.email || !payload?.fullName) return null;
  return {
    id: payload.id || `mu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fullName: payload.fullName,
    email: payload.email,
    phoneNumber: payload.phoneNumber || "",
    region: payload.region || "",
    area: payload.area || "",
    selectedProductIds: Array.isArray(payload.selectedProductIds) ? payload.selectedProductIds : [],
    selectedProductNames: Array.isArray(payload.selectedProductNames) ? payload.selectedProductNames : [],
    registeredAt: payload.registeredAt || new Date().toISOString(),
    lastActiveAt: payload.lastActiveAt || new Date().toISOString(),
  };
}

function dedupeProducts(items: MarketUserProductSnapshot[], limit: number) {
  const map = new Map<string, MarketUserProductSnapshot>();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, {
      ...map.get(item.id),
      ...item,
    });
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const aTime = new Date(a.bookmarkedAt || a.viewedAt || 0).getTime();
      const bTime = new Date(b.bookmarkedAt || b.viewedAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

export const readMarketUserRegistration = (): MarketUserRegistration | null => {
  const raw = safeRead<Partial<MarketUserRegistration> | null>(MARKET_USER_REG_KEY, null);
  return raw ? normalizeRegistration(raw) : null;
};

export const saveMarketUserRegistration = (payload: MarketUserRegistration): void => {
  const normalized = normalizeRegistration(payload);
  if (!normalized) return;
  safeWrite(MARKET_USER_REG_KEY, normalized);
};

export const updateMarketUserActivity = (): void => {
  const current = readMarketUserRegistration();
  if (!current) return;
  saveMarketUserRegistration({
    ...current,
    lastActiveAt: new Date().toISOString(),
  });
};

export const clearMarketUserSession = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MARKET_USER_REG_KEY);
  window.localStorage.removeItem(MARKET_USER_HISTORY_KEY);
  window.localStorage.removeItem(MARKET_USER_BOOKMARKS_KEY);
  emitMarketUserUpdate();
};

export const getMarketUserHeaders = (): Record<string, string> => {
  const marketUser = readMarketUserRegistration();
  if (!marketUser) return {};
  return {
    "x-market-user-id": marketUser.id,
    "x-market-user-name": marketUser.fullName,
    "x-market-user-email": marketUser.email,
  };
};

export const readViewedProducts = (): MarketUserProductSnapshot[] =>
  safeRead<MarketUserProductSnapshot[]>(MARKET_USER_HISTORY_KEY, []);

export const readBookmarkedProducts = (): MarketUserProductSnapshot[] =>
  safeRead<MarketUserProductSnapshot[]>(MARKET_USER_BOOKMARKS_KEY, []);

export const addViewedProduct = (product: MarketUserProductSnapshot): void => {
  if (!product?.id) return;
  const next = dedupeProducts(
    [{ ...product, viewedAt: new Date().toISOString() }, ...readViewedProducts()],
    HISTORY_LIMIT
  );
  safeWrite(MARKET_USER_HISTORY_KEY, next);
  updateMarketUserActivity();
};

export const isBookmarkedProduct = (productId: string): boolean =>
  readBookmarkedProducts().some((item) => item.id === productId);

export const toggleBookmarkedProduct = (product: MarketUserProductSnapshot): boolean => {
  const current = readBookmarkedProducts();
  const exists = current.some((item) => item.id === product.id);

  if (exists) {
    safeWrite(
      MARKET_USER_BOOKMARKS_KEY,
      current.filter((item) => item.id !== product.id)
    );
    return false;
  }

  const next = dedupeProducts(
    [{ ...product, bookmarkedAt: new Date().toISOString() }, ...current],
    BOOKMARK_LIMIT
  );
  safeWrite(MARKET_USER_BOOKMARKS_KEY, next);
  updateMarketUserActivity();
  return true;
};

export const removeBookmarkedProduct = (productId: string): void => {
  safeWrite(
    MARKET_USER_BOOKMARKS_KEY,
    readBookmarkedProducts().filter((item) => item.id !== productId)
  );
};
