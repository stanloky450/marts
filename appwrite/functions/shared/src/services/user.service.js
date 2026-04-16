const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

async function listUsers({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;

  const where = {};
  if (ctx.query.status) where.status = ctx.query.status;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const safeUsers = users.map((user) => {
    const { passwordHash, ...rest } = user;
    return rest;
  });

  return sendSuccess(res, safeUsers, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

async function getUser({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findFirst({
    where: { OR: [{ mongoId: ctx.params.id }, { id: ctx.params.id }] },
  });

  if (!user) return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  const { passwordHash, ...safeUser } = user;
  return sendSuccess(res, safeUser);
}

module.exports = {
  listUsers,
  getUser,
};
