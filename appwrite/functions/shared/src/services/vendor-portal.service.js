const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES, PRODUCT_STATUS } = require("../constants");

const PRODUCT_TYPE_TAG_PREFIX = "__type:";

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

function withTypeTag(tags, type) {
  const base = Array.isArray(tags)
    ? tags.filter((item) => typeof item === "string" && !item.startsWith(PRODUCT_TYPE_TAG_PREFIX))
    : [];
  return [...base, `${PRODUCT_TYPE_TAG_PREFIX}${type}`];
}

function detectProductType(product) {
  const tags = Array.isArray(product?.tags) ? product.tags : [];
  const tagged = tags.find((item) => typeof item === "string" && item.startsWith(PRODUCT_TYPE_TAG_PREFIX));
  if (tagged === `${PRODUCT_TYPE_TAG_PREFIX}service`) return "service";
  return "product";
}

function extractServiceMeta(product) {
  const variants = product?.variants;
  if (variants && typeof variants === "object" && !Array.isArray(variants) && variants.kind === "service") {
    return variants;
  }
  return null;
}

function mapProduct(product) {
  const productType = detectProductType(product);
  const serviceMeta = extractServiceMeta(product);
  return {
    ...product,
    _id: product.mongoId,
    productType,
    duration: productType === "service" ? serviceMeta?.duration : undefined,
    videoUrl: productType === "service" ? serviceMeta?.videoUrl : undefined,
    priceMin: productType === "service" ? serviceMeta?.priceMin : undefined,
    priceMax: productType === "service" ? serviceMeta?.priceMax : undefined,
    category: product.category ? { ...product.category, _id: product.category.mongoId } : product.categoryMongoId,
  };
}

function mapVendor(vendor, extra = {}) {
  return {
    ...vendor,
    ...extra,
    _id: vendor.mongoId,
    userId: vendor.ownerMongoId,
    phoneNumber: vendor.phoneNumber || vendor.phone || "",
    isApproved: vendor.status === "active",
    isPaid: Boolean(vendor.payments && vendor.payments.length > 0),
    registrationFee: extra.registrationFee || 0,
    socials: vendor.socials || undefined,
    address: vendor.address || undefined,
    location: vendor.location || undefined,
  };
}

async function requireVendorRecord({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth;

  const vendor = await prisma.vendor.findFirst({
    where: { ownerMongoId: auth.user.mongoId },
    include: {
      payments: {
        where: { status: "success", type: "registration" },
        select: { id: true, amount: true },
        take: 1,
      },
    },
  });
  if (!vendor) {
    return {
      ok: false,
      response: sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found"),
    };
  }

  const registrationFee = vendor.payments?.[0]?.amount ? Number(vendor.payments[0].amount) : 0;
  return { ok: true, user: auth.user, vendor, registrationFee };
}

async function getVendorProfile({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const productStats = await prisma.product.groupBy({
    by: ["status"],
    where: { vendorMongoId: resolved.vendor.mongoId },
    _count: { _all: true },
  });

  const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of productStats) {
    const key = String(row.status || "").toLowerCase();
    if (key in stats) stats[key] = row._count._all;
    stats.total += row._count._all;
  }

  return sendSuccess(res, {
    vendor: mapVendor(resolved.vendor, { registrationFee: resolved.registrationFee }),
    stats,
  });
}

async function updateVendorProfile({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const body = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
  const updateData = {};

  for (const field of ["businessName", "description", "subdomain", "bannerImage", "logoUrl", "profilePhotoUrl", "phoneNumber", "whatsappNumber"]) {
    if (body[field] !== undefined) updateData[field] = body[field] || null;
  }

  if (body.themeColor !== undefined) updateData.themeColor = body.themeColor;

  if (body.socials && typeof body.socials === "object") {
    updateData.socials = { ...(resolved.vendor.socials || {}), ...body.socials };
  }

  if (body.address && typeof body.address === "object") {
    updateData.address = { ...(resolved.vendor.address || {}), ...body.address };
  }

  const updated = await prisma.vendor.update({
    where: { id: resolved.vendor.id },
    data: updateData,
    include: {
      payments: {
        where: { status: "success", type: "registration" },
        select: { id: true, amount: true },
        take: 1,
      },
    },
  });

  const registrationFee = updated.payments?.[0]?.amount ? Number(updated.payments[0].amount) : 0;
  return sendSuccess(res, mapVendor(updated, { registrationFee }));
}

async function getVendorDashboardStats({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const vendorMongoId = resolved.vendor.mongoId;

  const [totalViewsResult, totalRevenueResult, approvedProducts, recentProducts] = await Promise.all([
    prisma.product.aggregate({ where: { vendorMongoId }, _sum: { metaViews: true } }),
    prisma.payment.aggregate({ where: { vendorMongoId, status: "success" }, _sum: { amount: true } }),
    prisma.product.count({ where: { vendorMongoId, status: PRODUCT_STATUS.APPROVED } }),
    prisma.product.count({ where: { vendorMongoId, createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })() } } }),
  ]);

  return sendSuccess(res, {
    totals: {
      products: approvedProducts,
      revenue: Number(totalRevenueResult._sum.amount || 0),
      views: Number(totalViewsResult._sum.metaViews || 0),
    },
    recent: {
      products: recentProducts,
    },
  });
}

