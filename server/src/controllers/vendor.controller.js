import { successResponse, errorResponse } from "../utils/apiResponse.js";
import {
	USER_ROLES,
	VENDOR_STATUS,
	PAYMENT_TYPE,
	PAYMENT_STATUS,
	PRODUCT_STATUS,
} from "../utils/constants.js";
import { generateRandomString } from "../utils/crypto.js";
import { initializePayment } from "../utils/paystack.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { uploadToCloud } from "../config/cloudinary.js";
import { config as appConfig } from "../config/env.js";
import {
	generateSubdomain,
	createSubdomainForVendor,
} from "../utils/subdomain.js";
import prisma from "../lib/prisma.js";

import bcrypt from "bcrypt";

export const register = async (req, res, next) => {
	try {
		const {
			email,
			password,
			firstName,
			lastName,
			businessName,
			description,
			phone,
			whatsapp,
			socials,
			socialMedia,
			referralCode,
			businessType,
			artisanCategory,
			region,
			area,
		} = req.body;

		// Normalize socials
		let normalizedSocials = socials ?? socialMedia;
		if (typeof normalizedSocials === "string") {
			try {
				normalizedSocials = JSON.parse(normalizedSocials);
			} catch {
				normalizedSocials = undefined;
			}
		}
		if (normalizedSocials && typeof normalizedSocials === "object") {
			normalizedSocials = {
				facebook: normalizedSocials.facebook || "",
				instagram: normalizedSocials.instagram || "",
				x: normalizedSocials.x || normalizedSocials.twitter || "",
			};
		}

		// Handle image uploads
		let logoUrl = null;
		let profilePhotoUrl = null;

		if (req.files && Object.keys(req.files).length > 0) {
			if (req.files["logo"]) {
				const file = req.files["logo"][0];
				logoUrl = await uploadToCloud(file.buffer, file.originalname);
			}
			if (req.files["profilePhoto"]) {
				const file = req.files["profilePhoto"][0];
				profilePhotoUrl = await uploadToCloud(file.buffer, file.originalname);
			}
		}

		// Check if user already exists via Prisma
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return res
				.status(409)
				.json(errorResponse("USER_EXISTS", "Email already registered"));
		}

		// Validate referral code
		let referral = null;
		let discountPercent = 0;

		if (referralCode) {
			referral = await prisma.referral.findUnique({
				where: { code: referralCode.toUpperCase() }
			});

			if (!referral || referral.status !== "active") {
				return res
					.status(400)
					.json(errorResponse("INVALID_REFERRAL", "Invalid or inactive referral code"));
			}

			if (referral.maxUses && referral.usedCount >= referral.maxUses) {
				return res
					.status(400)
					.json(errorResponse("REFERRAL_EXHAUSTED", "Referral code has reached maximum uses"));
			}

			discountPercent = referral.discountPercent;
		}

		// Calculate registration fee
		const configuredFee = Number(config.registration.fee);
		let baseAmount = Number.isFinite(configuredFee) ? configuredFee : 10000;

		if (region) {
			const locationDoc = await prisma.location.findFirst({
				where: { region: { equals: region, mode: 'insensitive' }, isActive: true }
			});
			if (locationDoc) {
				baseAmount = locationDoc.registrationFee;
			}
		}

		const normalizedDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
		const discountAmount = Math.round((baseAmount * normalizedDiscount) / 100);
		const finalAmount = Math.max(0, baseAmount - discountAmount);

		// Password hashing (Prisma doesn't have pre-save hooks like Mongoose)
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Generate new UUID and Mongo-compatible ID
		const crypto = await import('crypto');
		const userMongoId = crypto.randomBytes(12).toString('hex');
		const vendorMongoId = crypto.randomBytes(12).toString('hex');

		// Create user and vendor in a transaction
		const [user, vendor] = await prisma.$transaction([
			prisma.user.create({
				data: {
					mongoId: userMongoId,
					email,
					passwordHash: hashedPassword,
					role: USER_ROLES.VENDOR,
					profileFirstName: firstName,
					profileLastName: lastName,
					profilePhone: phone,
					profilePhotoUrl: profilePhotoUrl,
				}
			}),
			prisma.vendor.create({
				data: {
					mongoId: vendorMongoId,
					ownerMongoId: userMongoId,
					businessName,
					description,
					artisanCategory,
					phoneNumber: phone,
					whatsappNumber: whatsapp,
					socials: normalizedSocials || {},
					logoUrl: logoUrl,
					referralCodeUsed: referralCode?.toUpperCase(),
					status: VENDOR_STATUS.PENDING,
					locationRegion: region,
					locationArea: area,
				}
			})
		]);

		// Reserve subdomain (best-effort)
		try {
			// This might need update to work with Prisma model objects
			await createSubdomainForVendor(vendor);
		} catch (err) {
			logger.warn(`Failed to reserve subdomain for vendor ${vendor.id}: ${err?.message}`);
		}

		// Create payment
		const paymentReference = `REG-${generateRandomString(16)}`;
		const paymentMongoId = crypto.randomBytes(12).toString('hex');
		await prisma.payment.create({
			data: {
				mongoId: paymentMongoId,
				type: "registration",
				amount: finalAmount,
				currency: config.registration.currency,
				reference: paymentReference,
				status: "pending",
				userMongoId: user.mongoId,
				vendorMongoId: vendor.mongoId,
				metadata: {
					referralCode: referralCode?.toUpperCase(),
					discountPercent,
					originalAmount: baseAmount,
				},
			}
		});

		// Initialize Paystack
		const paystackData = await initializePayment({
			email: user.email,
			amount: finalAmount,
			reference: paymentReference,
			metadata: {
				userId: user.mongoId,
				vendorId: vendor.mongoId,
				type: "registration",
			},
		});

		logger.info(`Vendor registration initiated: ${email}`);

		res.status(201).json(
			successResponse({
				userId: user.mongoId,
				vendorId: vendor.mongoId,
				payment: {
					reference: paymentReference,
					amount: finalAmount,
					currency: config.registration.currency,
					authorizationUrl: paystackData.authorization_url,
					accessCode: paystackData.access_code,
				},
			})
		);
	} catch (error) {
		next(error);
	}
};

