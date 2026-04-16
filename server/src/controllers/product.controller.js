import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { PRODUCT_STATUS } from "../utils/constants.js";
import { ensureSKU } from "../utils/sku.js";
import { logger } from "../utils/logger.js";
import redisClient from "../lib/redis.js";
import prisma from "../lib/prisma.js";

const PRODUCT_TYPE_TAG_PREFIX = "__type:";

const detectProductType = (product) => {
	const tags = Array.isArray(product?.tags) ? product.tags : [];
	const tagged = tags.find((t) => typeof t === "string" && t.startsWith(PRODUCT_TYPE_TAG_PREFIX));
	if (tagged === `${PRODUCT_TYPE_TAG_PREFIX}service`) return "service";
	if (tagged === `${PRODUCT_TYPE_TAG_PREFIX}product`) return "product";

	const variants = product?.variants;
	if (variants && !Array.isArray(variants) && typeof variants === "object" && variants.kind === "service") {
		return "service";
	}
	return "product";
};

const extractServiceMeta = (product) => {
	const variants = product?.variants;
	if (variants && !Array.isArray(variants) && typeof variants === "object" && variants.kind === "service") {
		return variants;
	}
	return null;
};

const withTypeTag = (tags, type) => {
	const base = Array.isArray(tags) ? tags.filter((t) => typeof t === "string" && !t.startsWith(PRODUCT_TYPE_TAG_PREFIX)) : [];
	return [...base, `${PRODUCT_TYPE_TAG_PREFIX}${type}`];
};

const mapProductForResponse = (product) => {
	const productType = detectProductType(product);
	const service = extractServiceMeta(product);
	return {
		...product,
		_id: product.mongoId,
		productType,
		duration: productType === "service" ? service?.duration : undefined,
		videoUrl: productType === "service" ? service?.videoUrl : undefined,
		priceMin: productType === "service" ? service?.priceMin : undefined,
		priceMax: productType === "service" ? service?.priceMax : undefined,
	};
};

