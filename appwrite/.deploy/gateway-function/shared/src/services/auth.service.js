const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../db/prisma");
const { sendSuccess, sendError } = require("../http/response");
const { requireAuth } = require("../auth/guard");

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m",
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function mapUserProfile(user) {
  return {
    id: user.mongoId,
    email: user.email,
    role: user.role,
    profile: {
      firstName: user.profileFirstName,
      lastName: user.profileLastName,
      phone: user.profilePhone,
      region: user.profileRegion,
      notes: user.profileNotes,
    },
  };
}

function looksLikeBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function verifyPassword(password, storedValue) {
  if (typeof password !== "string" || typeof storedValue !== "string" || !storedValue) {
    return false;
  }

  if (looksLikeBcryptHash(storedValue)) {
    return bcrypt.compare(password, storedValue);
  }

  // Temporary compatibility for records created by older admin flows that saved plain text.
  return password === storedValue;
}

async function login({ ctx, res }) {
  const { email, password } = ctx.body;

  if (!email || !password) {
    return sendError(res, 400, "VALIDATION_ERROR", "email and password are required");
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.status !== "active") {
    return sendError(res, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended");
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.role === "vendor") {
    const vendor = await prisma.vendor.findFirst({
      where: { ownerMongoId: user.mongoId },
    });

    if (!vendor || vendor.status !== "active") {
      return sendError(res, 403, "VENDOR_INACTIVE", "Vendor account is not active. Please complete payment.");
    }
  }

  const payload = {
    sub: user.mongoId,
    role: user.role,
    email: user.email,
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return sendSuccess(res, {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: mapUserProfile(user),
  });
}

async function refresh({ ctx, res }) {
  const { refreshToken } = ctx.body;
  if (!refreshToken) {
    return sendError(res, 400, "MISSING_TOKEN", "Refresh token is required");
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return sendError(res, 401, "INVALID_TOKEN", "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { mongoId: decoded.sub },
  });

  if (!user || user.status !== "active") {
    return sendError(res, 401, "INVALID_TOKEN", "Invalid refresh token");
  }

  const payload = {
    sub: user.mongoId,
    role: user.role,
    email: user.email,
  };

  return sendSuccess(res, {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  });
}

async function logout({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;
  return sendSuccess(res, { message: "Logged out successfully" });
}

async function me({ ctx, res }) {
  const auth = await requireAuth({ ctx, res });
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { mongoId: auth.user.mongoId },
  });

  if (!user) {
    return sendError(res, 404, "USER_NOT_FOUND", "User not found");
  }

  const vendor = user.role === "vendor"
    ? await prisma.vendor.findFirst({ where: { ownerMongoId: user.mongoId } })
    : null;

  return sendSuccess(res, {
    user: {
      ...user,
      id: user.mongoId,
      profile: mapUserProfile(user).profile,
    },
    vendor,
  });
}

module.exports = {
  login,
  refresh,
  logout,
  me,
};
