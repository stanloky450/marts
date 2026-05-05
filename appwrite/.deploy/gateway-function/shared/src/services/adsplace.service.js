const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { parseMultipartSingleFile } = require("./media.service");
const { v2: cloudinary } = require("cloudinary");
const { USER_ROLES } = require("../constants");

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function ensureCloudinaryConfigured() {
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasParts = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (!hasUrl && !hasParts) {
    const err = new Error("Cloudinary is not configured");
    err.statusCode = 500;
    err.code = "CLOUDINARY_NOT_CONFIGURED";
    throw err;
  }

  if (!hasUrl) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

async function uploadToCloudinary({ buffer, folder }) {
  ensureCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

function mapAd(ad) {
  return { ...ad, _id: ad.mongoId };
}

function getDurationInDays(start, end) {
  const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function readAdBody(ctx) {
  const body = ctx.body && typeof ctx.body === "object" ? ctx.body : {};
  return {
    slot: body.slot,
    imageUrl: body.imageUrl,
    description: body.description,
    price: body.price,
    startDate: body.startDate,
    endDate: body.endDate,
    targetUrl: body.targetUrl,
    priority: body.priority,
    active: body.active,
  };
}

async function maybeUploadAdFile(ctx) {
  const headers = ctx.raw?.headers || ctx.headers || {};
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  if (!String(contentType).includes("multipart/form-data")) return null;

  try {
    const { file } = await parseMultipartSingleFile({ ctx }, { fieldNames: ["file"] });
    const uploaded = await uploadToCloudinary({ buffer: file.buffer, folder: "ads" });
    return uploaded.secure_url;
  } catch (error) {
    if (error?.code === "NO_FILE") return null;
    throw error;
  }
}

async function getAds({ ctx, res }) {
  const where = {};
  if (ctx.query.active !== undefined) where.active = String(ctx.query.active) === "true";

  const ads = await prisma.adPlacement.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return res.json(ads.map(mapAd), 200, { "content-type": "application/json" });
}

async function createAd({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const body = readAdBody(ctx);
  let imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const uploadedImageUrl = await maybeUploadAdFile(ctx);
  if (uploadedImageUrl) imageUrl = uploadedImageUrl;
  if (!imageUrl) {
    return res.json({ message: "Image URL or file is required" }, 400, { "content-type": "application/json" });
  }

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  const duration = getDurationInDays(startDate, endDate);
  if (duration < 1 || duration > 7) {
    return res.json({ message: "Ad duration must be between 1 and 7 days" }, 400, { "content-type": "application/json" });
  }

  const created = await prisma.adPlacement.create({
    data: {
      mongoId: makeMongoId(),
      slot: String(body.slot),
      imageUrl,
      description: String(body.description || ""),
      price: Number.parseFloat(String(body.price || 0)),
      startDate,
      endDate,
      targetUrl: body.targetUrl ? String(body.targetUrl) : null,
      priority: Number.parseInt(String(body.priority || 0), 10) || 0,
      createdByMongoId: auth.user.mongoId,
    },
  });

  return res.json(mapAd(created), 201, { "content-type": "application/json" });
}

async function updateAd({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const ad = await prisma.adPlacement.findFirst({
    where: { OR: [{ mongoId: String(ctx.params.id) }, { id: String(ctx.params.id) }] },
  });
  if (!ad) return res.json({ message: "Ad not found" }, 404, { "content-type": "application/json" });

  const body = readAdBody(ctx);
  const updates = {};
  const uploadedImageUrl = await maybeUploadAdFile(ctx);
  if (uploadedImageUrl) updates.imageUrl = uploadedImageUrl;
  else if (body.imageUrl) updates.imageUrl = String(body.imageUrl).trim();
  if (body.slot !== undefined) updates.slot = String(body.slot);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.targetUrl !== undefined) updates.targetUrl = body.targetUrl ? String(body.targetUrl) : null;
  if (body.price !== undefined && body.price !== "") updates.price = Number.parseFloat(String(body.price));
  if (body.priority !== undefined && body.priority !== "") updates.priority = Number.parseInt(String(body.priority), 10) || 0;
  if (body.active !== undefined) updates.active = body.active === true || String(body.active) === "true";

  if (body.startDate || body.endDate) {
    const startDate = new Date(body.startDate || ad.startDate);
    const endDate = new Date(body.endDate || ad.endDate);
    const duration = getDurationInDays(startDate, endDate);
    if (duration < 1 || duration > 7) {
      return res.json({ message: "Ad duration must be between 1 and 7 days" }, 400, { "content-type": "application/json" });
    }
    updates.startDate = startDate;
    updates.endDate = endDate;
  }

  const updated = await prisma.adPlacement.update({
    where: { id: ad.id },
    data: { ...updates, updatedByMongoId: auth.user.mongoId },
  });

  return res.json(mapAd(updated), 200, { "content-type": "application/json" });
}

async function deleteAd({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  const ad = await prisma.adPlacement.findFirst({
    where: { OR: [{ mongoId: String(ctx.params.id) }, { id: String(ctx.params.id) }] },
  });
  if (!ad) return res.json({ message: "Ad not found" }, 404, { "content-type": "application/json" });

  await prisma.adPlacement.delete({ where: { id: ad.id } });
  return res.json({ message: "Ad deleted successfully" }, 200, { "content-type": "application/json" });
}

module.exports = {
  getAds,
  createAd,
  updateAd,
  deleteAd,
};
