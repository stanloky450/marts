import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export const signAccessToken = (payload) => {
	return jwt.sign(payload, config.jwt.accessSecret, {
		expiresIn: config.jwt.accessExpiry,
	});
};

export const signRefreshToken = (payload) => {
	return jwt.sign(payload, config.jwt.refreshSecret, {
		expiresIn: config.jwt.refreshExpiry,
	});
};

export const verifyAccessToken = (token) => {
	try {
		return jwt.verify(token, config.jwt.accessSecret);
	} catch (error) {
		throw new Error("Invalid or expired access token");
	}
};

export const verifyRefreshToken = (token) => {
	try {
		return jwt.verify(token, config.jwt.refreshSecret);
	} catch (error) {
		throw new Error("Invalid or expired refresh token");
	}
};
