"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { storefrontService } from "@/lib/services/storefront.service";
import type { Product, Vendor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Store01Icon, PackageIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { StoreInteractions } from "@/components/store-interactions";
import {
  addViewedProduct,
  isBookmarkedProduct,
  readMarketUserRegistration,
  toggleBookmarkedProduct,
} from "@/lib/market-user";

const getServiceMeta = (product: Product) => {
  if (
    product.variants &&
    !Array.isArray(product.variants) &&
    typeof product.variants === "object" &&
    (product.variants as any).kind === "service"
  ) {
    return product.variants as any;
  }
  return null;
};

const isService = (product: Product) =>
  product.productType === "service" || !!getServiceMeta(product);

const toYouTubeEmbed = (raw?: string) => {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    return "";
  } catch {
    return "";
  }
};

const toVimeoEmbed = (raw?: string) => {
  if (!raw) return "";
  const match = raw.match(/vimeo\.com\/(\d+)/i);
  return match?.[1] ? `https://player.vimeo.com/video/${match[1]}` : "";
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params.subdomain as string;
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, vendorRes] = await Promise.all([
          storefrontService.getProduct(subdomain, productId),
          storefrontService.getVendorBySubdomain(subdomain),
        ]);

        const nextProduct = productRes.data.data;
        const nextVendor = vendorRes.data.data;

        setProduct(nextProduct);
        setVendor(nextVendor);
        setIsBookmarked(isBookmarkedProduct(nextProduct._id));

        if (readMarketUserRegistration()) {
          addViewedProduct({
            id: nextProduct._id,
            name: nextProduct.name,
            description: nextProduct.description,
            price: Number(nextProduct.price || 0),
            discountPrice: Number(nextProduct.discountPrice || 0),
            images: nextProduct.images || [],
            category:
              typeof nextProduct.category === "object"
                ? (nextProduct.category as any)?.name
                : String(nextProduct.category || ""),
            productType: nextProduct.productType,
            vendorMongoId: nextVendor.mongoId || nextVendor._id,
            vendorName: nextVendor.businessName,
            vendorSubdomain: nextVendor.subdomain,
            vendorPhone: nextVendor.phoneNumber || nextVendor.phone,
            region: nextVendor.address?.state || nextVendor.address?.city,
            area: nextVendor.address?.city,
          });
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
        toast.error("Failed to load product");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    storefrontService.trackProductView(productId).catch((err) => {
      console.error("Failed to track product view:", err);
    });
  }, [subdomain, productId]);

  const serviceMeta = useMemo(() => (product ? getServiceMeta(product) : null), [product]);
  const serviceMode = product ? isService(product) : false;
  const serviceVideoUrl = serviceMode
    ? (product?.videoUrl || serviceMeta?.videoUrl || "")?.trim()
    : "";
  const youtubeEmbed = toYouTubeEmbed(serviceVideoUrl);
  const vimeoEmbed = toVimeoEmbed(serviceVideoUrl);
  const rangeMin = Number(product?.priceMin ?? serviceMeta?.priceMin ?? product?.price ?? 0);
  const rangeMax = Number(product?.priceMax ?? serviceMeta?.priceMax ?? product?.price ?? 0);
  const displayPrice =
    serviceMode && Number.isFinite(rangeMin) && Number.isFinite(rangeMax)
      ? rangeMin === rangeMax
        ? `NGN ${rangeMin.toLocaleString()}`
        : `NGN ${rangeMin.toLocaleString()} - NGN ${rangeMax.toLocaleString()}`
      : `NGN ${Number(product?.price || 0).toLocaleString()}`;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!product || !vendor) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <HugeiconsIcon icon={PackageIcon} className="mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Listing Not Found</h1>
        <p className="text-muted-foreground">The item you are looking for does not exist.</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const toggleBookmark = () => {
    const active = toggleBookmarkedProduct({
      id: product._id,
      name: product.name,
      description: product.description,
      price: Number(product.price || 0),
      discountPrice: Number(product.discountPrice || 0),
      images: product.images || [],
      category:
        typeof product.category === "object"
          ? (product.category as any)?.name
          : String(product.category || ""),
      productType: product.productType,
      vendorMongoId: vendor.mongoId || vendor._id,
      vendorName: vendor.businessName,
      vendorSubdomain: vendor.subdomain,
      vendorPhone: vendor.phoneNumber || vendor.phone,
      region: vendor.address?.state || vendor.address?.city,
      area: vendor.address?.city,
    });
    setIsBookmarked(active);
    toast.success(active ? "Product saved to your account" : "Product removed from saved picks");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Store01Icon} className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">{vendor.businessName}</h1>
                <p className="text-sm text-muted-foreground">
                  {[vendor.address?.city, vendor.address?.country].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            <Link href={`/store/${subdomain}`}>
              <Button variant="outline">
                <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 h-4 w-4" />
                Back to Store
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
              <img
                src={product.images?.[0] || "/placeholder.svg?height=600&width=600&query=product"}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {product.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(1).map((img, index) => (
                  <img
                    key={`${img}-${index}`}
                    src={img}
                    alt={`${product.name} image ${index + 2}`}
                    className="h-20 w-full rounded-md object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  serviceMode
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {serviceMode ? "Service" : "Product"}
              </span>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            </div>

            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="text-4xl font-bold">{displayPrice}</span>
              {serviceMode ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {product.duration || serviceMeta?.duration || "Duration required"}
                </span>
              ) : (
                <span className={`text-sm ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
              )}
            </div>

            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-2 font-semibold">Description</h2>
                <p className="text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>

            {serviceMode && serviceVideoUrl && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="mb-3 font-semibold">Service Video</h2>
                  {youtubeEmbed || vimeoEmbed ? (
                    <div className="aspect-video overflow-hidden rounded-lg">
                      <iframe
                        src={youtubeEmbed || vimeoEmbed}
                        title={`${product.name} video`}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <video
                      src={serviceVideoUrl}
                      controls
                      className="aspect-video w-full rounded-lg bg-black"
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {serviceMode ? (
                <Button size="lg" className="w-full">
                  Request Service
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full" disabled={product.stock === 0}>
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full bg-transparent"
                    disabled={product.stock === 0}
                  >
                    Buy Now
                  </Button>
                </>
              )}
              {readMarketUserRegistration() && (
                <Button size="lg" variant="outline" className="w-full bg-transparent" onClick={toggleBookmark}>
                  {isBookmarked ? "Remove bookmark" : "Bookmark product"}
                </Button>
              )}
            </div>

            {!serviceMode && product.stock === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                This product is currently out of stock. Please check back later.
              </p>
            )}

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Vendor details</h2>
                    <p className="text-sm text-muted-foreground">
                      Chat is available below for logged-in marketplace users.
                    </p>
                  </div>
                  <Link href={`/store/${subdomain}`}>
                    <Button variant="outline">Visit store</Button>
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Business</p>
                    <p className="mt-2 font-semibold">{vendor.businessName}</p>
                    <p className="text-sm text-muted-foreground">{vendor.description || "No vendor description yet."}</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Reach vendor</p>
                    <p className="mt-2 text-sm">{vendor.phoneNumber || vendor.phone || "Phone unavailable"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[vendor.address?.city, vendor.address?.state, vendor.address?.country]
                        .filter(Boolean)
                        .join(", ") || "Location unavailable"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <StoreInteractions
              vendorMongoId={vendor.mongoId || vendor._id}
              productMongoId={product.mongoId || product._id}
            />
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t bg-muted/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 {vendor.businessName}. All rights reserved.</p>
          <p className="mt-2">Contact: {vendor.phoneNumber}</p>
        </div>
      </footer>
    </div>
  );
}


