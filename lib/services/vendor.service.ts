import { apiClient } from "@/lib/api-client";
import type { ApiResponse, Vendor, Product } from "@/lib/types";

export interface CreateProductData {
	name: string;
	description: string;
	price: number;
	stock: number;
	sku: string;
	categoryId: string;
	images?: string[];
}

export interface RegisterVendorData {
	firstName?: string;
	lastName?: string;
	email?: string;
	// password?: string;
	passwordHash?: string;
	passwordHashConfirmation?: string;
	phoneNumber?: string;
	whatsappNumber?: string;
	businessName?: string;
	address?: string;
	description?: string;
	businessType?: string;
	artisanCategory?: string;
	referralCode?: string;
	logoUrl?: string;
	profilePhotoUrl?: string;
	region?: string;
	area?: string;
	socialMedia?: {
		facebook?: string;
		instagram?: string;
		twitter?: string;
	};
}

interface VendorProfileData {
	vendor: Vendor;
	stats: {
		total: number;
		pending: number;
		approved: number;
		rejected: number;
	};
}

export interface UpdateProductData extends Partial<CreateProductData> {}

export const vendorService = {
	async getProfile() {
		return apiClient.get<ApiResponse<VendorProfileData>>("/vendors/me");
	},

	async updateProfile(data: Partial<Vendor>) {
		return apiClient.patch<ApiResponse<Vendor>>("/vendors/me", data);
	},

	async getProducts(params?: {
		page?: number;
		limit?: number;
		search?: string;
		status?: string;
	}) {
		return apiClient.get<ApiResponse<Product[]>>("/vendors/me/products", {
			params,
		});
	},

	async createProduct(data: CreateProductData) {
		return apiClient.post<ApiResponse<Product>>("/vendors/products", data);
	},

	async updateProduct(id: string, data: UpdateProductData) {
		return apiClient.put<ApiResponse<Product>>(
			`/vendors/me/products/${id}`,
			data
		);
	},

	async register(data: RegisterVendorData) {
		return apiClient.post<ApiResponse<Vendor>>("/vendors/register", data);
	},
	async registerInit(data: RegisterVendorData | FormData) {
		return apiClient.post<ApiResponse<Vendor>>("/vendors/register/init", data);
	},

	// async register(data: RegisterVendorData, logo?: File, photo?: File) {
	// 	const formData = new FormData();
	// 	formData.append("data", JSON.stringify(data));
	// 	if (logo) formData.append("logo", logo);
	// 	if (photo) formData.append("photo", photo);
	// 	return apiClient.post<ApiResponse<Vendor>>("/vendors/register", formData, {
	// 		headers: { "Content-Type": "multipart/form-data" },
	// 	});
	// },

	// export const vendorService = {
	// async registerInit(data: RegisterVendorData) {
	// 	// Send JSON only; backend will initialize payment and return authorization url
	// 	return apiClient.post("/vendors/register/init", {
	// 		firstName: data.firstName,
	// 		lastName: data.lastName,
	// 		email: data.email,
	// 		password: data.passwordHash,
	// 		businessName: data.businessName,
	// 		description: data.description,
	// 		phone: data.phoneNumber,
	// 		whatsapp: data.whatsappNumber,
	// 		businessType: data.businessType,
	// 		artisanCategory: data.artisanCategory,
	// 		referralCode: data.referralCode,
	// 		logoUrl: data.logoUrl,
	// 		profilePhotoUrl: data.profilePhotoUrl,
	// 		// photoUrl: data.profilePhotoUrl,
	// 		// logoUrl:
	// 		socials: {
	// 			facebook: data.socialMedia?.facebook,
	// 			instagram: data.socialMedia?.instagram,
	// 			x: data.socialMedia?.twitter,
	// 		},
	// 	});
	// },

	// async registerInit(data: FormData | RegisterVendorData) {
	// 	return apiClient.post("/vendors/register/init", data, {
	// 		headers: {
	// 			"Content-Type": "multipart/form-data",
	// 		},
	// 	});
	// },

	async deleteProduct(id: string) {
		return apiClient.delete<ApiResponse<null>>(`/vendors/me/products/${id}`);
	},

	async getStats() {
		return apiClient.get<
			ApiResponse<{
				totalProducts: number;
				approvedProducts: number;
				pendingProducts: number;
				rejectedProducts: number;
			}>
		>("/vendors/me/stats");
	},

	async getProductAnalytics() {
		return apiClient.get<ApiResponse<any>>("/products/analytics/mine");
	},

	async verifyPayment(reference: string) {
		return apiClient.get<ApiResponse<{ payment: any; vendor?: any }>>(
			`/payments/verify/${reference}`
		);
	},
};