export const createProduct = async (req, res, next) => {
	try {
		const {
			productType = "product",
			name,
			description,
			category,
			price,
			priceMin,
			priceMax,
			duration,
			videoUrl,
			discountPrice,
			promo,
			stock,
			images,
			tags,
			variants,
		} = req.body;

		// Get vendor via Prisma
		const vendor = await prisma.vendor.findFirst({
			where: { ownerMongoId: req.user.id }
		});

		if (!vendor) {
			return res
				.status(404)
				.json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
		}

		if (vendor.status !== "active") {
			return res
				.status(403)
				.json(errorResponse("VENDOR_INACTIVE", "Vendor account is not active"));
		}

		// Validate category via Prisma
		const categoryExists = await prisma.category.findUnique({
			where: { mongoId: category }
		});
		if (!categoryExists) {
			return res
				.status(400)
				.json(errorResponse("INVALID_CATEGORY", "Category does not exist"));
		}

		const safeType = productType === "service" ? "service" : "product";
		const safeImages = Array.isArray(images) ? images : [];
		const numericPrice = price !== undefined && price !== null ? Number(price) : undefined;
		const numericPriceMin = priceMin !== undefined && priceMin !== null ? Number(priceMin) : undefined;
		const numericPriceMax = priceMax !== undefined && priceMax !== null ? Number(priceMax) : undefined;

		if (safeType === "service") {
			if (safeImages.length < 2) {
				return res
					.status(400)
					.json(errorResponse("INVALID_SERVICE_IMAGES", "Services require at least 2 images"));
			}
			if (!duration) {
				return res
					.status(400)
					.json(errorResponse("MISSING_DURATION", "Duration is required for a service"));
			}
			if (!videoUrl) {
				return res
					.status(400)
					.json(errorResponse("MISSING_VIDEO_URL", "Video link is required for a service"));
			}
			const hasFixedPrice = Number.isFinite(numericPrice);
			const hasRange = Number.isFinite(numericPriceMin) && Number.isFinite(numericPriceMax);
			if (!hasFixedPrice && !hasRange) {
				return res
					.status(400)
					.json(
						errorResponse(
							"MISSING_PRICE",
							"A service requires either a single price or a price range"
						)
					);
			}
			if (hasRange && numericPriceMin > numericPriceMax) {
				return res
					.status(400)
					.json(errorResponse("INVALID_PRICE_RANGE", "priceMin cannot be greater than priceMax"));
			}
		} else if (!Number.isFinite(numericPrice)) {
			return res
				.status(400)
				.json(errorResponse("MISSING_PRICE", "Price is required for a product"));
		}

		const resolvedPrice =
			safeType === "service"
				? Number.isFinite(numericPrice)
					? numericPrice
					: numericPriceMin
				: numericPrice;

		const serviceMeta =
			safeType === "service"
				? {
						kind: "service",
						duration,
						videoUrl,
						priceMode:
							Number.isFinite(numericPriceMin) && Number.isFinite(numericPriceMax)
								? "range"
								: "fixed",
						priceMin: Number.isFinite(numericPriceMin) ? numericPriceMin : resolvedPrice,
						priceMax: Number.isFinite(numericPriceMax) ? numericPriceMax : resolvedPrice,
				  }
				: null;

		// Create product/service data
		let productData = {
			vendorMongoId: vendor.mongoId,
			name,
			description,
			categoryMongoId: category,
			price: resolvedPrice,
			discountPrice,
			promoStart: promo?.start,
			promoEnd: promo?.end,
			stock: safeType === "service" ? 1 : Number(stock ?? 0),
			images: safeImages,
			tags: withTypeTag(tags, safeType),
			variants: safeType === "service" ? serviceMeta : variants,
			status: PRODUCT_STATUS.PENDING,
			region: vendor.locationRegion, // Map from flattened field
		};

		// Ensure SKU (assuming local utility works with the object)
		productData = ensureSKU(productData);

		// Generate a new mongoId for compatibility or let Prisma handle it?
		// We'll generate a unique string to fill the mongoId field if it's required unique.
		// For new records, we can generate a 24-char hex string.
		const crypto = await import('crypto');
		const newMongoId = crypto.randomBytes(12).toString('hex');

		const product = await prisma.product.create({
			data: {
				...productData,
				mongoId: newMongoId,
			}
		});

		logger.info(`Product created: ${product.id} by vendor ${vendor.id}`);

		res.status(201).json(successResponse({
			...mapProductForResponse(product),
			vendor: product.vendorMongoId,
			category: product.categoryMongoId,
		}));
	} catch (error) {
		next(error);
	}
};

