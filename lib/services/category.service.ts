import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Category } from "@/lib/types";

export interface CreateCategoryData {
	name: string;
	slug?: string;
	description?: string;
	parentId?: string;
	status?: "active" | "inactive";
}

export const categoryService = {
	async getAll(params?: {
		page?: number;
		limit?: number;
		search?: string;
		parentId?: string;
	}) {
		return apiClient.get<ApiResponse<Category[]>>("/categories", { params });
	},

	async getById(id: string) {
		return apiClient.get<ApiResponse<Category>>(`/categories/${id}`);
	},

	async create(data: CreateCategoryData) {
		return apiClient.post<ApiResponse<Category>>("/categories", data);
	},

	async update(id: string, data: Partial<CreateCategoryData>) {
		return apiClient.put<ApiResponse<Category>>(`/categories/${id}`, data);
	},

	async delete(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/categories/${id}`);
	},
};
