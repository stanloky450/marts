"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { validateMarketUserSession } from "@/lib/market-user";

export default function ProductGatewayPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const id = params.id as string;

  useEffect(() => {
    if (isLoading) return;

    const resolve = async () => {
      try {
        const marketUser = await validateMarketUserSession();
        const canViewDetails = isAuthenticated || !!marketUser;

        if (!canViewDetails) {
          router.replace(`/register?next=${encodeURIComponent(`/products/${id}`)}`);
          return;
        }

        const response = await apiClient.get<{ data?: { vendor?: { subdomain?: string } } }>(
          `/storefront/products/${id}`
        );
        const product = response.data?.data;
        const subdomain = product?.vendor?.subdomain;

        if (subdomain) {
          router.replace(`/store/${subdomain}/products/${id}`);
          return;
        }

        router.replace("/market");
      } catch (error) {
        console.error("Failed to resolve product detail route", error);
        router.replace("/market");
      }
    };

    void resolve();
  }, [id, isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
