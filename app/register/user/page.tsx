"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { locationService, type Location, type NigeriaCatalogRegion } from "@/lib/services/location.service";
import { storefrontService } from "@/lib/services/storefront.service";
import { saveMarketUserRegistration } from "@/lib/market-user";
import type { Product } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Identity", description: "Tell us who you are" },
  { id: 2, title: "Location", description: "Choose your state and area" },
  { id: 3, title: "Available Picks", description: "See products in your location" },
];

export default function RegisterUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const encodedNext = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [catalog, setCatalog] = useState<NigeriaCatalogRegion[]>([]);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    region: "",
    area: "",
  });

  const selectedLocation = useMemo(
    () => locations.find((item) => item.region === form.region),
    [form.region, locations]
  );

  const areas = useMemo(() => {
    if (selectedLocation?.areas?.length) return selectedLocation.areas;
    const fallback = catalog.find((item) => item.state === form.region);
    return fallback?.localGovernments || [];
  }, [catalog, form.region, selectedLocation]);

  useEffect(() => {
    const load = async () => {
      try {
        const [locationResponse, catalogResponse] = await Promise.all([
          locationService.getLocations({ activeOnly: true }),
          locationService.getNigeriaCatalog(),
        ]);

        setLocations(locationResponse.data.data || []);
        setCatalog(catalogResponse.data.data || []);
      } catch (error) {
        console.error("Failed to load registration data", error);
        toast.error("Failed to load locations");
      } finally {
        setLocationsLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (step !== 3 || !form.region) return;

    let active = true;
    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const response = await storefrontService.getProducts({
          limit: 24,
          region: form.region,
          area: form.area || undefined,
        });
        if (!active) return;
        setPreviewProducts(response.data.data || []);
      } catch (error) {
        console.error("Failed to load preview products", error);
        toast.error("Failed to load products for this location");
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      active = false;
    };
  }, [form.area, form.region, step]);

  const availableRegions = useMemo(() => {
    if (locations.length > 0) return locations.map((item) => item.region);
    return catalog.map((item) => item.state);
  }, [catalog, locations]);

  const canContinue = useMemo(() => {
    if (step === 1) {
      return !!form.fullName && !!form.email && !!form.phoneNumber;
    }
    if (step === 2) {
      return !!form.region && !!form.area;
    }
    return true;
  }, [form, step]);

  const submit = async () => {
    if (!form.fullName || !form.email || !form.phoneNumber || !form.region || !form.area) {
      toast.error("Please complete the registration form");
      return;
    }

    setIsSaving(true);
    try {
      const selectedProducts = previewProducts.filter((product) =>
        selectedProductIds.includes(product._id)
      );

      saveMarketUserRegistration({
        id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        ...form,
        selectedProductIds,
        selectedProductNames: selectedProducts.map((product) => product.name),
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      toast.success("User registration completed");
      router.push(nextPath || "/discover");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((item) => item !== productId)
        : [...current, productId]
    );
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f1e7_0%,#ffffff_55%)] p-4 py-10">
      <div className="mx-auto max-w-5xl">
        <Card className="overflow-hidden border-0 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
          <div className="grid lg:grid-cols-[0.9fr_1.3fr]">
            <div className="bg-slate-900 p-8 text-white">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300">User Registration</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight">Create the marketplace account users actually need.</h1>
              <p className="mt-4 text-sm text-slate-300">
                This registration is separate from vendor onboarding. It collects your location first, then unlocks the products and vendors available in that location.
              </p>
              <div className="mt-8 space-y-3">
                {STEPS.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      step === item.id ? "border-amber-300 bg-white/10" : "border-white/10"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {item.id}. {item.title}
                    </p>
                    <p className="text-xs text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <CardContent className="p-8">
              {step === 1 && (
                <div className="space-y-4">
                  <CardHeader className="px-0">
                    <CardTitle className="text-2xl">Basic details</CardTitle>
                    <CardDescription>These details identify your user account on this device.</CardDescription>
                  </CardHeader>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone number</Label>
                    <Input
                      id="phoneNumber"
                      value={form.phoneNumber}
                      onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                      placeholder="+234..."
                      required
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <CardHeader className="px-0">
                    <CardTitle className="text-2xl">Location access</CardTitle>
                    <CardDescription>
                      Your location decides the vendors and products that appear in discover.
                    </CardDescription>
                  </CardHeader>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select
                      value={form.region}
                      onValueChange={(value) => setForm((current) => ({ ...current, region: value, area: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={locationsLoading ? "Loading states..." : "Select state"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRegions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select
                      value={form.area}
                      onValueChange={(value) => setForm((current) => ({ ...current, area: value }))}
                      disabled={!form.region}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!form.region ? "Select state first" : "Select location"} />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <CardHeader className="px-0">
                    <CardTitle className="text-2xl">Products available in {form.area}</CardTitle>
                    <CardDescription>
                      Pick any products you want quick access to on your account page.
                    </CardDescription>
                  </CardHeader>
                  {previewLoading ? (
                    <div className="flex min-h-[240px] items-center justify-center">
                      <Spinner className="h-8 w-8" />
                    </div>
                  ) : previewProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                      No approved products are available for this location yet. You can still finish registration and come back later.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {previewProducts.map((product) => {
                        const active = selectedProductIds.includes(product._id);
                        return (
                          <button
                            key={product._id}
                            type="button"
                            onClick={() => toggleProduct(product._id)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white hover:border-slate-400"
                            }`}
                          >
                            <p className="font-semibold">{product.name}</p>
                            <p className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                              {(product as any)?.vendor?.businessName || "Marketplace vendor"}
                            </p>
                            <p className={`mt-2 text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>
                              {(product.description || "").slice(0, 90)}
                            </p>
                            <Badge className="mt-3" variant={active ? "secondary" : "outline"}>
                              {active ? "Selected" : "Select"}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button variant="outline">Back</Button>
                </Link>
                <Link href={`/login?mode=user${encodedNext}`}>
                  <Button variant="ghost">Already registered? Login</Button>
                </Link>
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
                    Previous
                  </Button>
                )}
                {step < STEPS.length ? (
                  <Button disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
                    Next
                  </Button>
                ) : (
                  <Button disabled={isSaving} onClick={submit}>
                    {isSaving ? "Saving..." : "Complete Registration"}
                  </Button>
                )}
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
