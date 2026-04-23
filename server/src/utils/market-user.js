import prisma from "../lib/prisma.js";
import { USER_STATUS } from "./constants.js";
import { errorResponse } from "./apiResponse.js";

const normalize = (value) => String(value || "").trim();

export const getMarketUserFromHeaders = (req) => {
  const marketUserId = normalize(req.headers["x-market-user-id"]);
  const marketUserName = normalize(req.headers["x-market-user-name"]);
  const marketUserEmail = normalize(req.headers["x-market-user-email"]).toLowerCase();
  if (!marketUserId) return null;
  return { marketUserId, marketUserName, marketUserEmail };
};

export const ensureActiveMarketUserFromHeaders = async (req, res) => {
  const marketUser = getMarketUserFromHeaders(req);
  if (!marketUser) {
    res
      .status(401)
      .json(errorResponse("UNAUTHORIZED", "Market user headers are required"));
    return null;
  }

  const record = await prisma.marketUser.findFirst({
    where: {
      mongoId: marketUser.marketUserId,
      email: marketUser.marketUserEmail || undefined,
    },
  });

  if (!record) {
    res
      .status(401)
      .json(errorResponse("UNAUTHORIZED", "Market user session is invalid"));
    return null;
  }

  if (record.status !== USER_STATUS.ACTIVE) {
    res
      .status(403)
      .json(errorResponse("ACCOUNT_SUSPENDED", "Your user account is suspended"));
    return null;
  }

  return {
    marketUserId: record.mongoId,
    marketUserName: record.fullName,
    marketUserEmail: record.email,
    region: record.region,
    area: record.area,
  };
};
