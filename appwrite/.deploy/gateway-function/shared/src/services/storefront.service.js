const { prisma } = require("../db/prisma");
const { sendSuccess, sendError } = require("../http/response");
const { PRODUCT_STATUS } = require("../constants");

const PRODUCT_TYPE_TAG_PREFIX = "__type:";

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

function mapStoreProduct(product) {
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
    category: product.category ? { ...product.category, _id: product.category.mongoId } : null,
  };
}

async function resolveVendorBySubdomain(headers, query) {
  const subdomain = headers["x-store-subdomain"] || headers["x-subdomain"] || query.subdomain;
  if (!subdomain) return null;

  return prisma.vendor.findFirst({
    where: {
      subdomain: subdomain.toLowerCase(),
      status: "active",
    },
  });
}

async function listAllStores({ ctx, res }) {
  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where: { status: "active" },
      select: {
        mongoId: true,
        businessName: true,
        description: true,
        subdomain: true,
        logoUrl: true,
        profilePhotoUrl: true,
        _count: { select: { products: { where: { status: PRODUCT_STATUS.APPROVED } } } },
      },
      orderBy: { businessName: "asc" },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where: { status: "active" } }),
  ]);

  return sendSuccess(
    res,
    vendors.map((vendor) => ({
      _id: vendor.mongoId,
      ...vendor,
      productCount: vendor._count.products,
    })),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function searchStores({ ctx, res }) {
  if (!ctx.query.search) return sendError(res, 400, "MISSING_SEARCH", "Search query is required");

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = {
    status: "active",
    OR: [
      { businessName: { contains: ctx.query.search, mode: "insensitive" } },
      { description: { contains: ctx.query.search, mode: "insensitive" } },
    ],
  };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      select: {
        mongoId: true,
        businessName: true,
        description: true,
        subdomain: true,
        logoUrl: true,
        profilePhotoUrl: true,
        _count: { select: { products: { where: { status: PRODUCT_STATUS.APPROVED } } } },
      },
      orderBy: { businessName: "asc" },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where }),
  ]);

  return sendSuccess(
    res,
    vendors.map((vendor) => ({
      _id: vendor.mongoId,
      ...vendor,
      productCount: vendor._count.products,
    })),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function getStoreInfo({ ctx, res }) {
  const vendor = await resolveVendorBySubdomain(ctx.headers, ctx.query);
  if (!vendor) return sendError(res, 400, "SUBDOMAIN_REQUIRED", "Store subdomain is required");

  const [productCount, productCategories] = await Promise.all([
    prisma.product.count({
      where: { vendorMongoId: vendor.mongoId, status: PRODUCT_STATUS.APPROVED },
    }),
    prisma.product.findMany({
      where: { vendorMongoId: vendor.mongoId, status: PRODUCT_STATUS.APPROVED },
      distinct: ["categoryMongoId"],
      select: { categoryMongoId: true },
    }),
  ]);

  const categories = await prisma.category.findMany({
    where: { mongoId: { in: productCategories.map((item) => item.categoryMongoId).filter(Boolean) } },
    select: { name: true, slug: true, icon: true, mongoId: true },
  });

  return sendSuccess(res, {
    mongoId: vendor.mongoId,
    businessName: vendor.businessName,
    description: vendor.description,
    subdomain: vendor.subdomain,
    logoUrl: vendor.logoUrl,
    profilePhotoUrl: vendor.profilePhotoUrl,
    phone: vendor.phone || vendor.phoneNumber,
    whatsapp: vendor.whatsapp || vendor.whatsappNumber,
    socials: vendor.socials,
    address: vendor.address,
    bannerImage: vendor.bannerImage,
    themeColor: vendor.themeColor,
    productCount,
    categories: categories.map((category) => ({ ...category, _id: category.mongoId })),
  });
}

async function getStoreProducts({ ctx, res }) {
  const vendor = await resolveVendorBySubdomain(ctx.headers, ctx.query);
  if (!vendor) return sendError(res, 400, "SUBDOMAIN_REQUIRED", "Store subdomain is required");

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = { vendorMongoId: vendor.mongoId, status: PRODUCT_STATUS.APPROVED };

  if (ctx.query.category) where.categoryMongoId = ctx.query.category;
  if (ctx.query.search) {
    where.OR = [
      { name: { contains: ctx.query.search, mode: "insensitive" } },
      { description: { contains: ctx.query.search, mode: "insensitive" } },
    ];
  }
  if (ctx.query.minPrice || ctx.query.maxPrice) {
    where.price = {};
    if (ctx.query.minPrice) where.price.gte = Number(ctx.query.minPrice);
    if (ctx.query.maxPrice) where.price.lte = Number(ctx.query.maxPrice);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { name: true, slug: true, mongoId: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return sendSuccess(res, products.map(mapStoreProduct), {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

async function getStoreProduct({ ctx, res }) {
  const vendor = await resolveVendorBySubdomain(ctx.headers, ctx.query);
  if (!vendor) return sendError(res, 400, "SUBDOMAIN_REQUIRED", "Store subdomain is required");

  const product = await prisma.product.findFirst({
    where: {
      vendorMongoId: vendor.mongoId,
      status: PRODUCT_STATUS.APPROVED,
      OR: [{ mongoId: ctx.params.id }, { id: ctx.params.id }],
    },
    include: { category: { select: { name: true, slug: true, mongoId: true } } },
  });

  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  await prisma.product.update({
    where: { id: product.id },
    data: { metaViews: { increment: 1 } },
  });

  return sendSuccess(res, mapStoreProduct(product));
}

async function getPublicProductById({ ctx, res }) {
  const product = await prisma.product.findFirst({
    where: {
      status: PRODUCT_STATUS.APPROVED,
      OR: [{ mongoId: ctx.params.id }, { id: ctx.params.id }],
    },
    include: {
      vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
      category: { select: { name: true, slug: true, mongoId: true } },
    },
  });

  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found");

  return sendSuccess(res, {
    ...mapStoreProduct(product),
    vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
  });
}

async function getFeaturedProducts({ ctx, res }) {
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "12", 10) || 12);
  const products = await prisma.product.findMany({
    where: { status: PRODUCT_STATUS.APPROVED },
    include: {
      vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
      category: { select: { name: true, slug: true, mongoId: true } },
    },
    orderBy: [{ metaViews: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return sendSuccess(
    res,
    products.map((product) => ({
      ...mapStoreProduct(product),
      vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
    }))
  );
}

async function listPublicProducts({ ctx, res }) {
  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "24", 10) || 24);
  const skip = (page - 1) * limit;
  const where = {
    status: PRODUCT_STATUS.APPROVED,
  };

  if (ctx.query.category) where.categoryMongoId = ctx.query.category;
  if (ctx.query.region) where.region = String(ctx.query.region).trim();
  if (ctx.query.area) {
    where.vendor = {
      is: {
        locationArea: String(ctx.query.area).trim(),
      },
    };
  }
  if (ctx.query.search) {
    where.OR = [
      { name: { contains: ctx.query.search, mode: "insensitive" } },
      { description: { contains: ctx.query.search, mode: "insensitive" } },
      { vendor: { is: { businessName: { contains: ctx.query.search, mode: "insensitive" } } } },
    ];
  }
  if (ctx.query.minPrice || ctx.query.maxPrice) {
    where.price = {};
    if (ctx.query.minPrice) where.price.gte = Number(ctx.query.minPrice);
    if (ctx.query.maxPrice) where.price.lte = Number(ctx.query.maxPrice);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        vendor: {
          select: {
            businessName: true,
            subdomain: true,
            logoUrl: true,
            mongoId: true,
            locationRegion: true,
            locationArea: true,
            phoneNumber: true,
            whatsappNumber: true,
          },
        },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
      orderBy: [{ metaViews: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return sendSuccess(
    res,
    products.map((product) => ({
      ...mapStoreProduct(product),
      vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
      category: product.category ? { ...product.category, _id: product.category.mongoId } : null,
    })),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function getNewArrivals({ ctx, res }) {
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "12", 10) || 12);
  const products = await prisma.product.findMany({
    where: { status: PRODUCT_STATUS.APPROVED },
    include: {
      vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
      category: { select: { name: true, slug: true, mongoId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return sendSuccess(
    res,
    products.map((product) => ({
      ...mapStoreProduct(product),
      vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
    }))
  );
}

async function searchAllProducts({ ctx, res }) {
  if (!ctx.query.search) return sendError(res, 400, "MISSING_SEARCH", "Search query is required");

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = {
    status: PRODUCT_STATUS.APPROVED,
    OR: [
      { name: { contains: ctx.query.search, mode: "insensitive" } },
      { description: { contains: ctx.query.search, mode: "insensitive" } },
    ],
  };

  if (ctx.query.category) where.categoryMongoId = ctx.query.category;
  if (ctx.query.minPrice || ctx.query.maxPrice) {
    where.price = {};
    if (ctx.query.minPrice) where.price.gte = Number(ctx.query.minPrice);
    if (ctx.query.maxPrice) where.price.lte = Number(ctx.query.maxPrice);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return sendSuccess(
    res,
    products.map((product) => ({
      ...mapStoreProduct(product),
      vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
    })),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

module.exports = {
  listAllStores,
  searchStores,
  getStoreInfo,
  getStoreProducts,
  getStoreProduct,
  getPublicProductById,
  getFeaturedProducts,
  listPublicProducts,
  getNewArrivals,
  searchAllProducts,
};
