const jwt = require("jsonwebtoken");
const { Account } = require("node-appwrite");
const { createJwtClient } = require("./appwrite-client");
const { sendError } = require("../http/response");
const { getBearerToken } = require("../http/request");
const { prisma } = require("../db/prisma");

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

async function resolveInternalUser({ appwriteUser, legacyPayload }) {
  if (legacyPayload?.sub) {
    const user = await prisma.user.findFirst({
      where: isUuid(legacyPayload.sub)
        ? { id: legacyPayload.sub }
        : { mongoId: legacyPayload.sub },
    });
    if (user) return user;
  }

  if (appwriteUser?.email) {
    return prisma.user.findUnique({
      where: { email: appwriteUser.email.toLowerCase() },
    });
  }

  return null;
}

async function verifyAppwriteJwt(jwtToken) {
  const client = createJwtClient(jwtToken);
  const account = new Account(client);
  return account.get();
}

function verifyLegacyJwt(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

async function authenticateRequest(ctx, { allowLegacy = true } = {}) {
  const strategy = process.env.AUTH_STRATEGY || "hybrid";
  const appwriteJwt = ctx.headers["x-appwrite-user-jwt"];
  const bearerToken = getBearerToken(ctx.headers);

  let appwriteUser = null;
  let legacyPayload = null;

  if (appwriteJwt && strategy !== "legacy") {
    appwriteUser = await verifyAppwriteJwt(appwriteJwt);
  }

  if (!appwriteUser && bearerToken && allowLegacy && strategy !== "appwrite") {
    legacyPayload = verifyLegacyJwt(bearerToken);
  }

  if (!appwriteUser && !legacyPayload) return null;

  const user = await resolveInternalUser({ appwriteUser, legacyPayload });
  if (!user) return null;

  return {
    id: user.mongoId,
    pgId: user.id,
    mongoId: user.mongoId,
    appwriteUserId: appwriteUser ? appwriteUser.$id : null,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

async function requireAuth({ res, ctx }, options = {}) {
  const user = await authenticateRequest(ctx, options);
  if (!user) {
    return {
      ok: false,
      response: sendError(res, 401, "UNAUTHORIZED", "Authentication required"),
    };
  }

  if (user.status !== "active") {
    return {
      ok: false,
      response: sendError(res, 403, "FORBIDDEN", "Account is suspended"),
    };
  }

  return { ok: true, user };
}

async function requireRole(context, allowedRoles, options = {}) {
  const auth = await requireAuth(context, options);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      ok: false,
      response: sendError(context.res, 403, "FORBIDDEN", "Insufficient permissions"),
    };
  }

  return auth;
}

module.exports = {
  authenticateRequest,
  requireAuth,
  requireRole,
};