export const initiateRegistration = async (req, res, next) => {
	try {
		const {
			email,
			passwordHash, // This is expected to be the plain password from some consumers, but named passwordHash in body
			firstName,
			lastName,
			businessName,
			description,
			phoneNumber,
			whatsappNumber,
			socials,
			socialMedia,
			referralCode,
			businessType,
			artisanCategory,
			profilePhotoUrl,
			logoUrl,
			logo,
			region,
			area,
		} = req.body;

		if (!email || !passwordHash || !businessName) {
			return res
				.status(400)
				.json(errorResponse("INVALID_INPUT", "email, password and businessName are required"));
		}

		if (!region || !area) {
			return res.status(400).json({ error: { message: "Location (region & area) is required" } });
		}

		if (passwordHash.length < 8) {
			return res
				.status(400)
				.json(errorResponse("WEAK_PASSWORD", "Password must be at least 8 characters"));
		}

		let normalizedSocials = socials ?? socialMedia;
		if (typeof normalizedSocials === "string") {
			try {
				normalizedSocials = JSON.parse(normalizedSocials);
			} catch {
				normalizedSocials = undefined;
			}
		}
		if (normalizedSocials && typeof normalizedSocials === "object") {
			normalizedSocials = {
				facebook: normalizedSocials.facebook || "",
				instagram: normalizedSocials.instagram || "",
				x: normalizedSocials.x || normalizedSocials.twitter || "",
			};
		}

		const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
		if (existingUser) {
			return res
				.status(409)
				.json(errorResponse("USER_EXISTS", "Email already registered"));
		}

		let discountPercent = 0;
		let referralId = null;
		if (referralCode) {
			const referral = await prisma.referral.findUnique({
				where: { code: referralCode.toUpperCase() }
			});

			if (referral && referral.status === "active") {
				if (!(referral.maxUses && referral.usedCount >= referral.maxUses)) {
					discountPercent = referral.discountPercent || 0;
					referralId = referral.mongoId;
				}
			}
		}

		let baseAmount = Number(appConfig.registration.fee ?? 10000);
		if (region) {
			const locationDoc = await prisma.location.findFirst({
				where: { region: { equals: region, mode: 'insensitive' }, isActive: true }
			});
			if (locationDoc) {
				baseAmount = locationDoc.registrationFee;
			}
		}

		const discountAmount = (baseAmount * discountPercent) / 100;
		const finalAmount = Math.round(baseAmount - discountAmount);

		const saltRounds = Number(appConfig.bcryptRounds) || 10;
		const hashedPassword = await bcrypt.hash(passwordHash, saltRounds);

		const paymentReference = `REG-${Date.now()}-${generateRandomString(12)}`;
		const crypto = await import('crypto');
		const paymentMongoId = crypto.randomBytes(12).toString('hex');

		const payment = await prisma.payment.create({
			data: {
				mongoId: paymentMongoId,
				type: "registration",
				amount: finalAmount,
				currency: appConfig.registration.currency || "NGN",
				reference: paymentReference,
				status: "pending",
				metadata: {
					registrationData: {
						email: email.toLowerCase(),
						password: hashedPassword,
						firstName,
						lastName,
						businessName,
						description,
						phoneNumber,
						whatsappNumber,
						socials: normalizedSocials || {},
						referralCode: referralCode?.toUpperCase(),
						referralId,
						businessType,
						artisanCategory,
						profilePhotoUrl,
						logoUrl,
						logo,
						location: { region, area },
					},
					discountPercent,
					originalAmount: baseAmount,
					discountAmount,
				},
			}
		});

		const paystackData = await initializePayment({
			email: email.toLowerCase(),
			amount: finalAmount,
			reference: paymentReference,
			callback_url: `${config.domain.frontend}/payment/callback`,
			metadata: {
				type: "registration",
				reference: paymentReference,
				businessName,
			},
		});

		res.status(201).json(
			successResponse({
				payment: {
					reference: paymentReference,
					amount: finalAmount,
					currency: appConfig.registration.currency || "NGN",
					authorizationUrl: paystackData.authorization_url,
					accessCode: paystackData.access_code,
				},
			})
		);
	} catch (error) {
		next(error);
	}
};

