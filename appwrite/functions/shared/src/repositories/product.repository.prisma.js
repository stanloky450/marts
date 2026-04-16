const { prisma } = require("../db/prisma");

function buildWhere(filters = {}, actor = null) {
  const where = {};

  if (actor?.role === "vendor" && actor.mongoId) {
    where.vendor = { ownerMongoId: actor.mongoId };
  }

  if (filters.status) where.status = filters.status;
  if (filters.category) where.categoryMongoId = filters.category;
  if (filters.vendor) where.vendorMongoId = filters.vendor;
  if (filters.region) where.region = filters.region;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { tags: { has: filters.search } },
    ];
  }

  if (filters.minPrice || filters.maxPrice) {
    where.price = {};
    if (filters.minPrice) where.price.gte = Number(filters.minPrice);
    if (filters.maxPrice) where.price.lte = Number(filters.maxPrice);
  }

  return where;
}

async function listProducts({ filters, pagination, actor }) {
  const where = buildWhere(filters, actor);
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total };
}

async function getProductById(id) {
  return prisma.product.findFirst({
    where: { OR: [{ mongoId: id }, { id }] },
    include: {
      vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
      category: { select: { name: true, slug: true, mongoId: true } },
    },
  });
}

async function createProduct(data) {
  return prisma.product.create({ data });
}

async function updateProductByDbId(id, data) {
  return prisma.product.update({
    where: { id },
    data,
  });
}

async function deleteProductByDbId(id) {
  return prisma.product.delete({ where: { id } });
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProductByDbId,
  deleteProductByDbId,
};
