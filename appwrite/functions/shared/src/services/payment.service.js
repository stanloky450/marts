const axios = require("axios");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { prisma } = require("../db/prisma");
const { requireAuth } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

async function verifyWithPaystack(reference) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const err = new Error("Paystack is not configured");
    err.code = "PAYSTACK_NOT_CONFIGURED";
    throw err;
  }

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

  if (payment.status === "success" && payment.userMongoId && payment.vendorMongoId) {
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

  if (payment.status !== "success") {
    let remote;
    try {
      remote = await verifyWithPaystack(payment.reference);
    } catch (error) {
      if (error?.code === "PAYSTACK_NOT_CONFIGURED") {
        return sendError(res, 503, "PAYSTACK_NOT_CONFIGURED", "Paystack is not configured");
      }
      throw error;
    }
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

  let registrationTriggered = false;
  if (payment.status === "success" && !payment.userMongoId && payment.type === "registration") {
    const registrationData = payment.metadata?.registrationData;
    if (registrationData) {
      await processSuccessfulRegistration(payment, registrationData);
      registrationTriggered = true;
    }
  }

  if (registrationTriggered || (payment.status === "success" && payment.userMongoId && payment.vendorMongoId)) {
    payment = await prisma.payment.findUnique({
      where: { reference: ctx.params.reference },
      include: {
        user: { select: { email: true, profileFirstName: true, profileLastName: true } },
        vendor: { select: { businessName: true } },
      },
    });
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

async function processSuccessfulRegistration(payment, registrationData) {
  const passwordHash = registrationData.password;
  let user = await prisma.user.findUnique({ where: { email: registrationData.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        mongoId: makeMongoId(),
        email: registrationData.email,
        passwordHash,
        role: "vendor",
        profileFirstName: registrationData.firstName,
        profileLastName: registrationData.lastName,
        profilePhone: registrationData.phoneNumber,
        profileRegion: registrationData.location?.region,
      },
    });
  }

  let vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: user.mongoId } });
  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        mongoId: makeMongoId(),
        ownerMongoId: user.mongoId,
        businessName: registrationData.businessName,
        description: registrationData.description,
        artisanCategory: registrationData.artisanCategory,
        phoneNumber: registrationData.phoneNumber,
        whatsappNumber: registrationData.whatsappNumber,
        socials: registrationData.socials || {},
        logoUrl: registrationData.logoUrl,
        logo: registrationData.logo,
        profilePhotoUrl: registrationData.profilePhotoUrl,
        referralCodeUsed: registrationData.referralCode,
        status: "active",
        locationRegion: registrationData.location?.region,
        locationArea: registrationData.location?.area,
      },
    });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "success",
      userMongoId: user.mongoId,
      vendorMongoId: vendor.mongoId,
      paidAt: new Date(),
    },
  });

  if (registrationData.referralCode) {
    await prisma.referral.update({
      where: { code: registrationData.referralCode },
      data: { usedCount: { increment: 1 } },
    });
  }

  return { user, vendor };
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

async function createWebhookPayment({ ctx, res }) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return sendError(res, 503, "PAYSTACK_NOT_CONFIGURED", "Paystack is not configured");
  }

  const vendorId = String(ctx.body?.vendorId || "").trim();
  if (!vendorId) return sendError(res, 400, "INVALID_INPUT", "vendorId is required");

  const vendor = await prisma.vendor.findFirst({
    where: { OR: [{ mongoId: vendorId }, ...(isUuid(vendorId) ? [{ id: vendorId }] : [])] },
    include: { owner: true },
  });
  if (!vendor || !vendor.owner?.email) {
    return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor not found");
  }

  let baseAmount = Number(process.env.REGISTRATION_FEE || 10000);
  if (vendor.locationRegion) {
    const locationDoc = await prisma.location.findFirst({
      where: { region: { equals: vendor.locationRegion, mode: "insensitive" }, isActive: true },
    });
    if (locationDoc) baseAmount = locationDoc.registrationFee;
  }

  const paymentReference = `REG-${Date.now()}-${generateRandomString(12)}`;
  const registrationData = {
    email: vendor.owner.email,
    password: vendor.owner.passwordHash || (await bcrypt.hash(generateRandomString(16), 10)),
    firstName: vendor.owner.profileFirstName,
    lastName: vendor.owner.profileLastName,
    businessName: vendor.businessName,
    description: vendor.description,
    phoneNumber: vendor.phoneNumber,
    whatsappNumber: vendor.whatsappNumber,
    socials: vendor.socials || {},
    referralCode: vendor.referralCodeUsed,
    artisanCategory: vendor.artisanCategory,
    profilePhotoUrl: vendor.profilePhotoUrl,
    logoUrl: vendor.logoUrl,
    logo: vendor.logo,
    location: { region: vendor.locationRegion, area: vendor.locationArea },
  };

  await prisma.payment.create({
    data: {
      mongoId: makeMongoId(),
      type: "registration",
      amount: baseAmount,
      currency: process.env.REGISTRATION_CURRENCY || "NGN",
      reference: paymentReference,
      status: "pending",
      userMongoId: vendor.ownerMongoId,
      vendorMongoId: vendor.mongoId,
      metadata: { registrationData },
    },
  });

  const remote = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: vendor.owner.email,
      amount: baseAmount * 100,
      reference: paymentReference,
      currency: process.env.REGISTRATION_CURRENCY || "NGN",
      metadata: {
        type: "registration",
        reference: paymentReference,
        businessName: vendor.businessName,
      },
      callback_url: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/payment/callback`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return sendSuccess(res, {
    payment: {
      reference: paymentReference,
      amount: baseAmount,
      currency: process.env.REGISTRATION_CURRENCY || "NGN",
      authorizationUrl: remote.data?.data?.authorization_url,
      accessCode: remote.data?.data?.access_code,
    },
  });
}

async function listWebhookPayments({ ctx, res }) {
  return listPayments({ ctx, res });
}

module.exports = {
  verifyPaymentStatus,
  listPayments,
  createWebhookPayment,
  listWebhookPayments,
  processSuccessfulRegistration,
};
