import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Admin, User, AdminAssignment } from "@/lib/types";

export interface CreateAdminData {
	email: string;
	password: string;
	region?: string;
	notes?: string;
	firstName: string;
	lastName: string;
	// Assignment mode
	assignmentMode?: "location" | "vendor" | "referral" | "none";
	locationRegion?: string;
	vendorIds?: string[];
	referralCode?: string;
}

export interface UpdateAdminData {
	region?: string;
	notes?: string;
	isActive?: boolean;
}

export interface AssignVendorData {
	vendorId: string;
	region?: string;
	notes?: string;
}

export interface DashboardStats {
	totals: {
		products: number;
		vendors: number;
		admins: number;
		revenue: number;
		views: number;
	};
	recent: {
		products: number;
		vendors: number;
		revenue: number;
	};
	chartData: {
		date: string;
		revenue: number;
	}[];
}

export const adminService = {
	async getAll(params?: { page?: number; limit?: number; search?: string }) {
		return apiClient.get<ApiResponse<{ admins: Admin[]; users: User[] }>>(
			"/admins/list",
			{ params }
		);
	},

	async getById(id: string) {
		return apiClient.get<ApiResponse<{ admin: Admin; user: User }>>(
			`/admins/${id}`
		);
	},

	async create(data: CreateAdminData) {
		return apiClient.post<ApiResponse<{ admin: Admin; user: User }>>(
			"/admins",
			data
		);
	},

	async update(id: string, data: UpdateAdminData) {
		return apiClient.patch<ApiResponse<{ admin: Admin }>>(
			`/admins/${id}`,
			data
		);
	},

	async delete(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/admins/${id}`);
	},

	async assignVendor(adminId: string, data: AssignVendorData) {
		return apiClient.post<ApiResponse<{ assignment: AdminAssignment }>>(
			`/admins/${adminId}/assign`,
			data
		);
	},

	async getAssignments(adminId: string) {
		return apiClient.get<ApiResponse<{ assignments: AdminAssignment[] }>>(
			`/admins/${adminId}/assignments`
		);
	},

	async removeAssignment(assignmentId: string) {
		return apiClient.delete<ApiResponse<null>>(
			`/admins/assignments/${assignmentId}`
		);
	},

	async getStats() {
		return apiClient.get<ApiResponse<DashboardStats>>("/admins/stats");
	},

	async getProductAnalytics(params?: { vendorId?: string; sort?: string; limit?: number }) {
		return apiClient.get<ApiResponse<any>>("/admins/products/analytics", { params });
	},
};
