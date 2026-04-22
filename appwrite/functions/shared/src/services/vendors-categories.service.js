const crypto = require("crypto");
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

function findByMongoOrUuid(value) {
  const raw = String(value || "").trim();
  const OR = [{ mongoId: raw }];
  if (isUuid(raw)) OR.push({ id: raw });
  return { OR };
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function mapVendor(vendor) {
  return {
    ...vendor,
    _id: vendor.mongoId,
    userId: vendor.ownerMongoId,
    businessLogo: vendor.logoUrl || vendor.logo || undefined,
    profilePhoto: vendor.profilePhotoUrl || undefined,
    socialMedia: vendor.socials
      ? {
          facebook: vendor.socials.facebook || undefined,
          instagram: vendor.socials.instagram || undefined,
          twitter: vendor.socials.x || vendor.socials.twitter || undefined,
        }
      : undefined,
    isApproved: vendor.status === "active",
    isPaid: Boolean(vendor.payments && vendor.payments.length > 0),
    registrationFee: vendor.registrationFee || 0,
    owner: vendor.owner
      ? {
          ...vendor.owner,
          _id: vendor.owner.mongoId,
          profile: {
            firstName: vendor.owner.profileFirstName || undefined,
            lastName: vendor.owner.profileLastName || undefined,
          },
        }
      : undefined,
  };
}

function mapCategory(category) {
  return {
    ...category,
    _id: category.mongoId,
    parentId: category.parentMongoId || undefined,
    description: undefined,
  };
}

async function listVendors({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(200, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  const where = {};

  if (ctx.query.status) where.status = ctx.query.status;
  if (ctx.query.search) {
    where.OR = [
      { businessName: { contains: ctx.query.search, mode: "insensitive" } },
      { subdomain: { contains: ctx.query.search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        owner: {
          select: {
            mongoId: true,
            email: true,
            profileFirstName: true,
            profileLastName: true,
          },
        },
        payments: {
          where: { status: "success", type: "registration" },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where }),
  ]);

  return sendSuccess(
    res,
    vendors.map(mapVendor),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function updateVendorStatus({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const nextStatus = String(ctx.body?.status || "").trim();
  if (!["active", "pending", "suspended"].includes(nextStatus)) {
    return sendError(res, 400, "INVALID_STATUS", "Invalid vendor status");
  }

  const vendor = await prisma.vendor.findFirst({ where: findByMongoOrUuid(ctx.params.id) });
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor not found");

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: { status: nextStatus },
    include: {
      payments: {
        where: { status: "success", type: "registration" },
        select: { id: true },
        take: 1,
      },
    },
  });

  await prisma.user.update({
    where: { mongoId: vendor.ownerMongoId },
    data: { status: nextStatus === "suspended" ? "suspended" : "active" },
  });

  return sendSuccess(res, mapVendor(updated));
}

async function listCategories({ ctx, res }) {
  const where = {};
  if (ctx.query.parent === "null" || ctx.query.parent === "none") {
    where.parentMongoId = null;
  } else if (ctx.query.parentId || ctx.query.parent) {
    where.parentMongoId = ctx.query.parentId || ctx.query.parent;
  }

  const categories = await prisma.category.findMany({
    where,
    include: {
      parent: { select: { mongoId: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });

  return sendSuccess(
    res,
    categories.map((category) => ({
      ...mapCategory(category),
      parent: category.parent ? { ...category.parent, _id: category.parent.mongoId } : null,
    }))
  );
}

async function getCategory({ ctx, res }) {
  const category = await prisma.category.findFirst({
    where: findByMongoOrUuid(ctx.params.id),
    include: { parent: { select: { mongoId: true, name: true, slug: true } } },
  });
  if (!category) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");
  return sendSuccess(res, {
    ...mapCategory(category),
    parent: category.parent ? { ...category.parent, _id: category.parent.mongoId } : null,
  });
}

async function createCategory({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const name = String(ctx.body?.name || "").trim();
  const slug = slugify(ctx.body?.slug || name);
  if (!name || !slug) {
    return sendError(res, 400, "INVALID_INPUT", "Name is required");
  }

  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }] },
  });
  if (existing) {
    return sendError(res, 409, "CATEGORY_EXISTS", "Category with this name or slug already exists");
  }

  const created = await prisma.category.create({
    data: {
      mongoId: makeMongoId(),
      name,
      slug,
      parentMongoId: ctx.body?.parentId || ctx.body?.parent || null,
      icon: ctx.body?.icon || null,
      status: ctx.body?.status || "active",
      createdByMongoId: auth.user.mongoId,
      updatedByMongoId: auth.user.mongoId,
    },
  });

  return sendSuccess(res, mapCategory(created), null, 201);
}

async function updateCategory({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const category = await prisma.category.findFirst({ where: findByMongoOrUuid(ctx.params.id) });
  if (!category) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");

  const updateData = {};
  if (ctx.body?.name) updateData.name = String(ctx.body.name).trim();
  if (ctx.body?.slug !== undefined) updateData.slug = slugify(ctx.body.slug || ctx.body.name || category.slug);
  if (ctx.body?.parentId !== undefined || ctx.body?.parent !== undefined) {
    updateData.parentMongoId = ctx.body.parentId || ctx.body.parent || null;
  }
  if (ctx.body?.icon !== undefined) updateData.icon = ctx.body.icon || null;
  if (ctx.body?.status) updateData.status = ctx.body.status;
  updateData.updatedByMongoId = auth.user.mongoId;

  if (updateData.name || updateData.slug) {
    const duplicate = await prisma.category.findFirst({
      where: {
        id: { not: category.id },
        OR: [
          updateData.name ? { name: updateData.name } : undefined,
          updateData.slug ? { slug: updateData.slug } : undefined,
        ].filter(Boolean),
      },
    });
    if (duplicate) {
      return sendError(res, 409, "CATEGORY_EXISTS", "Category with this name or slug already exists");
    }
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: updateData,
  });

  return sendSuccess(res, mapCategory(updated));
}

async function deleteCategory({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const category = await prisma.category.findFirst({ where: findByMongoOrUuid(ctx.params.id) });
  if (!category) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");

  const childCount = await prisma.category.count({ where: { parentMongoId: category.mongoId } });
  if (childCount > 0) {
    return sendError(res, 400, "CATEGORY_HAS_CHILDREN", "Cannot delete category with subcategories");
  }

  await prisma.category.delete({ where: { id: category.id } });
  return sendSuccess(res, { message: "Category deleted successfully" });
}

module.exports = {
  listVendors,
  updateVendorStatus,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
