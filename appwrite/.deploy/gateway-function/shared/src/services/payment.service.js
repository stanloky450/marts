const axios = require("axios");
const { prisma } = require("../db/prisma");
const { requireAuth } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");

async function verifyWithPaystack(reference) {
  const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return response.data.data;
}

async function verifyPaymentStatus({ ctx, res }) {
  let payment = await prisma.payment.findUnique({
    where: { reference: ctx.params.reference },
    include: {
      user: { select: { email: true, profileFirstName: true, profileLastName: true } },
      vendor: { select: { businessName: true } },
    },
  });

  if (!payment) {
    return sendError(res, 404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  if (payment.status !== "success") {
    const remote = await verifyWithPaystack(payment.reference);
    if (remote.status === "success") {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "success",
          paidAt: remote.paid_at ? new Date(remote.paid_at) : new Date(),
        },
        include: {
          user: { select: { email: true, profileFirstName: true, profileLastName: true } },
          vendor: { select: { businessName: true } },
        },
      });
    } else if (remote.status === "failed") {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
        include: {
          user: { select: { email: true, profileFirstName: true, profileLastName: true } },
          vendor: { select: { businessName: true } },
        },
      });
    }
  }

  return sendSuccess(res, {
    payment: {
      ...payment,
      _id: payment.mongoId,
      user: payment.user ? { ...payment.user, _id: payment.userMongoId } : null,
      vendor: payment.vendor ? { ...payment.vendor, _id: payment.vendorMongoId } : null,
    },
    paystackStatus: payment.status,
  });
}

async function listPayments({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;

  const where = {};
  if (auth.user.role === "vendor") {
    where.userMongoId = auth.user.mongoId;
  }
  if (ctx.query.type) where.type = ctx.query.type;
  if (ctx.query.status) where.status = ctx.query.status;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: { select: { email: true, profileFirstName: true, profileLastName: true } },
        vendor: { select: { businessName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return sendSuccess(
    res,
    payments.map((payment) => ({
      ...payment,
      _id: payment.mongoId,
      user: payment.user ? { ...payment.user, _id: payment.userMongoId } : null,
      vendor: payment.vendor ? { ...payment.vendor, _id: payment.vendorMongoId } : null,
    })),
    {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  );
}

module.exports = {
  verifyPaymentStatus,
  listPayments,
};
