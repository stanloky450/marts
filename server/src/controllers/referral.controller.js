import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { generateRandomString } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

const isUuid = (value) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		(value || "").toString()
	);

const buildReferralLookupWhere = (value, options = {}) => {
	const raw = (value || "").toString().trim();
	const where = { OR: [{ mongoId: raw }] };
	if (isUuid(raw)) {
		where.OR.push({ id: raw });
	}
	if (options.allowCode) {
		where.OR.push({ code: raw.toUpperCase() });
	}
	return where;
};

const hasUsableExpiry = (expiresAt) => {
	if (!expiresAt || expiresAt === "0") return false;
	return !Number.isNaN(new Date(expiresAt).getTime());
};

export const createReferral = async (req, res, next) => {
	try {
		const { code, discountPercent, maxUses, expiresAt } = req.body;
		const formattedCode = (code || "").toString().trim().toUpperCase();

		// Check if code already exists
		const existingReferral = await prisma.referral.findUnique({
			where: { code: formattedCode }
		});
		if (existingReferral) {
			return res
				.status(409)
				.json(errorResponse("CODE_EXISTS", "Referral code already exists"));
		}

		// Validate discount percent
		if (discountPercent < 0 || discountPercent > 100) {
			return res
				.status(400)
				.json(
					errorResponse(
						"INVALID_DISCOUNT",
						"Discount percent must be between 0 and 100"
					)
				);
		}

		const mongoId = generateRandomString(12);

		const referral = await prisma.referral.create({
			data: {
				mongoId,
				code: formattedCode,
				discountPercent,
				maxUses,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "0",
				createdByMongoId: req.user.id,
			}
		});

		logger.info(`Referral code created: ${referral.code} by ${req.user.email}`);

		res.status(201).json(successResponse({ ...referral, _id: referral.mongoId }));
	} catch (error) {
		next(error);
	}
};

export const generateReferralCode = async (req, res, next) => {
	try {
		const { code, discountPercent, maxUses, expiresAt, description } = req.body;

		// Generate random code if not provided
		const rawCode = code || generateRandomString(8);
		const formattedCode = rawCode.trim().toUpperCase();

		if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
			return res
				.status(400)
				.json(
					errorResponse(
						"INVALID_DISCOUNT",
						"Discount percent must be between 0 and 100"
					)
				);
		}

		let normalizedExpiresAt = "0";
		if (typeof expiresAt === "string" && expiresAt.trim()) {
			const parsedExpiry = new Date(expiresAt);
			if (Number.isNaN(parsedExpiry.getTime())) {
				return res
					.status(400)
					.json(errorResponse("INVALID_EXPIRES_AT", "Expiry date is invalid"));
			}
			normalizedExpiresAt = parsedExpiry.toISOString();
		}

		const existing = await prisma.referral.findUnique({ where: { code: formattedCode } });
		if (existing) {
			return res
				.status(400)
				.json(
					errorResponse(
						"CODE_EXISTS",
						"This referral code already exists. Please choose another."
					)
				);
		}

		const mongoId = generateRandomString(12);

		const referral = await prisma.referral.create({
			data: {
				mongoId,
				code: formattedCode,
				discountPercent,
				maxUses,
				expiresAt: normalizedExpiresAt,
				label: description,
				createdByMongoId: req.user.mongoId || req.user.id,
			}
		});

		logger.info(
			`Referral code created manually: ${referral.code} by ${req.user.email}`
		);

		res.status(201).json(
			successResponse({
				...referral,
				_id: referral.mongoId,
				description: referral.label ?? undefined,
			})
		);
	} catch (error) {
		next(error);
	}
};

export const listReferrals = async (req, res, next) => {
	try {
		const { status, page = 1, limit = 20 } = req.query;

		const where = {};
		if (status) where.status = status;

		const qPage = Math.max(1, parseInt(page, 10) || 1);
		const qLimit = Math.min(100, parseInt(limit, 10) || 20);
		const skip = (qPage - 1) * qLimit;

		const [referrals, total] = await Promise.all([
			prisma.referral.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take: qLimit,
			}),
			prisma.referral.count({ where }),
		]);

		const mappedReferrals = referrals.map(r => ({
			...r,
			_id: r.mongoId,
			description: r.label ?? undefined,
		}));

		res.json(
			successResponse(mappedReferrals, {
				total,
				page: qPage,
				limit: qLimit,
				totalPages: Math.ceil(total / qLimit),
			})
		);
	} catch (error) {
		next(error);
	}
};

export const getReferral = async (req, res, next) => {
	try {
		const { id } = req.params;

		const referral = await prisma.referral.findFirst({
			where: buildReferralLookupWhere(id, { allowCode: true })
		});

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		res.json(
			successResponse({
				...referral,
				_id: referral.mongoId,
				description: referral.label ?? undefined,
			})
		);
	} catch (error) {
		next(error);
	}
};

