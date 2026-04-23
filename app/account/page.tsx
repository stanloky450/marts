"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarketHeader } from "@/components/market-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MARKET_USER_EVENT,
  type MarketUserProductSnapshot,
  readBookmarkedProducts,
  readViewedProducts,
  removeBookmarkedProduct,
  updateMarketUserActivity,
  validateMarketUserSession,
} from "@/lib/market-user";

function ProductList({
  products,
  emptyText,
  action,
}: {
  products: MarketUserProductSnapshot[];
  emptyText: string;
  action?: (productId: string) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {products.map((product) => (
        <div key={`${product.id}-${product.bookmarkedAt || product.viewedAt || ""}`} className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img
              src={product.images?.[0] || "/placeholder.svg"}
              alt={product.name}
              className="h-20 w-20 rounded-2xl object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="text-sm text-slate-500">{product.vendorName || "Marketplace vendor"}</p>
              <p className="mt-1 text-xs text-slate-400">
                {product.area && product.region ? `${product.area}, ${product.region}` : product.region || "Location pending"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/products/${product.id}`}>
              <Button variant="outline">Open</Button>
            </Link>
            {action && (
              <Button variant="ghost" onClick={() => action(product.id)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [viewedProducts, setViewedProducts] = useState<MarketUserProductSnapshot[]>([]);
  const [bookmarkedProducts, setBookmarkedProducts] = useState<MarketUserProductSnapshot[]>([]);

  useEffect(() => {
    const sync = () => {
      void (async () => {
        const marketUser = await validateMarketUserSession();
        if (!marketUser) {
          router.replace("/login?mode=user&next=/account");
          return;
        }

        setUserName(marketUser.fullName);
        setEmail(marketUser.email);
        setPhoneNumber(marketUser.phoneNumber);
        setRegion(marketUser.region);
        setArea(marketUser.area);
        setSelectedProducts(marketUser.selectedProductNames || []);
        setViewedProducts(readViewedProducts());
        setBookmarkedProducts(readBookmarkedProducts());
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

  const stats = useMemo(
    () => [
      { label: "Viewed", value: viewedProducts.length },
      { label: "Bookmarked", value: bookmarkedProducts.length },
      { label: "Picked at registration", value: selectedProducts.length },
    ],
    [bookmarkedProducts.length, selectedProducts.length, viewedProducts.length]
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <MarketHeader current="account" />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.4fr]">
          <Card className="rounded-[1.75rem] border-0 bg-slate-900 text-white shadow-[0_24px_90px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <Badge className="w-fit bg-white/10 text-white hover:bg-white/10">User Account</Badge>
              <CardTitle className="text-3xl font-black">{userName}</CardTitle>
              <p className="text-sm text-slate-300">
                Your marketplace account keeps your location, viewed products, and bookmarked products in sync on this device.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Contact</p>
                <p className="mt-2 text-sm">{email}</p>
                <p className="text-sm text-slate-300">{phoneNumber}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Location</p>
                <p className="mt-2 text-lg font-semibold">{area}, {region}</p>
                <p className="text-sm text-slate-300">
                  Discover only shows vendors and products mapped to this location.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white/10 p-4">
                    <p className="text-2xl font-black">{item.value}</p>
                    <p className="text-xs text-slate-300">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link href="/discover">
                  <Button variant="secondary">Back to discover</Button>
                </Link>
                <Link href="/register/user">
                  <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
                    Update user details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle>Location picks from registration</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedProducts.length > 0 ? (
                  selectedProducts.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No products were selected during registration.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle>Bookmarked products</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductList
                  products={bookmarkedProducts}
                  emptyText="No bookmarked products yet. Save a product from its detail page."
                  action={removeBookmarkedProduct}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem]">
              <CardHeader>
                <CardTitle>Viewed products</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductList
                  products={viewedProducts}
                  emptyText="Your viewed products will appear here after you open product details."
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
