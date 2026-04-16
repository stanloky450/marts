import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Product } from "@/lib/types";
import { create } from "domain";

export interface ProductFilters {
	page?: number;
	limit?: number;
	search?: string;
	category?: string;
	status?: string;
	vendorId?: string;
	minPrice?: number;
	maxPrice?: number;
}

export const productService = {
	async getAll(params?: ProductFilters) {
		return apiClient.get<ApiResponse<Product[]>>("/products", { params });
	},

	async update(id: string, data: Partial<Product>) {
		return apiClient.patch<ApiResponse<Product>>(`/products/${id}`, data);
	},

	async getById(id: string) {
		return apiClient.get<ApiResponse<Product>>(`/products/${id}`);
	},

	async approve(id: string) {
		return apiClient.patch<ApiResponse<Product>>(`/products/${id}/approve`);
	},

	async reject(id: string, reason: string) {
		return apiClient.patch<ApiResponse<Product>>(`/products/${id}/reject`, {
			rejectionNote: reason,
		});
	},

	async suspend(id: string, reason: string) {
		return apiClient.patch<ApiResponse<Product>>(`/products/${id}/suspend`, {
			reason,
		});
	},

	async delete(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/products/${id}`);
	},

	async create(data: Partial<Product>) {
		return apiClient.post<ApiResponse<Product>>("/products", data);
	},
};
