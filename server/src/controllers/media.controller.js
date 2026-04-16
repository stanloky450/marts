import cloudinary from "../config/cloudinary.js"
import crypto from "crypto"
import { successResponse, errorResponse } from "../utils/apiResponse.js"
import { logger } from "../utils/logger.js"
import prisma from "../lib/prisma.js"

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse("NO_FILE", "No file uploaded"))
    }

    // Get vendor if user is a vendor
    let vendor = null
    if (req.user.role === "vendor") {
      vendor = await prisma.vendor.findFirst({
        where: { ownerMongoId: req.user.mongoId }
      })
      if (!vendor) {
        return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"))
      }
    }

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: vendor ? `vendors/${vendor.mongoId}` : "general",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        },
      )

      uploadStream.end(req.file.buffer)
    })

    const result = await uploadPromise

    // Save media record
    const media = await prisma.media.create({
      data: {
        mongoId: crypto.randomBytes(12).toString("hex"),
        url: result.secure_url,
        provider: "cloudinary",
        folder: result.folder,
        ownerUserMongoId: req.user.mongoId,
        vendorMongoId: vendor?.mongoId,
        width: result.width,
        height: result.height,
        mime: req.file.mimetype,
        size: req.file.size,
      }
    })

    logger.info(`Image uploaded: ${media.id} (mongoId: ${media.mongoId})`)

    res.status(201).json(successResponse({ ...media, _id: media.mongoId }))
  } catch (error) {
    logger.error("Upload error:", error)
    next(error)
  }
}

export const listMedia = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const where = {}

    // Vendors can only see their own media
    if (req.user.role === "vendor") {
      const vendor = await prisma.vendor.findFirst({
        where: { ownerMongoId: req.user.mongoId }
      })
      if (vendor) {
        where.vendorMongoId = vendor.mongoId
      }
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: qLimit,
      }),
      prisma.media.count({ where }),
    ])

    const mappedMedia = media.map(m => ({ ...m, _id: m.mongoId }))

    res.json(
      successResponse(mappedMedia, {
        total,
        page: qPage,
        limit: qLimit,
        totalPages: Math.ceil(total / qLimit),
      }),
    )
  } catch (error) {
    next(error)
  }
}

export const deleteMedia = async (req, res, next) => {
  try {
    const { id } = req.params

    const media = await prisma.media.findFirst({
        where: { OR: [{ id }, { mongoId: id }] }
    })

    if (!media) {
      return res.status(404).json(errorResponse("MEDIA_NOT_FOUND", "Media not found"))
    }

    // Check ownership
    if (req.user.role === "vendor") {
      const vendor = await prisma.vendor.findFirst({
        where: { ownerMongoId: req.user.mongoId }
      })
      if (!vendor || media.vendorMongoId !== vendor.mongoId) {
        return res.status(403).json(errorResponse("FORBIDDEN", "You do not have permission to delete this media"))
      }
    }

    // Delete from Cloudinary
    if (media.provider === "cloudinary") {
      const publicId = media.url.split("/").slice(-2).join("/").split(".")[0]
      await cloudinary.uploader.destroy(publicId)
    }

    await prisma.media.delete({ where: { id: media.id } })

    logger.info(`Media deleted: ${id}`)

    res.json(successResponse({ message: "Media deleted successfully" }))
  } catch (error) {
    next(error)
  }
}
