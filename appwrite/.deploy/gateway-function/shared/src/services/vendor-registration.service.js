const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const { prisma } = require("../db/prisma");
const { sendSuccess, sendError } = require("../http/response");

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

async function initializePayment({ email, amount, reference, metadata = {}, callbackUrl }) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const err = new Error("Paystack is not configured");
    err.code = "PAYSTACK_NOT_CONFIGURED";
    throw err;
  }

  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email,
      amount: amount * 100,
      reference,
      currency: process.env.REGISTRATION_CURRENCY || "NGN",
      metadata,
      callback_url: callbackUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.data;
}

async function initiateVendorRegistration({ ctx, res }) {
  const body = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
  const email = String(body.email || "").trim().toLowerCase();
  const plainPassword = String(body.passwordHash || body.password || "");
  const businessName = String(body.businessName || "").trim();
  const region = String(body.region || "").trim();
  const area = String(body.area || "").trim();

  if (!email || !plainPassword || !businessName) {
    return sendError(res, 400, "INVALID_INPUT", "email, password and businessName are required");
  }
  if (!region || !area) {
    return res.json({ error: { message: "Location (region & area) is required" } }, 400, { "content-type": "application/json" });
  }
  if (plainPassword.length < 8) {
    return sendError(res, 400, "WEAK_PASSWORD", "Password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return sendError(res, 409, "USER_EXISTS", "Email already registered");
  }

  let normalizedSocials = body.socials ?? body.socialMedia;
  if (typeof normalizedSocials === "string") {
  try {
    normalizedSocials = JSON.parse(normalizedSocials);
    } catch {
      normalizedSocials = undefined;
    }
  }
  if (normalizedSocials && typeof normalizedSocials === "object") {
    normalizedSocials = {
      facebook: normalizedSocials.facebook || "",
      instagram: normalizedSocials.instagram || "",
      x: normalizedSocials.x || normalizedSocials.twitter || "",
    };
  }

  let discountPercent = 0;
  let referralId = null;
  const referralCode = body.referralCode ? String(body.referralCode).trim().toUpperCase() : "";
  if (referralCode) {
    const referral = await prisma.referral.findUnique({ where: { code: referralCode } });
    if (referral && referral.status === "active" && !(referral.maxUses && referral.usedCount >= referral.maxUses)) {
      discountPercent = referral.discountPercent || 0;
      referralId = referral.mongoId;
    }
  }

  let baseAmount = Number(process.env.REGISTRATION_FEE || 10000);
  const locationDoc = await prisma.location.findFirst({
    where: { region: { equals: region, mode: "insensitive" }, isActive: true },
  });
  if (locationDoc) baseAmount = locationDoc.registrationFee;

  const discountAmount = (baseAmount * discountPercent) / 100;
  const finalAmount = Math.round(baseAmount - discountAmount);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const paymentReference = `REG-${Date.now()}-${generateRandomString(12)}`;
  await prisma.payment.create({
    data: {
      mongoId: makeMongoId(),
      type: "registration",
      amount: finalAmount,
      currency: process.env.REGISTRATION_CURRENCY || "NGN",
      reference: paymentReference,
      status: "pending",
      metadata: {
        registrationData: {
          email,
          password: hashedPassword,
          firstName: body.firstName,
          lastName: body.lastName,
          businessName,
          description: body.description,
          phoneNumber: body.phoneNumber,
          whatsappNumber: body.whatsappNumber,
          socials: normalizedSocials || {},
          referralCode: referralCode || undefined,
          referralId,
          businessType: body.businessType,
          artisanCategory: body.artisanCategory,
          profilePhotoUrl: body.profilePhotoUrl,
          logoUrl: body.logoUrl,
          logo: body.logo,
          location: { region, area },
        },
        discountPercent,
        originalAmount: baseAmount,
        discountAmount,
      },
    },
  });

  const callbackUrl = `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/payment/callback`;
  let paystackData;
  try {
    paystackData = await initializePayment({
      email,
      amount: finalAmount,
      reference: paymentReference,
      callbackUrl,
      metadata: {
        type: "registration",
        reference: paymentReference,
        businessName,
      },
    });
  } catch (error) {
    if (error?.code === "PAYSTACK_NOT_CONFIGURED") {
      return sendError(res, 503, "PAYSTACK_NOT_CONFIGURED", "Paystack is not configured");
    }
    return sendError(res, 502, "PAYSTACK_INIT_FAILED", error?.response?.data?.message || error?.message || "Failed to initialize payment");
  }

  return sendSuccess(
    res,
    {
      payment: {
        reference: paymentReference,
        amount: finalAmount,
        currency: process.env.REGISTRATION_CURRENCY || "NGN",
        authorizationUrl: paystackData.authorization_url,
        accessCode: paystackData.access_code,
      },
    },
    null,
    201
  );
}

module.exports = {
  initiateVendorRegistration,
};
