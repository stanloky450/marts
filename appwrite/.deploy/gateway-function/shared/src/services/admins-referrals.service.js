const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function findByMongoOrUuid(value, allowCode = false) {
  const raw = String(value || "").trim();
  const OR = [{ mongoId: raw }];
  if (isUuid(raw)) OR.push({ id: raw });
  if (allowCode) OR.push({ code: raw.toUpperCase() });
  return { OR };
}

function mapAdmin(admin) {
  const { passwordHash, ...safeAdmin } = admin;
  return {
    ...safeAdmin,
    _id: safeAdmin.mongoId,
    userId: safeAdmin.mongoId,
    firstName: safeAdmin.profileFirstName || "",
    lastName: safeAdmin.profileLastName || "",
    region: safeAdmin.profileRegion || "",
    notes: safeAdmin.profileNotes || "",
    isActive: safeAdmin.status === "active",
    assignedVendors: safeAdmin._count?.adminAssignments || safeAdmin.assignedVendors || 0,
  };
}

function mapReferral(referral) {
  return {
    ...referral,
    _id: referral.mongoId,
    currentUses: referral.usedCount,
    isActive: referral.status === "active",
    description: referral.label || undefined,
  };
}

async function listAdmins({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = { role: USER_ROLES.ADMIN };
  if (ctx.query.status) where.status = ctx.query.status;
  if (ctx.query.search) {
    where.OR = [
      { email: { contains: ctx.query.search, mode: "insensitive" } },
      { profileFirstName: { contains: ctx.query.search, mode: "insensitive" } },
      { profileLastName: { contains: ctx.query.search, mode: "insensitive" } },
    ];
  }

  const [admins, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { _count: { select: { adminAssignments: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return sendSuccess(
    res,
    admins.map(mapAdmin),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function createAdmin({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const email = String(ctx.body?.email || "").trim().toLowerCase();
  const password = String(ctx.body?.password || "");
  if (!email || !password || !ctx.body?.firstName || !ctx.body?.lastName) {
    return sendError(res, 400, "INVALID_INPUT", "Email, password, first name, and last name are required");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return sendError(res, 409, "USER_EXISTS", "Email already registered");

  const created = await prisma.user.create({
    data: {
      mongoId: makeMongoId(),
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: USER_ROLES.ADMIN,
      profileFirstName: ctx.body.firstName,
      profileLastName: ctx.body.lastName,
      profileRegion: ctx.body.region || "",
      profileNotes: ctx.body.notes || "",
    },
  });

  let vendorMongoIds = [];
  if (ctx.body?.locationRegion) {
    const vendors = await prisma.vendor.findMany({
      where: { locationRegion: ctx.body.locationRegion },
      select: { mongoId: true },
    });
    vendorMongoIds = vendors.map((item) => item.mongoId);
  } else if (Array.isArray(ctx.body?.vendorIds) && ctx.body.vendorIds.length > 0) {
    const idList = ctx.body.vendorIds.filter(isUuid);
    const vendors = await prisma.vendor.findMany({
      where: {
        OR: [
          { mongoId: { in: ctx.body.vendorIds } },
          ...(idList.length ? [{ id: { in: idList } }] : []),
        ],
      },
      select: { mongoId: true },
    });
    vendorMongoIds = vendors.map((item) => item.mongoId);
  } else if (ctx.body?.referralCode) {
    const vendors = await prisma.vendor.findMany({
      where: { referralCodeUsed: String(ctx.body.referralCode).trim().toUpperCase() },
      select: { mongoId: true },
    });
    vendorMongoIds = vendors.map((item) => item.mongoId);
  }

  if (vendorMongoIds.length > 0) {
    await prisma.adminAssignment.createMany({
      data: vendorMongoIds.map((vendorMongoId) => ({
        mongoId: makeMongoId(),
        adminUserMongoId: created.mongoId,
        vendorMongoId,
        region: ctx.body.locationRegion || ctx.body.region || null,
        notes: ctx.body.notes || null,
      })),
      skipDuplicates: true,
    });
  }

  return sendSuccess(
    res,
    {
      ...mapAdmin({ ...created, assignedVendors: vendorMongoIds.length }),
      email: created.email,
      status: created.status,
    },
    null,
    201
  );
}

async function updateAdmin({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const admin = await prisma.user.findFirst({
    where: { ...findByMongoOrUuid(ctx.params.id), role: USER_ROLES.ADMIN },
  });
  if (!admin) return sendError(res, 404, "ADMIN_NOT_FOUND", "Admin not found");

  const updateData = {};
  if (ctx.body?.firstName !== undefined) updateData.profileFirstName = ctx.body.firstName;
  if (ctx.body?.lastName !== undefined) updateData.profileLastName = ctx.body.lastName;
  if (ctx.body?.region !== undefined) updateData.profileRegion = ctx.body.region;
  if (ctx.body?.notes !== undefined) updateData.profileNotes = ctx.body.notes;
  if (ctx.body?.status !== undefined) updateData.status = ctx.body.status;
  if (ctx.body?.isActive !== undefined) updateData.status = ctx.body.isActive ? "active" : "suspended";
  if (ctx.body?.email !== undefined) updateData.email = String(ctx.body.email).trim().toLowerCase();

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: updateData,
    include: { _count: { select: { adminAssignments: true } } },
  });

  return sendSuccess(res, mapAdmin(updated));
}

async function deleteAdmin({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const admin = await prisma.user.findFirst({
    where: { ...findByMongoOrUuid(ctx.params.id), role: USER_ROLES.ADMIN },
  });
  if (!admin) return sendError(res, 404, "ADMIN_NOT_FOUND", "Admin not found");

  await prisma.$transaction([
    prisma.adminAssignment.deleteMany({ where: { adminUserMongoId: admin.mongoId } }),
    prisma.user.delete({ where: { id: admin.id } }),
  ]);

  return sendSuccess(res, { message: "Admin deleted successfully" });
}

async function getAdminDashboardStats({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalProducts, totalVendors, totalAdmins, totalRevenue, totalViews, recentProducts, recentVendors, recentRevenue, recentSuccessfulPayments] =
    await Promise.all([
      prisma.product.count(),
      prisma.vendor.count({ where: { status: "active" } }),
      prisma.user.count({ where: { role: USER_ROLES.ADMIN } }),
      prisma.payment.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
      prisma.product.aggregate({ _sum: { metaViews: true } }),
      prisma.product.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.vendor.count({ where: { status: "active", createdAt: { gte: thirtyDaysAgo } } }),
      prisma.payment.aggregate({ where: { status: "success", createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
      prisma.payment.findMany({
        where: { status: "success", createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const revenueByDay = recentSuccessfulPayments.reduce((acc, payment) => {
    const dateKey = payment.createdAt.toISOString().split("T")[0];
    acc[dateKey] = (acc[dateKey] || 0) + Number(payment.amount || 0);
    return acc;
  }, {});

  const chartData = [];
  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const dateStr = date.toISOString().split("T")[0];
    chartData.push({ date: dateStr, revenue: revenueByDay[dateStr] || 0 });
  }

  return sendSuccess(res, {
    totals: {
      products: totalProducts,
      vendors: totalVendors,
      admins: totalAdmins,
      revenue: Number(totalRevenue._sum.amount || 0),
      views: Number(totalViews._sum.metaViews || 0),
    },
    recent: {
      products: recentProducts,
      vendors: recentVendors,
      revenue: Number(recentRevenue._sum.amount || 0),
    },
    chartData,
  });
}

async function getAdminProductAnalytics({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const where = {};
  if (ctx.query.vendorId) where.vendorMongoId = ctx.query.vendorId;
  const orderBy = ctx.query.sort === "sales" ? { metaSales: "desc" } : { metaViews: "desc" };
  const take = Math.min(100, Number.parseInt(ctx.query.limit || "50", 10) || 50);

  const [products, totals] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
        category: { select: { name: true, mongoId: true } },
      },
      orderBy,
      take,
    }),
    prisma.product.aggregate({ _sum: { metaViews: true, metaSales: true } }),
  ]);

  return sendSuccess(res, {
    products: products.map((product) => ({
      _id: product.mongoId,
      name: product.name,
      category: product.category?.name || "-",
      vendor: product.vendor?.businessName || "-",
      vendorSubdomain: product.vendor?.subdomain || null,
      price: product.price,
      stock: product.stock,
      status: product.status,
      views: product.metaViews,
      sales: product.metaSales,
      createdAt: product.createdAt,
    })),
    totals: {
      views: totals._sum.metaViews || 0,
      sales: totals._sum.metaSales || 0,
    },
  });
}

async function listReferrals({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = {};
  if (ctx.query.status) where.status = ctx.query.status;
  if (ctx.query.isActive !== undefined) where.status = ctx.query.isActive === "true" ? "active" : "inactive";
  if (ctx.query.search) where.code = { contains: String(ctx.query.search).trim().toUpperCase() };

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.referral.count({ where }),
  ]);

  return sendSuccess(
    res,
    referrals.map(mapReferral),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function getReferral({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const referral = await prisma.referral.findFirst({ where: findByMongoOrUuid(ctx.params.id, true) });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");
  return sendSuccess(res, mapReferral(referral));
}

async function validateReferral({ ctx, res }) {
  const referral = await prisma.referral.findUnique({
    where: { code: String(ctx.params.code || "").trim().toUpperCase() },
  });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");
  if (referral.status !== "active") {
    return sendError(res, 400, "REFERRAL_INACTIVE", "Referral code is not active", { status: referral.status });
  }
  if (referral.expiresAt && referral.expiresAt !== "0" && new Date(referral.expiresAt) < new Date()) {
    return sendError(res, 400, "REFERRAL_EXPIRED", "Referral code has expired", { expiresAt: referral.expiresAt });
  }
  if (referral.maxUses && referral.usedCount >= referral.maxUses) {
    return sendError(res, 400, "REFERRAL_EXHAUSTED", "Referral code has reached maximum uses", {
      maxUses: referral.maxUses,
      usedCount: referral.usedCount,
    });
  }

  return sendSuccess(res, {
    valid: true,
    code: referral.code,
    discountPercent: referral.discountPercent,
    description: referral.label || undefined,
  });
}

async function createReferral({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const discountPercent = Number(ctx.body?.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return sendError(res, 400, "INVALID_DISCOUNT", "Discount percent must be between 0 and 100");
  }

  const code = String(ctx.body?.code || makeMongoId().slice(0, 8))
    .trim()
    .toUpperCase();
  const existing = await prisma.referral.findUnique({ where: { code } });
  if (existing) return sendError(res, 400, "CODE_EXISTS", "This referral code already exists. Please choose another.");

  let expiresAt = "0";
  if (ctx.body?.expiresAt) {
    const parsed = new Date(ctx.body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return sendError(res, 400, "INVALID_EXPIRES_AT", "Expiry date is invalid");
    }
    expiresAt = parsed.toISOString();
  }

  const created = await prisma.referral.create({
    data: {
      mongoId: makeMongoId(),
      code,
      discountPercent,
      maxUses: ctx.body?.maxUses ?? null,
      expiresAt,
      label: ctx.body?.description || null,
      createdByMongoId: auth.user.mongoId,
    },
  });

  return sendSuccess(res, mapReferral(created), null, 201);
}

async function updateReferral({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const referral = await prisma.referral.findFirst({ where: findByMongoOrUuid(ctx.params.id, true) });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");

  const updateData = {};
  if (ctx.body?.discountPercent !== undefined) {
    const discountPercent = Number(ctx.body.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return sendError(res, 400, "INVALID_DISCOUNT", "Discount percent must be between 0 and 100");
    }
    updateData.discountPercent = discountPercent;
  }
  if (ctx.body?.maxUses !== undefined) updateData.maxUses = ctx.body.maxUses;
  if (ctx.body?.expiresAt !== undefined) updateData.expiresAt = ctx.body.expiresAt ? new Date(ctx.body.expiresAt).toISOString() : "0";
  if (ctx.body?.description !== undefined) updateData.label = ctx.body.description || null;
  if (ctx.body?.status !== undefined) updateData.status = ctx.body.status;
  if (ctx.body?.isActive !== undefined) updateData.status = ctx.body.isActive ? "active" : "inactive";

  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: updateData,
  });

  return sendSuccess(res, mapReferral(updated));
}

async function updateReferralStatusByCode({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const status = String(ctx.body?.status || "").trim();
  if (!["active", "inactive"].includes(status)) {
    return sendError(res, 400, "INVALID_STATUS", "Status must be 'active' or 'inactive'");
  }

  const referral = await prisma.referral.findUnique({
    where: { code: String(ctx.params.code || "").trim().toUpperCase() },
  });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");

  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status },
  });

  return sendSuccess(res, { code: updated.code, status: updated.status });
}

async function deleteReferral({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const referral = await prisma.referral.findFirst({ where: findByMongoOrUuid(ctx.params.id, true) });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");

  await prisma.referral.delete({ where: { id: referral.id } });
  return sendSuccess(res, { message: "Referral code deleted successfully" });
}

async function getReferralStats({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const referral = await prisma.referral.findFirst({ where: findByMongoOrUuid(ctx.params.id, true) });
  if (!referral) return sendError(res, 404, "REFERRAL_NOT_FOUND", "Referral code not found");

  const vendors = await prisma.vendor.findMany({
    where: { referralCodeUsed: referral.code },
    include: {
      owner: { select: { email: true, mongoId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, {
    code: referral.code,
    discountPercent: referral.discountPercent,
    usedCount: referral.usedCount,
    maxUses: referral.maxUses,
    status: referral.status,
    expiresAt: referral.expiresAt,
    lastUsedAt: referral.lastUsedAt,
    description: referral.label || undefined,
    vendors: vendors.map((vendor) => ({
      id: vendor.mongoId,
      businessName: vendor.businessName,
      subdomain: vendor.subdomain,
      status: vendor.status,
      ownerEmail: vendor.owner?.email,
      registeredAt: vendor.createdAt,
    })),
  });
}

module.exports = {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAdminDashboardStats,
  getAdminProductAnalytics,
  listReferrals,
  getReferral,
  validateReferral,
  createReferral,
  updateReferral,
  updateReferralStatusByCode,
  deleteReferral,
  getReferralStats,
};
