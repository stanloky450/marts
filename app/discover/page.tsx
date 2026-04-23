"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight01Icon, Search01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MarketHeader } from "@/components/market-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import {
  MARKET_USER_EVENT,
  updateMarketUserActivity,
  validateMarketUserSession,
} from "@/lib/market-user";
import { storefrontService } from "@/lib/services/storefront.service";
import type { Product } from "@/lib/types";

const RESHUFFLE_WINDOW_MS = 10 * 60 * 1000;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function reshuffleProducts(items: Product[], seed: number) {
  return [...items].sort((left, right) => {
    const leftScore = hashString(`${left._id}:${seed}`);
    const rightScore = hashString(`${right._id}:${seed}`);
    return rightScore - leftScore;
  });
}

export default function DiscoverPage() {
  const router = useRouter();
  const [marketUserName, setMarketUserName] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const sync = () => {
      void (async () => {
        const marketUser = await validateMarketUserSession();
        if (!marketUser) {
          router.replace("/login?mode=user&next=/discover");
          return;
        }

        setMarketUserName(marketUser.fullName);
        setRegion(marketUser.region);
        setArea(marketUser.area);
        updateMarketUserActivity();
      })();
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(MARKET_USER_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MARKET_USER_EVENT, sync);
    };
  }, [router]);

  useEffect(() => {
    if (!region) return;

    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await storefrontService.getProducts({
          limit: 100,
          region,
          area,
          search: search.trim() || undefined,
        });
        if (!active) return;
        setProducts(response.data.data || []);
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        console.error("Failed to load discover products", error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    const refreshTimer = window.setInterval(() => {
      setTick(Date.now());
      void load();
    }, RESHUFFLE_WINDOW_MS);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [region, area, search]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const shuffleSeed = Math.floor(tick / RESHUFFLE_WINDOW_MS);
  const visibleProducts = useMemo(
    () => reshuffleProducts(products, shuffleSeed),
    [products, shuffleSeed]
  );

  const minutesToRefresh = Math.max(
    1,
    Math.ceil((RESHUFFLE_WINDOW_MS - (tick % RESHUFFLE_WINDOW_MS)) / 60000)
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e7_0%,#fffdf8_34%,#ffffff_100%)]">
      <MarketHeader current="discover" />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-amber-200 bg-[radial-gradient(circle_at_top_left,#fff3cd,transparent_42%),linear-gradient(135deg,#1f2937,#7c2d12)] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <Badge className="bg-white/12 text-white hover:bg-white/12">Discover Feed</Badge>
              <h1 className="max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
                Fresh local finds for {marketUserName || "your area"}.
              </h1>
              <p className="max-w-2xl text-sm text-amber-50/90 md:text-base">
                This feed pulls approved listings for your location and reshuffles every 10 minutes so the mix stays fresh without hiding local vendors.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-100">
                <HugeiconsIcon icon={Store01Icon} className="h-4 w-4" />
                {area}, {region}
              </div>
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products, services, or vendors"
                  className="border-white/10 bg-white pl-10 text-slate-950"
                />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">Auto reshuffle</p>
                  <p className="text-amber-50/80">Next shuffle in {minutesToRefresh} min</p>
                </div>
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-amber-200" />
              </div>
              {lastLoadedAt && (
                <p className="mt-3 text-xs text-amber-50/70">
                  Last synced {new Date(lastLoadedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Your local shuffle</h2>
              <p className="text-sm text-slate-500">
                {visibleProducts.length} listings matched to {region}
              </p>
            </div>
            <Link href="/account">
              <Button variant="outline" className="gap-2">
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                View saved picks
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Spinner className="h-8 w-8 text-slate-900" />
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-xl font-bold text-slate-900">No products in this location yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Try another keyword later or update the user location from your account page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
