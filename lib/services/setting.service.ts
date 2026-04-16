import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/types";

export const settingService = {
	async getAllSettings() {
		return apiClient.get<ApiResponse<Record<string, any>>>("/settings");
	},

	async getPublicSettings() {
		return apiClient.get<ApiResponse<Record<string, any>>>("/settings/public");
	},

	async updateSettings(payload: Record<string, any>) {
		return apiClient.patch<ApiResponse<{ message: string }>>("/settings", payload);
	},

	async getRssProxy(url: string) {
		return apiClient.get<ApiResponse<any>>("/settings/rss-proxy", { params: { url } });
	},
};
