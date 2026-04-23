import { successResponse, errorResponse } from "../utils/apiResponse.js";
import prisma from "../lib/prisma.js";
import { ensureActiveMarketUserFromHeaders } from "../utils/market-user.js";

const REVIEW_FEATURE_KEY = "feature_reviews_enabled";
const REVIEW_VENDOR_PREFIX = "review:vendor:";
const REVIEW_PRODUCT_PREFIX = "review:product:";

const normalize = (v) => String(v || "").trim();

const getFeatureEnabled = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: REVIEW_FEATURE_KEY } });
  if (!setting) return true;
  return setting.value !== false;
};

const ensureReviewEnabled = async (res) => {
  const enabled = await getFeatureEnabled();
  if (!enabled) {
    res.status(403).json(errorResponse("FEATURE_DISABLED", "Reviews are currently disabled"));
    return false;
  }
  return true;
};

const buildSummary = (items) => {
  const count = items.length;
  if (count === 0) return { count: 0, averageRating: 0 };
  const total = items.reduce((acc, r) => acc + Number(r.rating || 0), 0);
  return { count, averageRating: Number((total / count).toFixed(1)) };
};

const listByPrefix = async (prefix) => {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: prefix } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => (typeof row.value === "object" ? row.value : null))
    .filter(Boolean);
};

export const listVendorReviews = async (req, res, next) => {
  try {
    if (!(await ensureReviewEnabled(res))) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    const items = await listByPrefix(`${REVIEW_VENDOR_PREFIX}${vendorMongoId}:`);
    res.json(successResponse({ reviews: items, summary: buildSummary(items) }));
  } catch (error) {
    next(error);
  }
};

export const listProductReviews = async (req, res, next) => {
  try {
    if (!(await ensureReviewEnabled(res))) return;
    const productMongoId = normalize(req.params.productMongoId);
    const items = await listByPrefix(`${REVIEW_PRODUCT_PREFIX}${productMongoId}:`);
    res.json(successResponse({ reviews: items, summary: buildSummary(items) }));
  } catch (error) {
    next(error);
  }
};

export const upsertVendorReview = async (req, res, next) => {
  try {
    if (!(await ensureReviewEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;

    const vendorMongoId = normalize(req.params.vendorMongoId);
    const rating = Number(req.body.rating);
    const feedback = normalize(req.body.feedback);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json(errorResponse("INVALID_RATING", "Rating must be between 1 and 5"));
    }
    if (feedback.length < 3) {
      return res.status(400).json(errorResponse("INVALID_FEEDBACK", "Feedback must be at least 3 characters"));
    }

    const vendor = await prisma.vendor.findFirst({ where: { mongoId: vendorMongoId } });
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor not found"));
    }

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

    res.status(current ? 200 : 201).json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

export const upsertProductReview = async (req, res, next) => {
  try {
    if (!(await ensureReviewEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;

    const productMongoId = normalize(req.params.productMongoId);
    const rating = Number(req.body.rating);
    const feedback = normalize(req.body.feedback);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json(errorResponse("INVALID_RATING", "Rating must be between 1 and 5"));
    }
    if (feedback.length < 3) {
      return res.status(400).json(errorResponse("INVALID_FEEDBACK", "Feedback must be at least 3 characters"));
    }

    const product = await prisma.product.findFirst({ where: { mongoId: productMongoId } });
    if (!product) {
      return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"));
    }

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

    res.status(current ? 200 : 201).json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};
