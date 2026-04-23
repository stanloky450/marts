import crypto from "crypto";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import prisma from "../lib/prisma.js";
import { USER_ROLES, USER_STATUS } from "../utils/constants.js";

const toMongoId = () => crypto.randomBytes(12).toString("hex");
const normalize = (value) => String(value || "").trim();

const mapMarketUser = (marketUser) => ({
  ...marketUser,
  _id: marketUser.mongoId,
});

const getAdminAccessibleRegions = async (reqUser) => {
  if (reqUser.role === USER_ROLES.SUPER_ADMIN) {
    return null;
  }

  const [admin, assignments] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ mongoId: reqUser.id }, { id: reqUser.pgId || "" }] },
      select: { profileRegion: true, role: true },
    }),
    prisma.adminAssignment.findMany({
      where: { adminUserMongoId: reqUser.mongoId },
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
};

const resolveScopedWhere = async (req, extraWhere = {}) => {
  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    return extraWhere;
  }

  const regions = await getAdminAccessibleRegions(req.user);
  if (!regions.length) {
    return {
      ...extraWhere,
      region: "__no_admin_region__",
    };
  }

  const requestedRegion = normalize(req.query.region);
  if (requestedRegion) {
    if (!regions.includes(requestedRegion)) {
      throw Object.assign(new Error("FORBIDDEN_REGION"), {
        statusCode: 403,
        code: "FORBIDDEN",
        message: "You can only manage users in your assigned region",
      });
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
};

const findScopedMarketUser = async (req, id) => {
  const marketUser = await prisma.marketUser.findFirst({
    where: { OR: [{ mongoId: id }, { id }] },
  });

  if (!marketUser) {
    return null;
  }

  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    return marketUser;
  }

  const regions = await getAdminAccessibleRegions(req.user);
  if (!regions.includes(marketUser.region)) {
    throw Object.assign(new Error("FORBIDDEN_REGION"), {
      statusCode: 403,
      code: "FORBIDDEN",
      message: "You can only manage users in your assigned region",
    });
  }

  return marketUser;
};

export const registerMarketUser = async (req, res, next) => {
  try {
    const email = normalize(req.body.email).toLowerCase();
    const fullName = normalize(req.body.fullName);
    const phoneNumber = normalize(req.body.phoneNumber);
    const region = normalize(req.body.region);
    const area = normalize(req.body.area);
    const selectedProductIds = Array.isArray(req.body.selectedProductIds)
      ? req.body.selectedProductIds.map((item) => normalize(item)).filter(Boolean)
      : [];
    const selectedProductNames = Array.isArray(req.body.selectedProductNames)
      ? req.body.selectedProductNames.map((item) => normalize(item)).filter(Boolean)
      : [];

    const existing = await prisma.marketUser.findUnique({
      where: { email },
    });

    if (existing?.status === USER_STATUS.SUSPENDED) {
      return res
        .status(403)
        .json(errorResponse("ACCOUNT_SUSPENDED", "Your user account is suspended"));
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

    res.status(existing ? 200 : 201).json(successResponse(mapMarketUser(marketUser)));
  } catch (error) {
    next(error);
  }
};

export const loginMarketUser = async (req, res, next) => {
  try {
    const email = normalize(req.body.email).toLowerCase();
    const phoneNumber = normalize(req.body.phoneNumber);

    const marketUser = await prisma.marketUser.findUnique({
      where: { email },
    });

    if (!marketUser || normalize(marketUser.phoneNumber) !== phoneNumber) {
      return res
        .status(401)
        .json(errorResponse("INVALID_CREDENTIALS", "Invalid email or phone number"));
    }

    if (marketUser.status !== USER_STATUS.ACTIVE) {
      return res
        .status(403)
        .json(errorResponse("ACCOUNT_SUSPENDED", "Your user account is suspended"));
    }

    const updated = await prisma.marketUser.update({
      where: { id: marketUser.id },
      data: { lastLoginAt: new Date() },
    });

    res.json(successResponse(mapMarketUser(updated)));
  } catch (error) {
    next(error);
  }
};

export const validateMarketUserSession = async (req, res, next) => {
  try {
    const id = normalize(req.body.id);
    const email = normalize(req.body.email).toLowerCase();

    const marketUser = await prisma.marketUser.findFirst({
      where: {
        mongoId: id,
        email,
      },
    });

    if (!marketUser) {
      return res
        .status(404)
        .json(errorResponse("USER_NOT_FOUND", "User session could not be validated"));
    }

    if (marketUser.status !== USER_STATUS.ACTIVE) {
      return res
        .status(403)
        .json(errorResponse("ACCOUNT_SUSPENDED", "Your user account is suspended"));
    }

    res.json(successResponse(mapMarketUser(marketUser)));
  } catch (error) {
    next(error);
  }
};

export const listMarketUsers = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (status) {
      filters.status = status;
    }

    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
        { area: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
      ];
    }

    const where = await resolveScopedWhere(req, filters);
    const qPage = Math.max(1, parseInt(page, 10) || 1);
    const qLimit = Math.min(100, parseInt(limit, 10) || 20);
    const skip = (qPage - 1) * qLimit;

    const [marketUsers, total] = await Promise.all([
      prisma.marketUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: qLimit,
      }),
      prisma.marketUser.count({ where }),
    ]);

    res.json(
      successResponse(
        marketUsers.map(mapMarketUser),
        {
          total,
          page: qPage,
          limit: qLimit,
          totalPages: Math.ceil(total / qLimit),
        }
      )
    );
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.code, error.message));
    }
    next(error);
  }
};

export const updateMarketUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const marketUser = await findScopedMarketUser(req, id);
    if (!marketUser) {
      return res.status(404).json(errorResponse("USER_NOT_FOUND", "Registered user not found"));
    }

    const updated = await prisma.marketUser.update({
      where: { id: marketUser.id },
      data: {
        status,
        updatedByMongoId: req.user.mongoId,
      },
    });

    res.json(successResponse(mapMarketUser(updated)));
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.code, error.message));
    }
    next(error);
  }
};
