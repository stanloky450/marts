const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

function toMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function normalize(value) {
  return String(value || "").trim();
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function mapMarketUser(marketUser) {
  return {
    ...marketUser,
    _id: marketUser.mongoId,
  };
}

async function getAdminAccessibleRegions(authUser) {
  if (authUser.role === USER_ROLES.SUPER_ADMIN) {
    return null;
  }

  const [admin, assignments] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [{ mongoId: authUser.mongoId }, ...(authUser.pgId ? [{ id: authUser.pgId }] : [])],
      },
      select: { profileRegion: true, role: true },
    }),
    prisma.adminAssignment.findMany({
      where: { adminUserMongoId: authUser.mongoId },
      include: {
        vendor: {
          select: {
            locationRegion: true,
          },
        },
      },
    }),
  ]);

  if (!admin || admin.role !== USER_ROLES.ADMIN) {
    return [];
  }

  const regions = new Set();
  if (admin.profileRegion) {
    regions.add(admin.profileRegion);
  }

  for (const assignment of assignments) {
    if (assignment.region) {
      regions.add(assignment.region);
    }
    if (assignment.vendor?.locationRegion) {
      regions.add(assignment.vendor.locationRegion);
    }
  }

  return Array.from(regions).filter(Boolean);
}

async function resolveScopedWhere(authUser, query, extraWhere = {}) {
  if (authUser.role === USER_ROLES.SUPER_ADMIN) {
    return extraWhere;
  }

  const regions = await getAdminAccessibleRegions(authUser);
  if (!regions.length) {
    return {
      ...extraWhere,
      region: "__no_admin_region__",
    };
  }

  const requestedRegion = normalize(query.region);
  if (requestedRegion) {
    if (!regions.includes(requestedRegion)) {
      const err = new Error("FORBIDDEN_REGION");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      err.userMessage = "You can only manage users in your assigned region";
      throw err;
    }

    return {
      ...extraWhere,
      region: requestedRegion,
    };
  }

  return {
    ...extraWhere,
    region: { in: regions },
  };
}

async function findScopedMarketUser(authUser, id) {
  const marketUser = await prisma.marketUser.findFirst({
    where: {
      OR: [{ mongoId: id }, ...(isUuid(id) ? [{ id }] : [])],
    },
  });

  if (!marketUser) {
    return null;
  }

  if (authUser.role === USER_ROLES.SUPER_ADMIN) {
    return marketUser;
  }

  const regions = await getAdminAccessibleRegions(authUser);
  if (!regions.includes(marketUser.region)) {
    const err = new Error("FORBIDDEN_REGION");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    err.userMessage = "You can only manage users in your assigned region";
    throw err;
  }

  return marketUser;
}

async function registerMarketUser({ ctx, res }) {
  const email = normalize(ctx.body?.email).toLowerCase();
  const fullName = normalize(ctx.body?.fullName);
  const phoneNumber = normalize(ctx.body?.phoneNumber);
  const region = normalize(ctx.body?.region);
  const area = normalize(ctx.body?.area);
  const selectedProductIds = Array.isArray(ctx.body?.selectedProductIds)
    ? ctx.body.selectedProductIds.map((item) => normalize(item)).filter(Boolean)
    : [];
  const selectedProductNames = Array.isArray(ctx.body?.selectedProductNames)
    ? ctx.body.selectedProductNames.map((item) => normalize(item)).filter(Boolean)
    : [];

  const existing = await prisma.marketUser.findUnique({
    where: { email },
  });

  if (existing?.status === "suspended") {
    return sendError(res, 403, "ACCOUNT_SUSPENDED", "Your user account is suspended");
  }

  const payload = {
    fullName,
    email,
    phoneNumber,
    region,
    area,
    selectedProductIds,
    selectedProductNames,
    lastLoginAt: new Date(),
  };

  const marketUser = existing
    ? await prisma.marketUser.update({
        where: { id: existing.id },
        data: payload,
      })
    : await prisma.marketUser.create({
        data: {
          mongoId: toMongoId(),
          ...payload,
        },
      });

  return sendSuccess(res, mapMarketUser(marketUser), null, existing ? 200 : 201);
}

async function loginMarketUser({ ctx, res }) {
  const email = normalize(ctx.body?.email).toLowerCase();
  const phoneNumber = normalize(ctx.body?.phoneNumber);

  const marketUser = await prisma.marketUser.findUnique({
    where: { email },
  });

  if (!marketUser || normalize(marketUser.phoneNumber) !== phoneNumber) {
    return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or phone number");
  }

  if (marketUser.status !== "active") {
    return sendError(res, 403, "ACCOUNT_SUSPENDED", "Your user account is suspended");
  }

  const updated = await prisma.marketUser.update({
    where: { id: marketUser.id },
    data: { lastLoginAt: new Date() },
  });

  return sendSuccess(res, mapMarketUser(updated));
}

async function validateMarketUserSession({ ctx, res }) {
  const id = normalize(ctx.body?.id);
  const email = normalize(ctx.body?.email).toLowerCase();

  const marketUser = await prisma.marketUser.findFirst({
    where: {
      mongoId: id,
      email,
    },
  });

  if (!marketUser) {
    return sendError(res, 404, "USER_NOT_FOUND", "User session could not be validated");
  }

  if (marketUser.status !== "active") {
    return sendError(res, 403, "ACCOUNT_SUSPENDED", "Your user account is suspended");
  }

  return sendSuccess(res, mapMarketUser(marketUser));
}

async function listMarketUsers({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  try {
    const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
    const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
    const skip = (page - 1) * limit;
    const filters = {};

    if (ctx.query.status) {
      filters.status = ctx.query.status;
    }

    if (ctx.query.search) {
      filters.OR = [
        { fullName: { contains: ctx.query.search, mode: "insensitive" } },
        { email: { contains: ctx.query.search, mode: "insensitive" } },
        { phoneNumber: { contains: ctx.query.search, mode: "insensitive" } },
        { area: { contains: ctx.query.search, mode: "insensitive" } },
        { region: { contains: ctx.query.search, mode: "insensitive" } },
      ];
    }

    const where = await resolveScopedWhere(auth.user, ctx.query, filters);

    const [marketUsers, total] = await Promise.all([
      prisma.marketUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.marketUser.count({ where }),
    ]);

    return sendSuccess(
      res,
      marketUsers.map(mapMarketUser),
      { total, page, limit, totalPages: Math.ceil(total / limit) }
    );
  } catch (error) {
    if (error?.statusCode) {
      return sendError(res, error.statusCode, error.code || "FORBIDDEN", error.userMessage || error.message);
    }
    throw error;
  }
}

async function updateMarketUserStatus({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  try {
    const marketUser = await findScopedMarketUser(auth.user, normalize(ctx.params.id));
    if (!marketUser) {
      return sendError(res, 404, "USER_NOT_FOUND", "Registered user not found");
    }

    const updated = await prisma.marketUser.update({
      where: { id: marketUser.id },
      data: {
        status: ctx.body?.status,
        updatedByMongoId: auth.user.mongoId,
      },
    });

    return sendSuccess(res, mapMarketUser(updated));
  } catch (error) {
    if (error?.statusCode) {
      return sendError(res, error.statusCode, error.code || "FORBIDDEN", error.userMessage || error.message);
    }
    throw error;
  }
}

module.exports = {
  registerMarketUser,
  loginMarketUser,
  validateMarketUserSession,
  listMarketUsers,
  updateMarketUserStatus,
};
