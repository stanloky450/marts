import {
	signAccessToken,
	signRefreshToken,
	verifyRefreshToken,
} from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

export const login = async (req, res, next) => {
	try {
		const { email, password } = req.body;

		// Find user via Prisma
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			return res
				.status(401)
				.json(
					errorResponse("INVALID_CREDENTIALS", "Invalid email or password")
				);
		}

		// Check if user is active
		if (user.status !== "active") {
			return res
				.status(403)
				.json(
					errorResponse("ACCOUNT_SUSPENDED", "Your account has been suspended")
				);
		}

		// For vendors, check if vendor is active
		if (user.role === "vendor") {
			const vendor = await prisma.vendor.findFirst({
				where: { ownerMongoId: user.mongoId },
			});
			if (!vendor || vendor.status !== "active") {
				return res
					.status(403)
					.json(
						errorResponse(
							"VENDOR_INACTIVE",
							"Vendor account is not active. Please complete payment."
						)
					);
			}
		}

		// Update last login
		await prisma.user.update({
			where: { id: user.id },
			data: { lastLoginAt: new Date() },
		});

		// Generate tokens
		const payload = {
			sub: user.mongoId, // Use mongoId for token compatibility if expected by other services
			role: user.role,
			email: user.email,
		};

		const accessToken = signAccessToken(payload);
		const refreshToken = signRefreshToken(payload);

		logger.info(`User logged in: ${user.email}`);

		res.json(
			successResponse({
				accessToken,
				refreshToken,
				user: {
					id: user.mongoId, // Keep mongoId in response for frontend compatibility
					email: user.email,
					role: user.role,
					profile: {
						firstName: user.profileFirstName,
						lastName: user.profileLastName,
						phone: user.profilePhone,
						region: user.profileRegion,
						notes: user.profileNotes,
					},
				},
			})
		);
	} catch (error) {
		next(error);
	}
};

export const refresh = async (req, res, next) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res
				.status(400)
				.json(errorResponse("MISSING_TOKEN", "Refresh token is required"));
		}

		try {
			const decoded = verifyRefreshToken(refreshToken);

			// Verify user still exists and is active using mongoId from token payload
			const user = await prisma.user.findUnique({
				where: { mongoId: decoded.sub },
			});

			if (!user || user.status !== "active") {
				return res
					.status(401)
					.json(errorResponse("INVALID_TOKEN", "Invalid refresh token"));
			}

			// Generate new tokens
			const payload = {
				sub: user.mongoId,
				role: user.role,
				email: user.email,
			};

			const newAccessToken = signAccessToken(payload);
			const newRefreshToken = signRefreshToken(payload);

			res.json(
				successResponse({
					accessToken: newAccessToken,
					refreshToken: newRefreshToken,
				})
			);
		} catch (error) {
			return res
				.status(401)
				.json(
					errorResponse("INVALID_TOKEN", "Invalid or expired refresh token")
				);
		}
	} catch (error) {
		next(error);
	}
};

export const logout = async (req, res, next) => {
	try {
		logger.info(`User logged out: ${req.user.email}`);
		res.json(successResponse({ message: "Logged out successfully" }));
	} catch (error) {
		next(error);
	}
};

export const me = async (req, res, next) => {
	try {
		// req.user.id typically comes from the token `sub` (mongoId in our case)
		const user = await prisma.user.findUnique({
			where: { mongoId: req.user.id },
		});

		if (!user) {
			return res
				.status(404)
				.json(errorResponse("USER_NOT_FOUND", "User not found"));
		}

		// If vendor, include vendor info
		let vendorInfo = null;
		if (user.role === "vendor") {
			vendorInfo = await prisma.vendor.findFirst({
				where: { ownerMongoId: user.mongoId },
			});
		}

		// Map flat profile fields back to nested object for API compatibility
		const userWithProfile = {
			...user,
			id: user.mongoId, // ensure ID consistency
			profile: {
				firstName: user.profileFirstName,
				lastName: user.profileLastName,
				phone: user.profilePhone,
				region: user.profileRegion,
				notes: user.profileNotes,
			}
		};
		delete userWithProfile.passwordHash;

		res.json(
			successResponse({
				user: userWithProfile,
				vendor: vendorInfo,
			})
		);
	} catch (error) {
		next(error);
	}
};