export const listProducts = async (req, res, next) => {
	try {
		const {
			status,
			category,
			vendor,
			search,
			minPrice,
			maxPrice,
			region,
			page = 1,
			limit = 20,
		} = req.query;

		const where = {};

		// Role-based filtering
		if (req.user.role === "vendor") {
			const vendorDoc = await prisma.vendor.findFirst({
				where: { ownerMongoId: req.user.id }
			});
			if (vendorDoc) {
				where.vendorMongoId = vendorDoc.mongoId;
			}
		}

		if (region) {
			where.region = region;
		}

		if (status) {
			where.status = status;
		}

		if (category) {
			where.categoryMongoId = category;
		}

		if (vendor) {
			where.vendorMongoId = vendor;
		}

		// Full-text search in Prisma (depends on DB configuration, using simple contains for now)
		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{ tags: { has: search } }
			];
		}

		if (minPrice || maxPrice) {
			where.price = {};
			if (minPrice) where.price.gte = Number.parseFloat(minPrice);
			if (maxPrice) where.price.lte = Number.parseFloat(maxPrice);
		}

		const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

		const [products, total] = await Promise.all([
			prisma.product.findMany({
				where,
				include: {
					vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
					category: { select: { name: true, slug: true, mongoId: true } },
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take: Number.parseInt(limit),
			}),
			prisma.product.count({ where }),
		]);

		// Map products back to Mongoose-like structure for the frontend
		const mappedProducts = products.map(p => ({
			...mapProductForResponse(p),
			vendor: { ...p.vendor, _id: p.vendor.mongoId },
			category: { ...p.category, _id: p.category.mongoId },
		}));

		res.json(
			successResponse(mappedProducts, {
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

export const getProduct = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Find by mongoId or UUID? Usually frontend sends mongoId during transition.
		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] },
			include: {
				vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
				category: { select: { name: true, slug: true, mongoId: true } },
			}
		});

		if (!product) {
			return res
				.status(404)
				.json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
		}

		// Check permissions for non-approved products
		if (product.status !== PRODUCT_STATUS.APPROVED) {
			if (req.user.role === "vendor") {
				const vendor = await prisma.vendor.findFirst({
					where: { ownerMongoId: req.user.id }
				});
				if (
					!vendor ||
					product.vendorMongoId !== vendor.mongoId
				) {
					return res
						.status(403)
						.json(
							errorResponse(
								"FORBIDDEN",
								"You do not have permission to view this product"
							)
						);
				}
			} else if (req.user.role !== "admin" && req.user.role !== "super_admin") {
				return res
					.status(403)
					.json(errorResponse("FORBIDDEN", "Product is not approved"));
			}
		}

		// Increment views with Redis deduplication
		try {
			const viewerIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
			const dedupeKey = `view:product:${product.mongoId}:ip:${viewerIp}`;
			const isNew = await redisClient.set(dedupeKey, "1", { NX: true, EX: 3600 });
			if (isNew) {
				await prisma.product.update({
					where: { id: product.id },
					data: { metaViews: { increment: 1 } }
				});
				product.metaViews += 1;
			}
		} catch (redisErr) {
			logger.warn("Redis view dedup failed, skipping increment:", redisErr?.message);
		}

		res.json(successResponse({
			...mapProductForResponse(product),
			vendor: { ...product.vendor, _id: product.vendor.mongoId },
			category: { ...product.category, _id: product.category.mongoId },
			meta: { views: product.metaViews, sales: product.metaSales }
		}));
	} catch (error) {
		next(error);
	}
};

