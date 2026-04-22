import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Product, Vendor } from "@/lib/types";

export interface StorefrontFilters {
	page?: number;
	limit?: number;
	search?: string;
	category?: string;
	region?: string;
	area?: string;
	minPrice?: number;
	maxPrice?: number;
	sortBy?: "price_asc" | "price_desc" | "name_asc" | "name_desc";
}

export const storefrontService = {
    async getVendorBySubdomain(subdomain: string) {
        return apiClient.get<ApiResponse<Vendor>>(`/storefront/store/info`, {
            params: { t: Date.now() },
            headers: { "x-subdomain": subdomain },
        });
	},

	async getVendorProducts(subdomain: string, filters?: StorefrontFilters) {
        return apiClient.get<ApiResponse<Product[]>>(`/storefront/store/products`, {
            params: filters,
            headers: { "x-subdomain": subdomain },
        });
	},

	async getProduct(subdomain: string, productId: string) {
        return apiClient.get<ApiResponse<Product>>(
            `/storefront/store/products/${productId}`,
            { headers: { "x-subdomain": subdomain } }
        );
	},

	async getProducts(filters?: StorefrontFilters) {
		return apiClient.get<ApiResponse<Product[]>>("/storefront/products", {
			params: filters,
		});
	},

	async trackProductView(productId: string) {
		return apiClient.post<ApiResponse<{ counted: boolean }>>(
			`/products/${productId}/view`
		);
	},

	async getFeaturedProducts(limit = 12) {
		return apiClient.get<ApiResponse<Product[]>>("/storefront/products/featured", {
			params: { limit },
		});
	},

	async getNewArrivals(limit = 12) {
		return apiClient.get<ApiResponse<Product[]>>("/storefront/products/new", {
			params: { limit },
		});
	},

	async getStores(params?: { page?: number; limit?: number }) {
		return apiClient.get<ApiResponse<Vendor[]>>("/storefront/stores", { params });
	},
};