export const processSuccessfulRegistration = async (payment, registrationData) => {
	try {
		const passwordHash = registrationData.password;
		let user = await prisma.user.findUnique({ where: { email: registrationData.email } });
		
		const crypto = await import('crypto');
		
		if (!user) {
			user = await prisma.user.create({
				data: {
					mongoId: crypto.randomBytes(12).toString('hex'),
					email: registrationData.email,
					passwordHash: passwordHash,
					role: "vendor",
					profileFirstName: registrationData.firstName,
					profileLastName: registrationData.lastName,
					profilePhone: registrationData.phoneNumber,
					profileRegion: registrationData.location?.region,
				}
			});
		}

		let vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: user.mongoId } });
		if (!vendor) {
			vendor = await prisma.vendor.create({
				data: {
					mongoId: crypto.randomBytes(12).toString('hex'),
					ownerMongoId: user.mongoId,
					businessName: registrationData.businessName,
					description: registrationData.description,
					artisanCategory: registrationData.artisanCategory,
					phoneNumber: registrationData.phoneNumber,
					whatsappNumber: registrationData.whatsappNumber,
					socials: registrationData.socials || {},
					logoUrl: registrationData.logoUrl,
					logo: registrationData.logo,
					profilePhotoUrl: registrationData.profilePhotoUrl,
					referralCodeUsed: registrationData.referralCode,
					status: "active",
					locationRegion: registrationData.location?.region,
					locationArea: registrationData.location?.area,
				}
			});
		}

		if (!vendor.subdomain) {
			const assignedSubdomain = await createSubdomainForVendor(vendor);
			vendor = { ...vendor, subdomain: assignedSubdomain };
		}

		await prisma.payment.update({
			where: { id: payment.id },
			data: {
				status: "success",
				userMongoId: user.mongoId,
				vendorMongoId: vendor.mongoId,
				paidAt: new Date(),
			}
		});

		if (registrationData.referralCode) {
			await prisma.referral.update({
				where: { code: registrationData.referralCode },
				data: { usedCount: { increment: 1 } }
			});
		}

		return { user, vendor };
	} catch (error) {
		await prisma.payment.update({
			where: { id: payment.id },
			data: {
				status: "failed",
				metadata: { ...payment.metadata, error: error.message }
			}
		});
		throw error;
	}
};

