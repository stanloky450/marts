const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess } = require("../http/response");
const { USER_ROLES } = require("../constants");

async function marketplaceOverview({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const [products, vendors, payments] = await Promise.all([
    prisma.product.aggregate({ _sum: { metaViews: true, metaSales: true }, _count: { _all: true } }),
    prisma.vendor.count({ where: { status: "active" } }),
    prisma.payment.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
  ]);

  return sendSuccess(res, {
    products: {
      total: products._count._all,
      views: products._sum.metaViews || 0,
      sales: products._sum.metaSales || 0,
    },
    vendors: {
      active: vendors,
    },
    payments: {
      revenue: payments._sum.amount || 0,
    },
  });
}

module.exports = {
  marketplaceOverview,
};
