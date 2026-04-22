"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  MARKET_USER_EVENT,
  clearMarketUserSession,
  readMarketUserRegistration,
} from "@/lib/market-user";
import { Button } from "@/components/ui/button";

interface MarketHeaderProps {
  current?: "market" | "discover" | "account";
}

export function MarketHeader({ current = "market" }: MarketHeaderProps) {
  const { user } = useAuth();
  const [marketUserName, setMarketUserName] = useState("");

  useEffect(() => {
    const sync = () => {
      const marketUser = readMarketUserRegistration();
      setMarketUserName(marketUser?.fullName || "");
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(MARKET_USER_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MARKET_USER_EVENT, sync);
    };
  }, []);

  const showUserNav = !!marketUserName;

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/market" className="flex items-center gap-2 text-xl font-black tracking-[0.24em] text-slate-900">
            <span className="rounded bg-slate-900 px-2 py-1 text-xs text-white">WK</span>
            WIKZON
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-500 md:flex">
            <Link href="/market" className={current === "market" ? "text-slate-950" : ""}>
              Market
            </Link>
            {showUserNav && (
              <Link href="/discover" className={current === "discover" ? "text-slate-950" : ""}>
                Discover
              </Link>
            )}
            {showUserNav && (
              <Link href="/account" className={current === "account" ? "text-slate-950" : ""}>
                Account
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {marketUserName ? (
            <>
              <span className="hidden text-sm text-slate-600 md:inline">
                {marketUserName}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearMarketUserSession()}
              >
                User Logout
              </Button>
            </>
          ) : (
            <Link href="/login?mode=user">
              <Button variant="outline" size="sm">
                User Login
              </Button>
            </Link>
          )}

          {user?.role === "vendor" ? (
            <Link href="/vendor">
              <Button size="sm">Vendor Dashboard</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                Vendor Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

