const crypto = require("crypto");
const { Readable } = require("stream");
const Busboy = require("busboy");
const { v2: cloudinary } = require("cloudinary");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

function getRawBodyBuffer(req) {
  const headers = req?.headers || {};
  const bodyEncoding = headers["x-body-encoding"] || headers["X-Body-Encoding"];

  if (bodyEncoding === "base64" && typeof req?.bodyText === "string") {
    return Buffer.from(req.bodyText, "base64");
  }
  if (req?.bodyBinary) return Buffer.from(req.bodyBinary, "base64");
  if (typeof req?.bodyText === "string") return Buffer.from(req.bodyText, "utf8");
  if (req?.body && typeof req.body === "string") return Buffer.from(req.body, "utf8");
  return Buffer.from([]);
}

async function parseMultipartSingleFile({ ctx }, { fieldNames }) {
  const headers = ctx.raw?.headers || ctx.headers || {};
  const contentType = headers["content-type"] || headers["Content-Type"];
  if (!contentType || !String(contentType).includes("multipart/form-data")) {
    const err = new Error("Expected multipart/form-data");
    err.statusCode = 400;
    err.code = "INVALID_CONTENT_TYPE";
    throw err;
  }

  const buffer = getRawBodyBuffer(ctx.raw);
  if (!buffer.length) {
    const err = new Error("No file uploaded");
    err.statusCode = 400;
    err.code = "NO_FILE";
    throw err;
  }

  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    let fileInfo = null;
    let fileBufferChunks = [];
    let total = 0;
    let sawFile = false;

    busboy.on("file", (name, stream, info) => {
      sawFile = true;

      if (fieldNames && !fieldNames.includes(name)) {
        stream.resume();
        return;
      }

      const filename = info?.filename || "upload";
      const mimeType = info?.mimeType || info?.mime || "";

      if (!String(mimeType).startsWith("image/") && !String(mimeType).startsWith("video/")) {
        stream.resume();
        const err = new Error("Only image and video files are allowed");
        err.statusCode = 400;
        err.code = "UPLOAD_ERROR";
        reject(err);
        return;
      }

      stream.on("data", (chunk) => {
        total += chunk.length;
        fileBufferChunks.push(chunk);
      });

      stream.on("limit", () => {
        const err = new Error("File size cannot exceed 5MB");
        err.statusCode = 400;
        err.code = "FILE_TOO_LARGE";
        reject(err);
      });

      stream.on("end", () => {
        fileInfo = { filename, mimeType, size: total };
      });
    });

    busboy.on("error", (e) => {
      const err = new Error(e?.message || "Upload failed");
      err.statusCode = 400;
      err.code = "UPLOAD_ERROR";
      reject(err);
    });

    busboy.on("finish", () => {
      if (!sawFile || !fileInfo) {
        const err = new Error("No file uploaded");
        err.statusCode = 400;
        err.code = "NO_FILE";
        reject(err);
        return;
      }

      resolve({ file: { ...fileInfo, buffer: Buffer.concat(fileBufferChunks) } });
    });

    Readable.from([buffer]).pipe(busboy);
  });
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

async function uploadMedia({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const { file } = await parseMultipartSingleFile({ ctx }, { fieldNames: ["image"] });

  let vendor = null;
  if (auth.user.role === USER_ROLES.VENDOR) {
    vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: auth.user.mongoId } });
    if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");
  }

  const folder = vendor ? `vendors/${vendor.mongoId}` : "general";
  const result = await uploadToCloudinary({ buffer: file.buffer, folder });

  const media = await prisma.media.create({
    data: {
      mongoId: makeMongoId(),
      url: result.secure_url,
      provider: "cloudinary",
      folder: result.folder || folder,
      ownerUserMongoId: auth.user.mongoId,
      vendorMongoId: vendor ? vendor.mongoId : null,
      width: result.width || null,
      height: result.height || null,
      mime: file.mimeType || null,
      size: file.size || null,
    },
  });

  return sendSuccess(res, { url: media.url }, null, 201);
}

async function uploadMediaFile({ ctx, res }) {
  const { file } = await parseMultipartSingleFile({ ctx }, { fieldNames: ["file"] });
  const result = await uploadToCloudinary({ buffer: file.buffer, folder: "general" });

  let authUser = null;
  try {
    const auth = await requireRole(
      { ctx, res },
      [USER_ROLES.VENDOR, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
      { allowLegacy: true }
    );
    if (auth.ok) authUser = auth.user;
  } catch {
    authUser = null;
  }

  if (authUser) {
    let vendorMongoId = null;
    if (authUser.role === USER_ROLES.VENDOR) {
      const vendor = await prisma.vendor.findFirst({
        where: { ownerMongoId: authUser.mongoId },
        select: { mongoId: true },
      });
      vendorMongoId = vendor?.mongoId || null;
    }

    await prisma.media.create({
      data: {
        mongoId: makeMongoId(),
        url: result.secure_url,
        provider: "cloudinary",
        folder: result.folder || "general",
        ownerUserMongoId: authUser.mongoId,
        vendorMongoId,
        width: result.width || null,
        height: result.height || null,
        mime: file.mimeType || null,
        size: file.size || null,
      },
    });
  }

  return res.json({ imageUrl: result.secure_url });
}

async function listMedia({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Number.parseInt(ctx.query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(ctx.query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;

  const where = {};
  if (auth.user.role === USER_ROLES.VENDOR) {
    const vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: auth.user.mongoId }, select: { mongoId: true } });
    if (vendor) where.vendorMongoId = vendor.mongoId;
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.media.count({ where }),
  ]);

  return sendSuccess(
    res,
    media.map((m) => ({ ...m, _id: m.mongoId })),
    { total, page, limit, totalPages: Math.ceil(total / limit) }
  );
}

async function deleteMedia({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
  if (!auth.ok) return auth.response;

  const id = String(ctx.params.id || "").trim();
  const media = await prisma.media.findFirst({ where: { OR: [{ mongoId: id }, { id }] } });
  if (!media) return sendError(res, 404, "MEDIA_NOT_FOUND", "Media not found");

  if (auth.user.role === USER_ROLES.VENDOR) {
    const vendor = await prisma.vendor.findFirst({ where: { ownerMongoId: auth.user.mongoId }, select: { mongoId: true } });
    if (!vendor || media.vendorMongoId !== vendor.mongoId) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to delete this media");
    }
  }

  try {
    ensureCloudinaryConfigured();
    if (media.provider === "cloudinary" && media.url) {
      const publicId = media.url.split("/").slice(-2).join("/").split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
  } catch {}

  await prisma.media.delete({ where: { id: media.id } });
  return sendSuccess(res, { message: "Media deleted successfully" });
}

module.exports = {
  uploadMedia,
  uploadMediaFile,
  listMedia,
  deleteMedia,
};
