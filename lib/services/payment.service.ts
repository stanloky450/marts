import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Admin, User, AdminAssignment } from "@/lib/types";

export interface Payment {
	id: string;
	amount: number;
	currency: string;
	status: PaymentStatus;
	method?: string;
	createdAt: string; // ISO
	metadata?: Record<string, string>;
	// extend with provider-specific fields as needed
}

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export const paymentService = {
	async getPayments(params?: {
		page?: number;
		limit?: number;
		status?: PaymentStatus;
	}) {
		return apiClient.get<ApiResponse<Payment[]>>("/webhooks/payments", {
			params,
		});
	},

	// async create(data: Payment) {
	// 	return apiClient.post<ApiResponse<Payment>>("/webhooks/payment", data);
	// },

	async create(vendorId: string) {
		// Send a minimal payload containing the vendor ID; backend expects this shape for creating a payment
		const payload = { vendorId };
		return apiClient.post<ApiResponse<any>>("/webhooks/payment", payload);
	},
};