export const updateProduct = async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			productType,
			name,
			description,
			category,
			price,
			priceMin,
			priceMax,
			duration,
			videoUrl,
			discountPrice,
			promo,
			stock,
			images,
			tags,
			variants,
		} = req.body;

		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!product) {
			return res
				.status(404)
				.json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
		}

		// Check ownership for vendors
		if (req.user.role === "vendor") {
			const vendor = await prisma.vendor.findFirst({
				where: { ownerMongoId: req.user.id }
			});
			if (!vendor || product.vendorMongoId !== vendor.mongoId) {
				return res
					.status(403)
					.json(
						errorResponse(
							"FORBIDDEN",
							"You do not have permission to update this product"
						)
					);
			}
		}

		// Prepare update data
		const updateData = {};
		const existingType = detectProductType(product);
		const safeType = productType === "service" || existingType === "service" ? "service" : "product";
		const currentServiceMeta = extractServiceMeta(product) || {};
		const hasIncomingImages = Array.isArray(images);
		const nextImages = hasIncomingImages ? images : product.images || [];
		const numericPrice = price !== undefined && price !== null ? Number(price) : undefined;
		const numericPriceMin = priceMin !== undefined && priceMin !== null ? Number(priceMin) : undefined;
		const numericPriceMax = priceMax !== undefined && priceMax !== null ? Number(priceMax) : undefined;
		const nextDuration = duration ?? currentServiceMeta.duration;
		const nextVideoUrl = videoUrl ?? currentServiceMeta.videoUrl;

		if (name) updateData.name = name;
		if (description) updateData.description = description;
		if (category) {
			const categoryExists = await prisma.category.findUnique({
				where: { mongoId: category }
			});
			if (!categoryExists) {
				return res
					.status(400)
					.json(errorResponse("INVALID_CATEGORY", "Category does not exist"));
			}
			updateData.categoryMongoId = category;
		}
		if (safeType === "service") {
			if ((nextImages || []).length < 2) {
				return res
					.status(400)
					.json(errorResponse("INVALID_SERVICE_IMAGES", "Services require at least 2 images"));
			}
			if (!nextDuration) {
				return res
					.status(400)
					.json(errorResponse("MISSING_DURATION", "Duration is required for a service"));
			}
			if (!nextVideoUrl) {
				return res
					.status(400)
					.json(errorResponse("MISSING_VIDEO_URL", "Video link is required for a service"));
			}

			const fallbackPrice = Number(product.price);
			const serviceHasFixedPrice = Number.isFinite(numericPrice);
			const serviceHasRange = Number.isFinite(numericPriceMin) && Number.isFinite(numericPriceMax);
			const resolvedMin = serviceHasRange
				? numericPriceMin
				: serviceHasFixedPrice
				? numericPrice
				: Number.isFinite(currentServiceMeta.priceMin)
				? Number(currentServiceMeta.priceMin)
				: fallbackPrice;
			const resolvedMax = serviceHasRange
				? numericPriceMax
				: serviceHasFixedPrice
				? numericPrice
				: Number.isFinite(currentServiceMeta.priceMax)
				? Number(currentServiceMeta.priceMax)
				: fallbackPrice;

			if (!Number.isFinite(resolvedMin) || !Number.isFinite(resolvedMax)) {
				return res
					.status(400)
					.json(
						errorResponse(
							"MISSING_PRICE",
							"A service requires either a single price or a price range"
						)
					);
			}

			if (resolvedMin > resolvedMax) {
				return res
					.status(400)
					.json(errorResponse("INVALID_PRICE_RANGE", "priceMin cannot be greater than priceMax"));
			}

			updateData.price = resolvedMin;
			updateData.stock = 1;
			updateData.variants = {
				kind: "service",
				duration: nextDuration,
				videoUrl: nextVideoUrl,
				priceMode: resolvedMin !== resolvedMax ? "range" : "fixed",
				priceMin: resolvedMin,
				priceMax: resolvedMax,
			};
		} else if (price !== undefined) {
			updateData.price = price;
		}

		if (discountPrice !== undefined) updateData.discountPrice = discountPrice;
		if (promo) {
			updateData.promoStart = promo.start;
			updateData.promoEnd = promo.end;
		}
		if (safeType !== "service" && stock !== undefined) updateData.stock = stock;
		if (images) updateData.images = images;
		if (tags) updateData.tags = withTypeTag(tags, safeType);
		else updateData.tags = withTypeTag(product.tags, safeType);
		if (safeType !== "service" && variants) updateData.variants = variants;

		// If product was approved and vendor updates it, set back to pending
		if (
			req.user.role === "vendor" &&
			product.status === PRODUCT_STATUS.APPROVED
		) {
			updateData.status = PRODUCT_STATUS.PENDING;
			updateData.rejectionNote = null;
		}

		const updatedProduct = await prisma.product.update({
			where: { id: product.id },
			data: updateData
		});

		logger.info(`Product updated: ${updatedProduct.id}`);

		res.json(successResponse({
			...mapProductForResponse(updatedProduct),
		}));
	} catch (error) {
		next(error);
	}
};

export const deleteProduct = async (req, res, next) => {
	try {
		const { id } = req.params;

		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!product) {
			return res
				.status(404)
				.json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
		}

		// Check ownership for vendors
		if (req.user.role === "vendor") {
			const vendor = await prisma.vendor.findFirst({
				where: { ownerMongoId: req.user.id }
			});
			if (!vendor || product.vendorMongoId !== vendor.mongoId) {
				return res
					.status(403)
					.json(
						errorResponse(
							"FORBIDDEN",
							"You do not have permission to delete this product"
						)
					);
			}
		}

		await prisma.product.delete({
			where: { id: product.id }
		});

		logger.info(`Product deleted: ${id}`);

		res.json(successResponse({ message: "Product deleted successfully" }));
	} catch (error) {
		next(error);
	}
};

