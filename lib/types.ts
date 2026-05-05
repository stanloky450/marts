export interface User {
	_id: string;
	email: string;
	role: "super_admin" | "admin" | "vendor";
	isActive: boolean;
	profile?: {
		firstName?: string;
		lastName?: string;
		phone?: string;
		region?: string;
		notes?: string;
	};
	createdAt: string;
	updatedAt: string;
}

export interface MarketUser {
	_id: string;
	fullName: string;
	email: string;
	phoneNumber: string;
	region: string;
	area: string;
	status: "active" | "suspended";
	selectedProductIds?: string[];
	selectedProductNames?: string[];
	lastLoginAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Vendor {
	_id: string;
	mongoId?: string;
	userId: string;
	businessName: string;
	businessLogo?: string;
	profilePhoto?: string;
	description?: string;
	phoneNumber: string;
	phone?: string;
	whatsappNumber?: string;
	owner?: {
		profile?: {
			firstName?: string;
			lastName?: string;
		};
	};
	socialMedia?: {
		facebook?: string;
		instagram?: string;
		twitter?: string;
	};
	socials?: {
		facebook?: string;
		instagram?: string;
		x?: string;
		twitter?: string;
	};
	address?: {
		city?: string;
		state?: string;
		country?: string;
	};
	locationRegion?: string;
	locationArea?: string;
	logoUrl?: string;
	subdomain?: string;
	bannerImage?: string;
	themeColor?:
		| "black"
		| "deep_blue"
		| "green"
		| "purple_blue"
		| "hot_coral"
		| "electric_violet"
		| "fuchsia_pop"
		| "terracotta_glam"
		| "midnight_berry"
		| "blush_rose"
		| "lavender_mist"
		| "sage_and_cream"
		| "hot_flamingo"
		| "cherry_red"
		| "candy_gradient"
		| "papaya_punch";
	isApproved: boolean;
	status: "pending" | "approved" | "rejected" | "suspended" | "active";
	isPaid: boolean;
	registrationFee: number;
	referralCode?: string;
	discountApplied?: number;
	createdAt: string;
	updatedAt: string;
}

export interface Product {
	_id: string;
	mongoId?: string;
	vendorId: string;
	productType?: "product" | "service";
	name: string;
	description: string;
	category: string;
	price: number;
	priceMin?: number;
	priceMax?: number;
	duration?: string;
	videoUrl?: string;
	discountPrice?: number;
	promoStartDate?: string;
	promoEndDate?: string;
	sku: string;
	images: string[];
	tags: string[];
	variants?: any;
	stock: number;
	status: "pending" | "approved" | "rejected" | "suspended";
	rejectionReason?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Category {
	_id: string;
	name: string;
	slug: string;
	description?: string;
	parentId?: string;
	status: "active" | "inactive";
	createdAt: string;
	updatedAt: string;
}

export interface Admin {
	_id: string;
	userId: string;
	region?: string;
	notes?: string;
	createdAt: string;
	updatedAt: string;
	firstName: string;
	lastName: string;
}

export interface AdminAssignment {
	_id: string;
	adminId: string;
	vendorId: string;
	assignedBy: string;
	region?: string;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Referral {
	_id: string;
	code: string;
	discountPercent: number;
	maxUses?: number | null;
	usedCount?: number;
	currentUses?: number;
	expiresAt?: string;
	status?: "active" | "inactive";
	isActive?: boolean;
	usedBy?: string[];
	vendors?: Array<{
		id: string;
		businessName: string;
		subdomain?: string;
		status: string;
		ownerEmail?: string;
		registeredAt: string;
	}>;
	createdBy?: string;
	createdAt: string;
	updatedAt: string;
	description?: string;
}

export interface Payment {
	_id: string;
	userId: string;
	vendorId?: string;
	amount: number;
	currency: string;
	paymentMethod: string;
	status: "pending" | "success" | "failed";
	reference: string;
	paystackReference?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface ApiResponse<T> {
	success: boolean;
	message: string;
	data: T;
	meta?: {
		page?: number;
		limit?: number;
		total?: number;
		totalPages?: number;
	};
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface RegisterVendorData {
	email: string;
	password: string;
	businessName: string;
	phoneNumber: string;
	whatsappNumber?: string;
	description?: string;
	socialMedia?: {
		facebook?: string;
		instagram?: string;
		twitter?: string;
	};
	referralCode?: string;
	logoUrl?: string;
	profilePhotoUrl?: string;
	photoUrl?: string;
	businessType?: string;
	artisanCategory?: string;
}

export interface AuthResponse {
	user: User;
	vendor?: Vendor;
	accessToken: string;
	refreshToken: string;
}
