import dotenv from "dotenv";

dotenv.config();

export const config = {
	env: process.env.NODE_ENV || "development",
	port: Number.parseInt(process.env.PORT || "5000", 10),
	apiPrefix: process.env.API_PREFIX || "/api",

	mongodb: {
		uri: process.env.MONGODB_URI || "mongodb://localhost:27017/ecommerced",
	},

	jwt: {
		accessSecret: process.env.JWT_ACCESS_SECRET,
		refreshSecret: process.env.JWT_REFRESH_SECRET,
		accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
		refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
	},

	cloudinary: {
		cloudName: process.env.CLOUDINARY_CLOUD_NAME,
		apiKey: process.env.CLOUDINARY_API_KEY,
		apiSecret: process.env.CLOUDINARY_API_SECRET,
	},

	paystack: {

		secretKey: process.env.PAYSTACK_SECRET_KEY,
		publicKey: process.env.PAYSTACK_PUBLIC_KEY,

		webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
	},

	registration: {
		fee: Number.parseInt(process.env.REGISTRATION_FEE || "10000", 10),
		currency: process.env.REGISTRATION_CURRENCY || "NGN",
	},

	domain: {
		base: process.env.BASE_DOMAIN || "example.com",
		frontend: process.env.FRONTEND_URL || "http://localhost:3001",
	},

	openai: {
		apiKey: process.env.OPENAI_API_KEY,
	},
	// For seeding initial data like super admin credentials

	seed: {
		superAdminEmail: process.env.SEED_SUPERADMIN_EMAIL,
		superAdminPassword: process.env.SEED_SUPERADMIN_PASSWORD,
	},

	cors: {
		origin: process.env.CORS_ORIGIN || "http://localhost:3001",
	},
};
