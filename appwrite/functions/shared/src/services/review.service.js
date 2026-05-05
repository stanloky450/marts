const { prisma } = require("../db/prisma");
const { sendSuccess, sendError } = require("../http/response");

const REVIEW_FEATURE_KEY = "feature_reviews_enabled";
const REVIEW_VENDOR_PREFIX = "review:vendor:";
const REVIEW_PRODUCT_PREFIX = "review:product:";

function normalize(v) {
  return String(v || "").trim();
}

async function getFeatureEnabled() {
  const setting = await prisma.setting.findUnique({ where: { key: REVIEW_FEATURE_KEY } });
  if (!setting) return true;
  return setting.value !== false;
}

async function ensureReviewEnabled(res) {
  const enabled = await getFeatureEnabled();
  if (!enabled) return sendError(res, 403, "FEATURE_DISABLED", "Reviews are currently disabled");
  return null;
}

function buildSummary(items) {
  const count = items.length;
  if (count === 0) return { count: 0, averageRating: 0 };
  const total = items.reduce((acc, row) => acc + Number(row.rating || 0), 0);
  return { count, averageRating: Number((total / count).toFixed(1)) };
}

async function listByPrefix(prefix) {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: prefix } },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => (typeof row.value === "object" ? row.value : null)).filter(Boolean);
}

async function ensureActiveMarketUserFromHeaders({ ctx, res }) {
  const marketUserId = normalize(ctx.headers["x-market-user-id"]);
  const marketUserName = normalize(ctx.headers["x-market-user-name"]);
  const marketUserEmail = normalize(ctx.headers["x-market-user-email"]).toLowerCase();
  if (!marketUserId || !marketUserEmail) {
    sendError(res, 401, "UNAUTHORIZED", "Market user session is required");
    return null;
  }

  const marketUser = await prisma.marketUser.findFirst({
    where: { mongoId: marketUserId, email: marketUserEmail },
  });
  if (!marketUser) {
    sendError(res, 404, "USER_NOT_FOUND", "User session could not be validated");
    return null;
  }
  if (marketUser.status !== "active") {
    sendError(res, 403, "ACCOUNT_SUSPENDED", "Your user account is suspended");
    return null;
  }

  return {
    marketUserId: marketUser.mongoId,
    marketUserName: marketUserName || marketUser.fullName,
    marketUserEmail,
  };
}

async function listVendorReviews({ ctx, res }) {
  const disabled = await ensureReviewEnabled(res);
  if (disabled) return disabled;
  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const items = await listByPrefix(`${REVIEW_VENDOR_PREFIX}${vendorMongoId}:`);
  return sendSuccess(res, { reviews: items, summary: buildSummary(items) });
}

async function listProductReviews({ ctx, res }) {
  const disabled = await ensureReviewEnabled(res);
  if (disabled) return disabled;
  const productMongoId = normalize(ctx.params.productMongoId);
  const items = await listByPrefix(`${REVIEW_PRODUCT_PREFIX}${productMongoId}:`);
  return sendSuccess(res, { reviews: items, summary: buildSummary(items) });
}

async function upsertVendorReview({ ctx, res }) {
  const disabled = await ensureReviewEnabled(res);
  if (disabled) return disabled;
  const marketUser = await ensureActiveMarketUserFromHeaders({ ctx, res });
  if (!marketUser) return null;

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const rating = Number(ctx.body?.rating);
  const feedback = normalize(ctx.body?.feedback);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return sendError(res, 400, "INVALID_RATING", "Rating must be between 1 and 5");
  }
  if (feedback.length < 3) {
    return sendError(res, 400, "INVALID_FEEDBACK", "Feedback must be at least 3 characters");
  }

  const vendor = await prisma.vendor.findFirst({ where: { mongoId: vendorMongoId } });
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor not found");

  const key = `${REVIEW_VENDOR_PREFIX}${vendorMongoId}:${marketUser.marketUserId}`;
  const current = await prisma.setting.findUnique({ where: { key } });
  const ts = new Date().toISOString();
  const payload = {
    id: `vr_${vendorMongoId}_${marketUser.marketUserId}`,
    targetType: "vendor",
    vendorMongoId,
    rating: Math.round(rating),
    feedback,
    marketUserId: marketUser.marketUserId,
    marketUserName: marketUser.marketUserName || "Market User",
    marketUserEmail: marketUser.marketUserEmail || "",
    createdAt: current?.value?.createdAt || ts,
    updatedAt: ts,
  };

  await prisma.setting.upsert({
    where: { key },
    update: { value: payload },
    create: { key, value: payload },
  });

  return sendSuccess(res, payload, null, current ? 200 : 201);
}

async function upsertProductReview({ ctx, res }) {
  const disabled = await ensureReviewEnabled(res);
  if (disabled) return disabled;
  const marketUser = await ensureActiveMarketUserFromHeaders({ ctx, res });
  if (!marketUser) return null;

  const productMongoId = normalize(ctx.params.productMongoId);
  const rating = Number(ctx.body?.rating);
  const feedback = normalize(ctx.body?.feedback);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return sendError(res, 400, "INVALID_RATING", "Rating must be between 1 and 5");
  }
  if (feedback.length < 3) {
    return sendError(res, 400, "INVALID_FEEDBACK", "Feedback must be at least 3 characters");
  }

  const product = await prisma.product.findFirst({ where: { mongoId: productMongoId } });
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  const key = `${REVIEW_PRODUCT_PREFIX}${productMongoId}:${marketUser.marketUserId}`;
  const current = await prisma.setting.findUnique({ where: { key } });
  const ts = new Date().toISOString();
  const payload = {
    id: `pr_${productMongoId}_${marketUser.marketUserId}`,
    targetType: "product",
    productMongoId,
    vendorMongoId: product.vendorMongoId,
    rating: Math.round(rating),
    feedback,
    marketUserId: marketUser.marketUserId,
    marketUserName: marketUser.marketUserName || "Market User",
    marketUserEmail: marketUser.marketUserEmail || "",
    createdAt: current?.value?.createdAt || ts,
    updatedAt: ts,
  };

  await prisma.setting.upsert({
    where: { key },
    update: { value: payload },
    create: { key, value: payload },
  });

  return sendSuccess(res, payload, null, current ? 200 : 201);
}

module.exports = {
  listVendorReviews,
  listProductReviews,
  upsertVendorReview,
  upsertProductReview,
};