export const approveProduct = async (req, res, next) => {
	try {
		const { id } = req.params;

		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!product) {
			return res
				.status(404)
				.json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
		}

		const updatedProduct = await prisma.product.update({
			where: { id: product.id },
			data: {
				status: PRODUCT_STATUS.APPROVED,
				rejectionNote: null
			}
		});

		logger.info(`Product approved: ${id} by ${req.user.email}`);

		res.json(successResponse({
			...updatedProduct,
			_id: updatedProduct.mongoId,
		}));
	} catch (error) {
		next(error);
	}
};

export const rejectProduct = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { rejectionNote } = req.body;

		if (!rejectionNote) {
			return res
				.status(400)
				.json(errorResponse("MISSING_NOTE", "Rejection note is required"));
		}

		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!product) {
			return res
				.status(404)
				.json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
		}

		const updatedProduct = await prisma.product.update({
			where: { id: product.id },
			data: {
				status: PRODUCT_STATUS.REJECTED,
				rejectionNote: rejectionNote
			}
		});

		logger.info(`Product rejected: ${id} by ${req.user.email}`);

		res.json(successResponse({
			...updatedProduct,
			_id: updatedProduct.mongoId,
		}));
	} catch (error) {
		next(error);
	}
};

export const trackView = async (req, res, next) => {
	try {
		const { id } = req.params;

		const product = await prisma.product.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] },
			select: { id: true, mongoId: true, status: true }
		});

		if (!product || product.status !== PRODUCT_STATUS.APPROVED) {
			return res.json(successResponse({ counted: false }));
		}

		const viewerIp =
			req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
			req.ip ||
			"unknown";
		const dedupeKey = `view:product:${product.mongoId}:ip:${viewerIp}`;

		let counted = false;
		try {
			const isNew = await redisClient.set(dedupeKey, "1", { NX: true, EX: 3600 });
			if (isNew) {
				await prisma.product.update({
					where: { id: product.id },
					data: { metaViews: { increment: 1 } }
				});
				counted = true;
			}
		} catch (redisErr) {
			logger.warn("Redis view dedup unavailable, counting anyway:", redisErr?.message);
			await prisma.product.update({
				where: { id: product.id },
				data: { metaViews: { increment: 1 } }
			});
			counted = true;
		}

		return res.json(successResponse({ counted }));
	} catch (error) {
		next(error);
	}
};

export const getProductAnalytics = async (req, res, next) => {
	try {
		const vendor = await prisma.vendor.findFirst({
			where: { ownerMongoId: req.user.id }
		});
		if (!vendor) {
			return res
				.status(404)
				.json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
		}

		const products = await prisma.product.findMany({
			where: { vendorMongoId: vendor.mongoId },
			select: {
				mongoId: true,
				name: true,
				price: true,
				stock: true,
				status: true,
				metaViews: true,
				metaSales: true,
				createdAt: true,
				category: { select: { name: true } },
			},
			orderBy: { metaViews: 'desc' },
		});

		const analytics = products.map((p) => ({
			_id: p.mongoId,
			name: p.name,
			category: p.category?.name || "—",
			price: p.price,
			stock: p.stock,
			status: p.status,
			views: p.metaViews,
			sales: p.metaSales,
			createdAt: p.createdAt,
		}));

		const totals = analytics.reduce(
			(acc, p) => { acc.views += p.views; acc.sales += p.sales; return acc; },
			{ views: 0, sales: 0 }
		);

		return res.json(successResponse({ products: analytics, totals }));
	} catch (error) {
		next(error);
	}
};
