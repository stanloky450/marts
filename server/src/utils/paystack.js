import axios from "axios";
import { config } from "../config/env.js";
import { logger } from "./logger.js";
import crypto from "crypto";

const paystackClient = axios.create({
	baseURL: "https://api.paystack.co",
	headers: {
		Authorization: `Bearer ${config.paystack.secretKey}`,
		"Content-Type": "application/json",
	},
});

export const initializePayment = async ({
	email,
	amount,
	reference,
	metadata = {},
}) => {
	try {
		const response = await paystackClient.post("/transaction/initialize", {
			email,
			amount: amount * 100, // Convert to kobo
			reference,
			currency: config.registration.currency,
			metadata,
			callback_url: `${config.domain.frontend}/payment/callback`,
		});

		return response.data.data;
	} catch (error) {
		const payload = error.response?.data;
		logger.error("Paystack initialization error:", payload || error.message);
		const errMsg =
			payload?.message ||
			JSON.stringify(payload) ||
			error.message ||
			"Failed to initialize payment";
		throw new Error(errMsg);
	}
};

export const verifyPayment = async (reference) => {
	try {
		const response = await paystackClient.get(
			`/transaction/verify/${reference}`
		);
		return response.data.data;
	} catch (error) {
		logger.error(
			"Paystack verification error:",
			error.response?.data || error.message
		);
		throw new Error("Failed to verify payment");
	}
};

export const validateWebhookSignature = (payload, signature) => {
	const hash = crypto
		.createHmac("sha512", config.paystack.webhookSecret)
		.update(JSON.stringify(payload))
		.digest("hex");
	return hash === signature;
};
