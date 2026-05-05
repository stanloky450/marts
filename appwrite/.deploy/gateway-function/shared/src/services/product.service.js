const crypto = require("crypto");
const { z } = require("zod");
const { prisma } = require("../db/prisma");
const { requireAuth, requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { buildPagination, buildDataTableMeta } = require("../http/request");
const { getProductRepository } = require("../repositories/product.repository");
const { USER_ROLES, PRODUCT_STATUS } = require("../constants");

const PRODUCT_TYPE_TAG_PREFIX = "__type:";

const createSchema = z.object({
  productType: z.enum(["product", "service"]).optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(1),
  price: z.number().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  duration: z.string().optional(),
  videoUrl: z.string().url().optional(),
  discountPrice: z.number().optional(),
  promo: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
  stock: z.number().optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  variants: z.any().optional(),
});

const rejectSchema = z.object({
  rejectionNote: z.string().min(10),
});

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
  };
}

async function createProduct({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;

  const body = createSchema.parse(ctx.body);
  const vendor = await prisma.vendor.findFirst({
    where: { ownerMongoId: auth.user.mongoId },
  });

  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const categoryExists = await prisma.category.findUnique({
    where: { mongoId: body.category },
  });
  if (!categoryExists) return sendError(res, 400, "INVALID_CATEGORY", "Category does not exist");

  const productType = body.productType === "service" ? "service" : "product";
  const images = Array.isArray(body.images) ? body.images : [];
  if (productType === "service" && images.length < 2) {
    return sendError(res, 400, "INVALID_SERVICE_IMAGES", "Services require at least 2 images");
  }

  const price = typeof body.price === "number" ? body.price : typeof body.priceMin === "number" ? body.priceMin : null;
  if (price === null) return sendError(res, 400, "MISSING_PRICE", "Price is required");

  const repo = getProductRepository();
  const created = await repo.createProduct({
    mongoId: crypto.randomBytes(12).toString("hex"),
    vendorMongoId: vendor.mongoId,
    name: body.name,
    description: body.description,
    categoryMongoId: body.category,
    price,
    discountPrice: body.discountPrice,
    promoStart: body.promo?.start,
    promoEnd: body.promo?.end,
    stock: productType === "service" ? 1 : Number(body.stock || 0),
    images,
    tags: withTypeTag(body.tags, productType),
    variants:
      productType === "service"
        ? {
            kind: "service",
            duration: body.duration,
            videoUrl: body.videoUrl,
            priceMin: body.priceMin ?? price,
            priceMax: body.priceMax ?? price,
          }
        : body.variants,
    status: PRODUCT_STATUS.PENDING,
    region: vendor.locationRegion,
  });

  return sendSuccess(res, mapProduct(created), null, 201);
}

async function listProducts({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const isDataTable = "draw" in ctx.query || "start" in ctx.query || "length" in ctx.query;
  const pagination = isDataTable ? buildDataTableMeta(ctx.query) : buildPagination(ctx.query);
  const filters = {
    status: ctx.query.status,
    category: ctx.query.category,
    vendor: ctx.query.vendor,
    search: ctx.query.search,
    minPrice: ctx.query.minPrice,
    maxPrice: ctx.query.maxPrice,
    region: ctx.query.region,
  };

  const repo = getProductRepository();
  const { products, total } = await repo.listProducts({ filters, pagination, actor: auth.user });

  const data = products.map((product) => ({
    ...mapProduct(product),
    vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : undefined,
    category: product.category ? { ...product.category, _id: product.category.mongoId } : undefined,
  }));

  if (isDataTable) {
    return res.json({
      draw: pagination.draw,
      recordsTotal: total,
      recordsFiltered: total,
      data,
    });
  }

  return sendSuccess(res, data, {
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  });
}

async function getProduct({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  if (product.status !== PRODUCT_STATUS.APPROVED) {
    if (![USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(auth.user.role)) {
      if (auth.user.role !== USER_ROLES.VENDOR) {
        return sendError(res, 403, "FORBIDDEN", "Product is not approved");
      }

      const vendor = await prisma.vendor.findFirst({
        where: { ownerMongoId: auth.user.mongoId },
      });

      if (!vendor || vendor.mongoId !== product.vendorMongoId) {
        return sendError(res, 403, "FORBIDDEN", "You do not have permission to view this product");
      }
    }
  }

  return sendSuccess(res, {
    ...mapProduct(product),
    vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
    category: product.category ? { ...product.category, _id: product.category.mongoId } : null,
    meta: { views: product.metaViews || 0, sales: product.metaSales || 0 },
  });
}

async function updateProduct({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  if (auth.user.role === USER_ROLES.VENDOR) {
    const vendor = await prisma.vendor.findFirst({
      where: { ownerMongoId: auth.user.mongoId },
    });
    if (!vendor || vendor.mongoId !== product.vendorMongoId) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to update this product");
    }
  }

  const body = ctx.body || {};
  const updateData = {};
  for (const field of ["name", "description", "discountPrice", "stock"]) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }
  if (body.images) updateData.images = body.images;
  if (body.tags) updateData.tags = withTypeTag(body.tags, body.productType || detectProductType(product));
  if (body.price !== undefined) updateData.price = body.price;
  if (body.promo) {
    updateData.promoStart = body.promo.start;
    updateData.promoEnd = body.promo.end;
  }
  if (auth.user.role === USER_ROLES.VENDOR && product.status === PRODUCT_STATUS.APPROVED) {
    updateData.status = PRODUCT_STATUS.PENDING;
    updateData.rejectionNote = null;
  }

  const updated = await repo.updateProductByDbId(product.id, updateData);
  return sendSuccess(res, mapProduct(updated));
}

async function deleteProduct({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  if (auth.user.role === USER_ROLES.VENDOR) {
    const vendor = await prisma.vendor.findFirst({
      where: { ownerMongoId: auth.user.mongoId },
    });
    if (!vendor || vendor.mongoId !== product.vendorMongoId) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to delete this product");
    }
  }

  await repo.deleteProductByDbId(product.id);
  return sendSuccess(res, { message: "Product deleted successfully" });
}

async function approveProduct({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  const updated = await repo.updateProductByDbId(product.id, {
    status: PRODUCT_STATUS.APPROVED,
    rejectionNote: null,
  });

  return sendSuccess(res, { ...updated, _id: updated.mongoId });
}

async function rejectProduct({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const body = rejectSchema.parse(ctx.body);
  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  const updated = await repo.updateProductByDbId(product.id, {
    status: PRODUCT_STATUS.REJECTED,
    rejectionNote: body.rejectionNote,
  });

  return sendSuccess(res, { ...updated, _id: updated.mongoId });
}

async function suspendProduct({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  const reason = String(ctx.body?.reason || ctx.body?.rejectionNote || "Product suspended").trim();
  const updated = await repo.updateProductByDbId(product.id, {
    status: PRODUCT_STATUS.REJECTED,
    rejectionNote: reason,
  });

  return sendSuccess(res, { ...updated, _id: updated.mongoId });
}

async function trackView({ ctx, res }) {
  const repo = getProductRepository();
  const product = await repo.getProductById(ctx.params.id);
  if (!product || product.status !== PRODUCT_STATUS.APPROVED) {
    return sendSuccess(res, { counted: false });
  }

  await repo.updateProductByDbId(product.id, {
    metaViews: { increment: 1 },
  });

  return sendSuccess(res, { counted: true });
}

async function getProductAnalytics({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;

  const vendor = await prisma.vendor.findFirst({
    where: { ownerMongoId: auth.user.mongoId },
  });
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

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
    orderBy: { metaViews: "desc" },
  });

  const data = products.map((item) => ({
    _id: item.mongoId,
    name: item.name,
    category: item.category?.name || "-",
    price: item.price,
    stock: item.stock,
    status: item.status,
    views: item.metaViews,
    sales: item.metaSales,
    createdAt: item.createdAt,
  }));

  const totals = data.reduce(
    (acc, item) => {
      acc.views += item.views || 0;
      acc.sales += item.sales || 0;
      return acc;
    },
    { views: 0, sales: 0 }
  );

  return sendSuccess(res, { products: data, totals });
}

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  approveProduct,
  rejectProduct,
  suspendProduct,
  trackView,
  getProductAnalytics,
};
