const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

const PUBLIC_SETTINGS_KEYS = [
  "market_banner_url",
  "market_rss_url",
  "market_rss_ad_count",
  "market_rss_avg_time",
  "feature_chat_enabled",
  "feature_reviews_enabled",
];

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

function mapLocation(location) {
  return {
    ...location,
    _id: location.mongoId,
  };
}

function getNigeriaCatalogData() {
  const jsonPath = path.join(__dirname, "..", "data", "nigeria-lgas.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const stateToLgas = new Map();

  for (const item of raw) {
    const state = String(item?.state_name || "").trim();
    const localGovernment = String(item?.name || "").trim();
    if (!state || !localGovernment) continue;

    const current = stateToLgas.get(state) || new Set();
    current.add(localGovernment);
    stateToLgas.set(state, current);
  }

  return Array.from(stateToLgas.entries())
    .map(([state, lgasSet]) => {
      const localGovernments = Array.from(lgasSet).sort((a, b) => a.localeCompare(b));
      return {
        state,
        localGovernments,
        localGovernmentCount: localGovernments.length,
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));
}

async function getAllSettings({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const settings = await prisma.setting.findMany();
  const settingsMap = settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
  return sendSuccess(res, settingsMap);
}

async function getPublicSettings({ res }) {
  const settings = await prisma.setting.findMany({
    where: { key: { in: PUBLIC_SETTINGS_KEYS } },
  });
  const settingsMap = settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
  return sendSuccess(res, settingsMap);
}

async function updateSettings({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const payload = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
  await Promise.all(
    Object.entries(payload).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value, updatedByMongoId: auth.user.mongoId },
        create: { mongoId: makeMongoId(), key, value, updatedByMongoId: auth.user.mongoId },
      })
    )
  );

  return sendSuccess(res, { message: "Settings updated successfully" });
}

async function getRssProxy({ ctx, res }) {
  const url = String(ctx.query.url || "").trim();
  if (!url) return sendError(res, 400, "INVALID_INPUT", "URL is required");

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const xmlData = String(response.data || "");
    const items = [];
    const itemRegex = /<(item|entry)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = itemRegex.exec(xmlData)) !== null) {
      const content = match[2];
      const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link[^>]*>(?:([\s\S]*?)<\/link>|.*?href=["'](.*?)["'].*?>)/);
      const descMatch = content.match(/<(description|content|summary)[^>]*>([\s\S]*?)<\/\1>/);
      items.push({
        title: titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "No Title",
        link: linkMatch ? (linkMatch[1] || linkMatch[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "",
        description: descMatch
          ? descMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").slice(0, 200).trim()
          : "",
      });
    }

    return sendSuccess(res, { items });
  } catch {
    return sendError(res, 502, "RSS_PROXY_FAILED", "Failed to fetch RSS feed");
  }
}

async function getLocations({ ctx, res }) {
  const where = {};
  if (ctx.query.activeOnly === "true") where.isActive = true;
  const locations = await prisma.location.findMany({
    where,
    orderBy: { region: "asc" },
  });
  return sendSuccess(res, locations.map(mapLocation));
}

async function getNigeriaCatalog({ res }) {
  return sendSuccess(res, getNigeriaCatalogData());
}

async function createLocation({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const region = String(ctx.body?.region || "").trim();
  const areas = Array.isArray(ctx.body?.areas)
    ? [...new Set(ctx.body.areas.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
  if (!region) return sendError(res, 400, "INVALID_INPUT", "Region is required");
  if (areas.length === 0) return sendError(res, 400, "INVALID_INPUT", "At least one area is required");

  const existing = await prisma.location.findFirst({
    where: { region: { equals: region, mode: "insensitive" } },
  });
  if (existing) return sendError(res, 400, "LOCATION_EXISTS", "Region already exists");

  const created = await prisma.location.create({
    data: {
      mongoId: makeMongoId(),
      region,
      areas,
      registrationFee: Number(ctx.body?.registrationFee) || 0,
      isActive: ctx.body?.isActive !== false,
      createdByMongoId: auth.user.mongoId,
    },
  });

  return sendSuccess(res, mapLocation(created), null, 201);
}

async function updateLocation({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const location = await prisma.location.findFirst({ where: findByMongoOrUuid(ctx.params.id) });
  if (!location) return sendError(res, 404, "LOCATION_NOT_FOUND", "Location not found");

  const nextRegion = ctx.body?.region !== undefined ? String(ctx.body.region || "").trim() : location.region;
  const nextAreas = Array.isArray(ctx.body?.areas)
    ? [...new Set(ctx.body.areas.map((item) => String(item || "").trim()).filter(Boolean))]
    : location.areas;
  if (!nextRegion) return sendError(res, 400, "INVALID_INPUT", "Region is required");
  if (!nextAreas.length) return sendError(res, 400, "INVALID_INPUT", "At least one area is required");

  const duplicate = await prisma.location.findFirst({
    where: {
      region: { equals: nextRegion, mode: "insensitive" },
      id: { not: location.id },
    },
  });
  if (duplicate) return sendError(res, 400, "LOCATION_EXISTS", "Region name already exists");

  const updated = await prisma.location.update({
    where: { id: location.id },
    data: {
      region: nextRegion,
      areas: nextAreas,
      registrationFee:
        ctx.body?.registrationFee !== undefined ? Number(ctx.body.registrationFee) || 0 : location.registrationFee,
      isActive: ctx.body?.isActive !== undefined ? Boolean(ctx.body.isActive) : location.isActive,
    },
  });

  return sendSuccess(res, mapLocation(updated));
}

async function deleteLocation({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const location = await prisma.location.findFirst({ where: findByMongoOrUuid(ctx.params.id) });
  if (!location) return sendError(res, 404, "LOCATION_NOT_FOUND", "Location not found");
  await prisma.location.delete({ where: { id: location.id } });
  return sendSuccess(res, { message: "Location deleted successfully" });
}

module.exports = {
  getAllSettings,
  getPublicSettings,
  updateSettings,
  getRssProxy,
  getLocations,
  getNigeriaCatalog,
  createLocation,
  updateLocation,
  deleteLocation,
};
