import { apiClient } from "@/lib/api-client";
import type { ApiResponse, MarketUser } from "@/lib/types";

export interface MarketUserRegistrationPayload {
	fullName: string;
	email: string;
	phoneNumber: string;
	region: string;
	area: string;
	selectedProductIds?: string[];
	selectedProductNames?: string[];
}

export interface MarketUserLoginPayload {
	email: string;
	phoneNumber: string;
}

export const marketUserService = {
	async register(data: MarketUserRegistrationPayload) {
		return apiClient.post<ApiResponse<MarketUser>>("/market-users/register", data);
	},

	async login(data: MarketUserLoginPayload) {
		return apiClient.post<ApiResponse<MarketUser>>("/market-users/login", data);
	},

	async validateSession(data: { id: string; email: string }) {
		return apiClient.post<ApiResponse<MarketUser>>("/market-users/session/validate", data);
	},

	async getAll(params?: {
		page?: number;
		limit?: number;
		search?: string;
		status?: "active" | "suspended";
		region?: string;
	}) {
		return apiClient.get<ApiResponse<MarketUser[]>>("/market-users", { params });
	},

	async updateStatus(id: string, status: "active" | "suspended") {
		return apiClient.patch<ApiResponse<MarketUser>>(`/market-users/${id}/status`, { status });
	},
};
