const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

function mapVendor(vendor) {
  return {
    ...vendor,
    _id: vendor.mongoId,
    isApproved: vendor.status === "active",
    isPaid: Boolean(vendor.payments && vendor.payments.length > 0),
  };
}

async function listMyAssignedVendors({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const admin = await prisma.user.findFirst({
    where: {
      OR: [{ mongoId: auth.user.mongoId }, ...(auth.user.pgId ? [{ id: auth.user.pgId }] : [])],
      role: USER_ROLES.ADMIN,
    },
    select: { mongoId: true, profileRegion: true },
  });

  if (!admin) {
    return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  }

  const assignments = await prisma.adminAssignment.findMany({
    where: { adminUserMongoId: admin.mongoId },
    select: { vendorMongoId: true },
  });

  const vendorMongoIds = assignments.map((item) => item.vendorMongoId);
  const where = {
    mongoId: { in: vendorMongoIds.length ? vendorMongoIds : ["__none__"] },
  };

  if (ctx.query.search) {
    where.OR = [
      { businessName: { contains: String(ctx.query.search), mode: "insensitive" } },
      { subdomain: { contains: String(ctx.query.search), mode: "insensitive" } },
      { phoneNumber: { contains: String(ctx.query.search), mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      payments: {
        select: { mongoId: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, vendors.map(mapVendor));
}

async function getMyAdminDashboardStats({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const assignments = await prisma.adminAssignment.findMany({
    where: { adminUserMongoId: auth.user.mongoId },
    select: { vendorMongoId: true },
  });
  const vendorMongoIds = assignments.map((item) => item.vendorMongoId);

  if (!vendorMongoIds.length) {
    return sendSuccess(res, {
      assignedVendors: 0,
      totalProducts: 0,
      pendingProducts: 0,
      approvedProducts: 0,
    });
  }

  const where = { vendorMongoId: { in: vendorMongoIds } };
  const [assignedVendors, totalProducts, pendingProducts, approvedProducts] = await Promise.all([
    prisma.vendor.count({ where: { mongoId: { in: vendorMongoIds } } }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, status: "pending" } }),
    prisma.product.count({ where: { ...where, status: "approved" } }),
  ]);

  return sendSuccess(res, {
    assignedVendors,
    totalProducts,
    pendingProducts,
    approvedProducts,
  });
}

module.exports = {
  listMyAssignedVendors,
  getMyAdminDashboardStats,
};
