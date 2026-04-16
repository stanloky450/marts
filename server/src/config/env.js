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
		// secretKey: "sk_test_f6358f39abc0fdd40b81b0eb0bfaa8636165c428",
		secretKey: process.env.PAYSTACK_SECRET_KEY,
		publicKey: process.env.PAYSTACK_PUBLIC_KEY,
		// publicKey: "pk_test_f35613a7cca4a53c34eb35d094eb736ca56c5c14",
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
		// apiKey: "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",
		// apiKey: "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",
		apiKey: process.env.OPENAI_API_KEY,
		// ||
		// "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",
	},

	seed: {
		superAdminEmail: process.env.SEED_SUPERADMIN_EMAIL,
		superAdminPassword: process.env.SEED_SUPERADMIN_PASSWORD,
	},

	cors: {
		origin: process.env.CORS_ORIGIN || "http://localhost:3001",
	},
};