export const validateReferralCode = async (req, res, next) => {
	try {
		const { code } = req.params;
		const formatted = (code || "").toString().trim().toUpperCase();

		const referral = await prisma.referral.findUnique({ where: { code: formatted } });

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		if (referral.status !== "active") {
			return res.status(400).json(
				errorResponse("REFERRAL_INACTIVE", "Referral code is not active", {
					status: referral.status,
				})
			);
		}

		if (hasUsableExpiry(referral.expiresAt) && new Date(referral.expiresAt) < new Date()) {
			return res.status(400).json(
				errorResponse("REFERRAL_EXPIRED", "Referral code has expired", {
					expiresAt: referral.expiresAt,
				})
			);
		}

		if (referral.maxUses && referral.usedCount >= referral.maxUses) {
			return res.status(400).json(
				errorResponse(
					"REFERRAL_EXHAUSTED",
					"Referral code has reached maximum uses",
					{
						maxUses: referral.maxUses,
						usedCount: referral.usedCount,
					}
				)
			);
		}

		res.json(
			successResponse({
				valid: true,
				code: referral.code,
				discountPercent: referral.discountPercent,
				description: referral.label,
			})
		);
	} catch (error) {
		next(error);
	}
};

export const updateReferral = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { discountPercent, maxUses, expiresAt, description, status } =
			req.body;

		const referral = await prisma.referral.findFirst({
			where: buildReferralLookupWhere(id)
		});

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		const updateData = {};
		if (discountPercent !== undefined) {
			if (discountPercent < 0 || discountPercent > 100) {
				return res
					.status(400)
					.json(
						errorResponse(
							"INVALID_DISCOUNT",
							"Discount percent must be between 0 and 100"
						)
					);
			}
			updateData.discountPercent = discountPercent;
		}

		if (maxUses !== undefined) updateData.maxUses = maxUses;
		if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : "0";
		if (description !== undefined) updateData.label = description;
		if (status) updateData.status = status;

		const updatedReferral = await prisma.referral.update({
			where: { id: referral.id },
			data: updateData
		});

		logger.info(`Referral code updated: ${updatedReferral.code} by ${req.user.email}`);

		res.json(
			successResponse({
				...updatedReferral,
				_id: updatedReferral.mongoId,
				description: updatedReferral.label ?? undefined,
			})
		);
	} catch (error) {
		next(error);
	}
};

export const deleteReferral = async (req, res, next) => {
	try {
		const { id } = req.params;

		const referral = await prisma.referral.findFirst({
			where: buildReferralLookupWhere(id)
		});

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		await prisma.referral.delete({ where: { id: referral.id } });

		logger.info(`Referral code deleted: ${referral.code} by ${req.user.email}`);

		res.json(
			successResponse({ message: "Referral code deleted successfully" })
		);
	} catch (error) {
		next(error);
	}
};

export const getReferralStats = async (req, res, next) => {
	try {
		const { id } = req.params;

		const referral = await prisma.referral.findFirst({
			where: buildReferralLookupWhere(id, { allowCode: true })
		});

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		// Get vendors who used this code
		const vendors = await prisma.vendor.findMany({
			where: { referralCodeUsed: referral.code },
			include: { owner: { select: { email: true, profileFirstName: true, profileLastName: true, mongoId: true } } },
			orderBy: { createdAt: 'desc' },
		});

		const stats = {
			code: referral.code,
			discountPercent: referral.discountPercent,
			usedCount: referral.usedCount,
			maxUses: referral.maxUses,
			status: referral.status,
			expiresAt: referral.expiresAt,
			lastUsedAt: referral.lastUsedAt,
			description: referral.label ?? undefined,
			vendors: vendors.map((v) => ({
				id: v.mongoId,
				businessName: v.businessName,
				subdomain: v.subdomain,
				status: v.status,
				ownerEmail: v.owner?.email,
				registeredAt: v.createdAt,
			})),
		};

		res.json(successResponse(stats));
	} catch (error) {
		next(error);
	}
};

export const getReferralByCodeWithVendors = async (req, res, next) => {
	try {
		const { code } = req.params;
		const formatted = (code || "").toString().trim().toUpperCase();

		const referral = await prisma.referral.findUnique({ where: { code: formatted } });

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		const vendors = await prisma.vendor.findMany({
			where: { referralCodeUsed: referral.code },
			include: { owner: { select: { email: true, mongoId: true } } },
		});

		const data = {
			...referral,
			_id: referral.mongoId,
			description: referral.label ?? undefined,
			vendors: vendors.map((v) => ({
				id: v.mongoId,
				businessName: v.businessName,
				subdomain: v.subdomain,
				status: v.status,
				ownerEmail: v.owner?.email,
				registeredAt: v.createdAt,
			})),
		};

		res.json(successResponse(data));
	} catch (error) {
		next(error);
	}
};

export const updateReferralStatusByCode = async (req, res, next) => {
	try {
		const { code } = req.params;
		const formatted = (code || "").toString().trim().toUpperCase();
		const { status } = req.body;

		if (!status || !["active", "inactive"].includes(status)) {
			return res
				.status(400)
				.json(errorResponse("INVALID_STATUS", "Status must be 'active' or 'inactive'"));
		}

		const referral = await prisma.referral.findUnique({ where: { code: formatted } });

		if (!referral) {
			return res
				.status(404)
				.json(errorResponse("REFERRAL_NOT_FOUND", "Referral code not found"));
		}

		const updatedReferral = await prisma.referral.update({
			where: { id: referral.id },
			data: { status }
		});

		logger.info(`Referral status updated: ${updatedReferral.code} to ${status}`);

		res.json(successResponse({ code: updatedReferral.code, status: updatedReferral.status }));
	} catch (error) {
		next(error);
	}
};