export const getVendorProfile = async (req, res, next) => {
	try {
		const vendor = await prisma.vendor.findFirst({
			where: { ownerMongoId: req.user.id },
			include: { owner: true }
		});

		if (!vendor) return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));

		// Get product stats via Prisma
		const productStats = await prisma.product.groupBy({
			by: ['status'],
			where: { vendorMongoId: vendor.mongoId },
			_count: { _all: true }
		});

		const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
		productStats.forEach((stat) => {
			stats[stat.status] = stat._count._all;
			stats.total += stat._count._all;
		});

		const mappedVendor = { ...vendor, _id: vendor.mongoId, owner: { ...vendor.owner, _id: vendor.owner.mongoId } };

		res.json(successResponse({ vendor: mappedVendor, stats }));
	} catch (error) {
		next(error);
	}
};

export const updateVendorProfile = async (req, res, next) => {
	try {
		const {
			businessName,
			description,
			phone,
			whatsapp,
			socials,
			address,
			logoUrl,
			profilePhotoUrl,
			bannerImage,
			themeColor,
		} = req.body;

		const vendor = await prisma.vendor.findFirst({
			where: { ownerMongoId: req.user.id }
		});

		if (!vendor) return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));

		const updateData = {};
		if (businessName !== undefined) updateData.businessName = businessName || null;
		if (description !== undefined) updateData.description = description || null;
		if (phone !== undefined) updateData.phoneNumber = phone || null;
		if (whatsapp !== undefined) updateData.whatsappNumber = whatsapp || null;
		if (socials !== undefined) updateData.socials = { ...(vendor.socials || {}), ...(socials || {}) };
		if (address !== undefined) updateData.address = { ...(vendor.address || {}), ...(address || {}) };
		if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;
		if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl || null;
		if (bannerImage !== undefined) updateData.bannerImage = bannerImage || null;
		if (themeColor !== undefined) updateData.themeColor = themeColor;

		const updatedVendor = await prisma.vendor.update({
			where: { id: vendor.id },
			data: updateData
		});

		logger.info(`Vendor profile updated: ${updatedVendor.id}`);

		res.json(successResponse({ ...updatedVendor, _id: updatedVendor.mongoId }));
	} catch (error) {
		next(error);
	}
};

export const listVendors = async (req, res, next) => {
	try {
		const { status, search, page = 1, limit = 20 } = req.query;
		const where = {};

		if (status) where.status = status;
		if (search) {
			where.OR = [
				{ businessName: { contains: search, mode: 'insensitive' } },
				{ subdomain: { contains: search, mode: 'insensitive' } },
			];
		}

		const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);
		const [vendors, total] = await Promise.all([
			prisma.vendor.findMany({
				where,
				include: { owner: { select: { email: true, mongoId: true } } },
				orderBy: { createdAt: 'desc' },
				skip,
				take: Number.parseInt(limit),
			}),
			prisma.vendor.count({ where }),
		]);

		const mappedVendors = vendors.map(v => ({
			...v,
			_id: v.mongoId,
			owner: { ...v.owner, _id: v.owner.mongoId }
		}));

		res.json(
			successResponse(mappedVendors, {
				total,
				page: Number.parseInt(page),
				limit: Number.parseInt(limit),
				totalPages: Math.ceil(total / limit),
			})
		);
	} catch (error) {
		next(error);
	}
};

export const updateVendorStatus = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		const vendor = await prisma.vendor.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!vendor) return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor not found"));

		const updatedVendor = await prisma.vendor.update({
			where: { id: vendor.id },
			data: { status }
		});

		await prisma.user.update({
			where: { mongoId: vendor.ownerMongoId },
			data: { status: status === "suspended" ? "suspended" : "active" }
		});

		logger.info(`Vendor status updated: ${vendor.id} -> ${status}`);

		res.json(successResponse({ ...updatedVendor, _id: updatedVendor.mongoId }));
	} catch (error) {
		next(error);
	}
};

