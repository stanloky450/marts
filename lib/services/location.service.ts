import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/types";

export interface Location {
	_id: string;
	region: string;
	areas: string[];
	registrationFee: number;
	isActive: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface NigeriaCatalogRegion {
	state: string;
	localGovernments: string[];
	localGovernmentCount: number;
}

export interface LocationPayload extends Partial<Location> {
	source?: "nigeria_catalog" | "custom";
	state?: string;
}

export const locationService = {
	async getLocations(params?: { activeOnly?: boolean }) {
		return apiClient.get<ApiResponse<Location[]>>("/locations", { params });
	},

	async getNigeriaCatalog() {
		return apiClient.get<ApiResponse<NigeriaCatalogRegion[]>>(
			"/locations/catalog/nigeria"
		);
	},

	async createLocation(data: LocationPayload) {
		return apiClient.post<ApiResponse<Location>>("/locations", data);
	},

	async updateLocation(id: string, data: LocationPayload) {
		return apiClient.patch<ApiResponse<Location>>(`/locations/${id}`, data);
	},

	async deleteLocation(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/locations/${id}`);
	},
};