async function listVendorProducts({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;

  const where = { vendorMongoId: resolved.vendor.mongoId };
  if (ctx.query.status) where.status = ctx.query.status;
  if (ctx.query.category) where.categoryMongoId = ctx.query.category;
  if (ctx.query.search) {
    where.OR = [
      { name: { contains: String(ctx.query.search), mode: "insensitive" } },
      { description: { contains: String(ctx.query.search), mode: "insensitive" } },
      { sku: { contains: String(ctx.query.search), mode: "insensitive" } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { mongoId: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return sendSuccess(
    res,
    products.map(mapProduct),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function createVendorProduct({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const body = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
  const name = String(body.name || "").trim();
  const categoryMongoId = String(body.category || body.categoryId || "").trim();
  const productType = body.productType === "service" ? "service" : "product";

  if (name.length < 2) return sendError(res, 400, "INVALID_INPUT", "Name is required");
  if (!categoryMongoId) return sendError(res, 400, "INVALID_INPUT", "Category is required");

  const categoryExists = await prisma.category.findUnique({ where: { mongoId: categoryMongoId } });
  if (!categoryExists) return sendError(res, 400, "INVALID_CATEGORY", "Category does not exist");

  const images = toStringArray(body.images);
  if (productType === "service" && images.length < 2) {
    return sendError(res, 400, "INVALID_SERVICE_IMAGES", "Services require at least 2 images");
  }

  const priceMin = body.priceMin !== undefined ? Number(body.priceMin) : undefined;
  const priceMax = body.priceMax !== undefined ? Number(body.priceMax) : undefined;
  const price = body.price !== undefined ? Number(body.price) : Number.isFinite(priceMin) ? priceMin : null;
  if (price === null || !Number.isFinite(price) || price < 0) return sendError(res, 400, "MISSING_PRICE", "Price is required");

  const variants =
    productType === "service"
      ? {
          kind: "service",
          duration: body.duration ? String(body.duration) : undefined,
          videoUrl: body.videoUrl ? String(body.videoUrl) : undefined,
          priceMin: Number.isFinite(priceMin) ? priceMin : price,
          priceMax: Number.isFinite(priceMax) ? priceMax : Number.isFinite(priceMin) ? priceMin : price,
        }
      : body.variants;

  const created = await prisma.product.create({
    data: {
      mongoId: makeMongoId(),
      vendorMongoId: resolved.vendor.mongoId,
      name,
      description: body.description ? String(body.description) : null,
      categoryMongoId,
      region: resolved.vendor.locationRegion || null,
      price,
      discountPrice: body.discountPrice !== undefined ? Number(body.discountPrice) : null,
      promoStart: body.promo?.start ? new Date(body.promo.start) : body.promoStart ? new Date(body.promoStart) : null,
      promoEnd: body.promo?.end ? new Date(body.promo.end) : body.promoEnd ? new Date(body.promoEnd) : null,
      sku: body.sku ? String(body.sku) : null,
      stock: productType === "service" ? 1 : Number(body.stock || 0),
      images,
      tags: withTypeTag(body.tags, productType),
      variants,
      status: PRODUCT_STATUS.PENDING,
    },
    include: { category: { select: { mongoId: true, name: true, slug: true } } },
  });

  return sendSuccess(res, mapProduct(created), null, 201);
}

async function updateVendorProduct({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const body = ctx.body && typeof ctx.body === "object" ? ctx.body : {};

  const product = await prisma.product.findFirst({
    where: { mongoId: ctx.params.id, vendorMongoId: resolved.vendor.mongoId },
    include: { category: { select: { mongoId: true, name: true, slug: true } } },
  });
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  const updateData = {};
  for (const field of ["name", "description", "sku", "discountPrice"]) {
    if (body[field] !== undefined) updateData[field] = body[field] === "" ? null : body[field];
  }

  if (body.category || body.categoryId) {
    const categoryMongoId = String(body.category || body.categoryId || "").trim();
    const categoryExists = await prisma.category.findUnique({ where: { mongoId: categoryMongoId } });
    if (!categoryExists) return sendError(res, 400, "INVALID_CATEGORY", "Category does not exist");
    updateData.categoryMongoId = categoryMongoId;
  }

  if (body.images !== undefined) updateData.images = toStringArray(body.images);
  if (body.tags !== undefined || body.productType !== undefined) {
    const type = body.productType === "service" ? "service" : body.productType === "product" ? "product" : detectProductType(product);
    updateData.tags = withTypeTag(body.tags, type);
  }

  if (body.price !== undefined) updateData.price = Number(body.price);
  if (body.stock !== undefined) updateData.stock = Number(body.stock);
  if (body.promo) {
    updateData.promoStart = body.promo.start ? new Date(body.promo.start) : null;
    updateData.promoEnd = body.promo.end ? new Date(body.promo.end) : null;
  }

  if (body.productType === "service" || (body.variants && body.variants.kind === "service")) {
    const priceMin = body.priceMin !== undefined ? Number(body.priceMin) : undefined;
    const priceMax = body.priceMax !== undefined ? Number(body.priceMax) : undefined;
    const price = body.price !== undefined ? Number(body.price) : Number.isFinite(priceMin) ? priceMin : Number(product.price);
    updateData.price = price;
    updateData.stock = 1;
    updateData.variants = {
      kind: "service",
      duration: body.duration ? String(body.duration) : undefined,
      videoUrl: body.videoUrl ? String(body.videoUrl) : undefined,
      priceMin: Number.isFinite(priceMin) ? priceMin : price,
      priceMax: Number.isFinite(priceMax) ? priceMax : Number.isFinite(priceMin) ? priceMin : price,
    };
  } else if (body.variants !== undefined) {
    updateData.variants = body.variants;
  }

  // Any vendor edit to an approved product should re-enter review.
  if (product.status === PRODUCT_STATUS.APPROVED) {
    updateData.status = PRODUCT_STATUS.PENDING;
    updateData.rejectionNote = null;
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: updateData,
    include: { category: { select: { mongoId: true, name: true, slug: true } } },
  });

  return sendSuccess(res, mapProduct(updated));
}

async function deleteVendorProduct({ ctx, res }) {
  const resolved = await requireVendorRecord({ ctx, res });
  if (!resolved.ok) return resolved.response;

  const product = await prisma.product.findFirst({
    where: { mongoId: ctx.params.id, vendorMongoId: resolved.vendor.mongoId },
  });
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  await prisma.product.delete({ where: { id: product.id } });
  return sendSuccess(res, { message: "Product deleted successfully" });
}

module.exports = {
  getVendorProfile,
  updateVendorProfile,
  getVendorDashboardStats,
  listVendorProducts,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
};

