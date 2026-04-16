export interface MarketUserRegistration {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  region: string;
  area: string;
  registeredAt: string;
}

export const MARKET_USER_REG_KEY = "marketUserRegistration";

export const readMarketUserRegistration = (): MarketUserRegistration | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_USER_REG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketUserRegistration;
    if (!parsed?.email || !parsed?.fullName) return null;
    if (!parsed?.id) {
      return {
        ...parsed,
        id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveMarketUserRegistration = (payload: MarketUserRegistration): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MARKET_USER_REG_KEY, JSON.stringify(payload));
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
