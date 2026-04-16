import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Referral } from "@/lib/types";

export interface ReferralWithVendors {
	_id: string;
	code: string;
	discountPercent: number;
	maxUses?: number;
	usedCount?: number;
	status?: string;
	expiresAt?: string;
	lastUsedAt?: string;
	description?: string;
	vendors: Array<{
		id: string;
		businessName: string;
		subdomain?: string;
		status: string;
		ownerEmail: string;
		registeredAt: string;
	}>;
}

// export const referralService = {
//     async getByCode(code: string) {
//         return apiClient.get<ApiResponse<ReferralWithVendors>>(`/referrals/code/${code}`);
//     },
// };

// import { apiClient } from "@/lib/api-client";
// import type { ApiResponse, Referral } from "@/lib/types";

export interface CreateReferralData {
	code?: string;
	discountPercent: number;
	maxUses?: number;
	expiresAt?: string;
	description?: string;
}

export const referralService = {
	async getAll(params?: {
		page?: number;
		limit?: number;
		search?: string;
		isActive?: boolean;
	}) {
		return apiClient.get<ApiResponse<Referral[]>>("/referrals", { params });
	},

	async getById(id: string) {
		return apiClient.get<ApiResponse<Referral>>(`/referrals/${id}`);
	},
	async validate(id: string) {
		const safe = encodeURIComponent((id || "").toString());
		return apiClient.get<ApiResponse<Referral>>(`/referrals/validate/${safe}`);
	},

	async create(data: CreateReferralData) {
		return apiClient.post<ApiResponse<Referral>>("/referrals/generate", data);
	},

	async update(
		id: string,
		data: Partial<CreateReferralData> & { isActive?: boolean }
	) {
		return apiClient.patch<ApiResponse<Referral>>(`/referrals/${id}`, data);
	},

	async delete(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/referrals/${id}`);
	},

		async getStats(id: string) {
		return apiClient.get<
			ApiResponse<{
				code: string;
				discountPercent: number;
				usedCount: number;
				maxUses?: number | null;
				status: "active" | "inactive";
				expiresAt?: string;
				lastUsedAt?: string;
				vendors: Array<{
					id: string;
					businessName: string;
					subdomain?: string;
					status: string;
					ownerEmail?: string;
					registeredAt: string;
				}>;
			}>
		>(`/referrals/${id}/stats`);
	},
};

