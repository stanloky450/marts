import { marketUserService } from "@/lib/services/market-user.service";

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
  status?: "active" | "suspended";
  selectedProductIds?: string[];
  selectedProductNames?: string[];
  registeredAt: string;
  lastActiveAt?: string;
}

interface MarketUserAccount extends MarketUserRegistration {}

export const MARKET_USER_REG_KEY = "marketUserRegistration";
export const MARKET_USER_SESSION_KEY = "marketUserSession";
export const MARKET_USER_ACCOUNTS_KEY = "marketUserAccounts";
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
    status: payload.status === "suspended" ? "suspended" : "active",
    selectedProductIds: Array.isArray(payload.selectedProductIds) ? payload.selectedProductIds : [],
    selectedProductNames: Array.isArray(payload.selectedProductNames) ? payload.selectedProductNames : [],
    registeredAt: payload.registeredAt || new Date().toISOString(),
    lastActiveAt: payload.lastActiveAt || new Date().toISOString(),
  };
}

function readAccounts(): MarketUserAccount[] {
  return safeRead<Partial<MarketUserAccount>[]>(MARKET_USER_ACCOUNTS_KEY, [])
    .map((item) => normalizeRegistration(item))
    .filter((item): item is MarketUserAccount => !!item);
}

function writeAccounts(accounts: MarketUserAccount[]) {
  safeWrite(MARKET_USER_ACCOUNTS_KEY, accounts);
}

function upsertAccount(payload: MarketUserRegistration) {
  const normalized = normalizeRegistration(payload);
  if (!normalized) return;

  const nextAccounts = readAccounts();
  const existingIndex = nextAccounts.findIndex(
    (item) => item.email.trim().toLowerCase() === normalized.email.trim().toLowerCase()
  );

  if (existingIndex >= 0) {
    nextAccounts[existingIndex] = {
      ...nextAccounts[existingIndex],
      ...normalized,
    };
  } else {
    nextAccounts.unshift(normalized);
  }

  writeAccounts(nextAccounts);
}

function writeSession(payload: MarketUserRegistration) {
  const normalized = normalizeRegistration(payload);
  if (!normalized) return;
  safeWrite(MARKET_USER_SESSION_KEY, normalized);
  safeWrite(MARKET_USER_REG_KEY, normalized);
}

function migrateLegacyRegistration() {
  const legacy = safeRead<Partial<MarketUserRegistration> | null>(MARKET_USER_REG_KEY, null);
  const normalized = legacy ? normalizeRegistration(legacy) : null;
  if (!normalized) return null;

  upsertAccount(normalized);
  if (!safeRead<Partial<MarketUserRegistration> | null>(MARKET_USER_SESSION_KEY, null)) {
    safeWrite(MARKET_USER_SESSION_KEY, normalized);
  }
  return normalized;
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
  const session = safeRead<Partial<MarketUserRegistration> | null>(MARKET_USER_SESSION_KEY, null);
  const normalizedSession = session ? normalizeRegistration(session) : null;
  if (normalizedSession) return normalizedSession;
  return migrateLegacyRegistration();
};

export const saveMarketUserRegistration = (payload: MarketUserRegistration): void => {
  const normalized = normalizeRegistration(payload);
  if (!normalized) return;
  upsertAccount(normalized);
  writeSession(normalized);
};

export const loginMarketUser = (
  email: string,
  phoneNumber: string
): MarketUserRegistration | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phoneNumber.trim();
  if (!normalizedEmail || !normalizedPhone) return null;

  const account = readAccounts().find(
    (item) =>
      item.email.trim().toLowerCase() === normalizedEmail &&
      item.phoneNumber.trim() === normalizedPhone
  );

  if (!account) return null;

  const nextSession = {
    ...account,
    lastActiveAt: new Date().toISOString(),
  };
  writeSession(nextSession);
  return nextSession;
};

export const validateMarketUserSession = async (): Promise<MarketUserRegistration | null> => {
  const current = readMarketUserRegistration();
  if (!current) return null;

  try {
    const response = await marketUserService.validateSession({
      id: current.id,
      email: current.email,
    });
    const marketUser = response.data.data;
    const nextSession = {
      ...current,
      id: marketUser._id,
      fullName: marketUser.fullName,
      email: marketUser.email,
      phoneNumber: marketUser.phoneNumber,
      region: marketUser.region,
      area: marketUser.area,
      status: marketUser.status,
      selectedProductIds: marketUser.selectedProductIds || current.selectedProductIds || [],
      selectedProductNames: marketUser.selectedProductNames || current.selectedProductNames || [],
      lastActiveAt: new Date().toISOString(),
    };
    saveMarketUserRegistration(nextSession);
    return nextSession;
  } catch (error: any) {
    try {
      const fallback = await marketUserService.register({
        fullName: current.fullName,
        email: current.email,
        phoneNumber: current.phoneNumber,
        region: current.region,
        area: current.area,
        selectedProductIds: current.selectedProductIds || [],
        selectedProductNames: current.selectedProductNames || [],
      });
      const marketUser = fallback.data.data;
      const migratedSession = {
        ...current,
        id: marketUser._id,
        status: marketUser.status,
        registeredAt: marketUser.createdAt,
        lastActiveAt: new Date().toISOString(),
      };
      saveMarketUserRegistration(migratedSession);
      return migratedSession;
    } catch {
      clearMarketUserSession();
      return null;
    }
  }
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
  window.localStorage.removeItem(MARKET_USER_SESSION_KEY);
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