export const getVendorDashboardStats = async (req, res, next) => {
	try {
		const vendor = await prisma.vendor.findFirst({
			where: { ownerMongoId: req.user.id },
			select: { mongoId: true }
		});

		if (!vendor) return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor not found"));

		const totalViewsResult = await prisma.product.aggregate({
			where: { vendorMongoId: vendor.mongoId },
			_sum: { metaViews: true }
		});
		const totalViews = totalViewsResult._sum.metaViews || 0;

		const [
			totalProducts,
			totalRevenueResult,
		] = await Promise.all([
			prisma.product.count({
				where: {
					vendorMongoId: vendor.mongoId,
					status: "approved",
				},
			}),
			prisma.payment.aggregate({
				where: {
					vendorMongoId: vendor.mongoId,
					status: "success",
				},
				_sum: { amount: true }
			}),
		]);

		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const [recentProducts, recentRevenueResult] = await Promise.all([
			prisma.product.count({
				where: {
					vendorMongoId: vendor.mongoId,
					createdAt: { gte: thirtyDaysAgo },
				},
			}),
			prisma.payment.aggregate({
				where: {
					vendorMongoId: vendor.mongoId,
					status: "success",
					createdAt: { gte: thirtyDaysAgo },
				},
				_sum: { amount: true }
			}),
		]);

		const stats = {
			totals: {
				products: totalProducts,
				revenue: totalRevenueResult._sum.amount || 0,
				views: totalViewsResult._sum.metaViews || 0,
			},
			recent: {
				products: recentProducts,
				revenue: recentRevenueResult._sum.amount || 0,
			},
		};

		return res.json(successResponse(stats));
	} catch (error) {
		next(error);
	}
};

export const getVendorProducts = async (req, res, next) => {
	try {
		let vendorMongoId;
		if (req.params.vendorId) {
			vendorMongoId = req.params.vendorId;
		} else {
			const vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: req.user.id } });
			if (!vendor) {
				return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor not found for this user"));
			}
			vendorMongoId = vendor.mongoId;
		}

		const {
			page = 1,
			limit = 20,
			status,
			search,
			category,
			sortBy,
			sortOrder = "desc",
		} = req.query;

		const qPage = Math.max(1, parseInt(page, 10) || 1);
		const qLimit = Math.min(100, parseInt(limit, 10) || 20);
		const skip = (qPage - 1) * qLimit;

		const where = { vendorMongoId };

		if (status) where.status = status;
		if (category) where.categoryMongoId = category;

		if (search) {
			where.OR = [
				{ title: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{ sku: { contains: search, mode: 'insensitive' } },
			];
		}

		const orderBy = {};
		if (sortBy) {
			orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
		} else {
			orderBy.createdAt = "desc";
		}

		const [products, total] = await Promise.all([
			prisma.product.findMany({
				where,
				include: {
					vendor: { select: { businessName: true, logo: true, mongoId: true } },
				},
				orderBy,
				skip,
				take: qLimit,
			}),
			prisma.product.count({ where }),
		]);

		const mappedProducts = products.map(p => ({
			...p,
			_id: p.mongoId,
			vendor: p.vendor ? { ...p.vendor, _id: p.vendor.mongoId } : null,
		}));

		const meta = {
			total,
			page: qPage,
			limit: qLimit,
			totalPages: Math.ceil(total / qLimit),
		};

		return res.json(successResponse(mappedProducts, meta));
	} catch (error) {
		next(error);
	}
};

/**
 * GET /api/admins/products/analytics  (super_admin / admin)
 * Top products by views across the whole marketplace.
 */
export const getAdminProductAnalytics = async (req, res, next) => {
	try {
		const { vendorId, sort = "views", limit = 50 } = req.query;

		const where = {};
		if (vendorId) {
			where.vendorMongoId = vendorId;
		}

		const orderBy = sort === "sales" ? { metaSales: 'desc' } : { metaViews: 'desc' };

		const products = await prisma.product.findMany({
			where,
			include: {
				vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
				category: { select: { name: true, mongoId: true } },
			},
			orderBy,
			take: Number(limit),
		});

		const analytics = products.map((p) => ({
			_id: p.mongoId,
			name: p.name,
			category: p.category?.name || "—",
			vendor: p.vendor?.businessName || "—",
			vendorSubdomain: p.vendor?.subdomain || null,
			price: p.price,
			stock: p.stock,
			status: p.status,
			views: p.metaViews,
			sales: p.metaSales,
			createdAt: p.createdAt,
		}));

		// Marketplace totals
		const totalsResult = await prisma.product.aggregate({
			_sum: { metaViews: true, metaSales: true }
		});
		const totals = {
			views: totalsResult._sum.metaViews || 0,
			sales: totalsResult._sum.metaSales || 0,
		};

		return res.json(successResponse({ products: analytics, totals }));
	} catch (error) {
		next(error);
	}
};
