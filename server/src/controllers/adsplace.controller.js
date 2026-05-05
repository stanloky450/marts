import prisma from "../lib/prisma.js"
import { uploadToCloud } from "../config/cloudinary.js"
import crypto from "crypto"

// Helper to calculate duration in days
const getDurationInDays = (start, end) => {
  const diffTime = Math.abs(new Date(end) - new Date(start))
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export const createAd = async (req, res) => {
  try {
    const { slot, description, price, startDate, endDate, targetUrl, priority } = req.body
    let imageUrl = req.body.imageUrl

    if (req.file) {
      const uploadedUrl = await uploadToCloud(req.file.buffer, req.file.originalname)
      imageUrl = uploadedUrl
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL or file is required" })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = getDurationInDays(start, end)

    if (duration < 1 || duration > 7) {
      return res.status(400).json({ message: "Ad duration must be between 1 and 7 days" })
    }

    const savedAd = await prisma.adPlacement.create({
      data: {
        mongoId: crypto.randomBytes(12).toString("hex"),
        slot,
        imageUrl,
        description,
        price: Number.parseFloat(price),
        startDate: start,
        endDate: end,
        targetUrl,
        priority: parseInt(priority, 10) || 0,
        createdByMongoId: req.user.mongoId,
      }
    })

    res.status(201).json({ ...savedAd, _id: savedAd.mongoId })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAds = async (req, res) => {
  try {
    const { active } = req.query
    const filter = {}
    
    if (active !== undefined) {
      filter.active = active === 'true'
    }

    const ads = await prisma.adPlacement.findMany({
      where: filter,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    const mappedAds = ads.map(ad => ({ ...ad, _id: ad.mongoId }))
    res.status(200).json(mappedAds)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateAd = async (req, res) => {
  try {
    const { id } = req.params
    const updates = { ...req.body }
    
    if (req.file) {
      const uploadedUrl = await uploadToCloud(req.file.buffer, req.file.originalname)
      updates.imageUrl = uploadedUrl
    }

    const ad = await prisma.adPlacement.findFirst({
        where: { OR: [{ id }, { mongoId: id }] }
    })
    if (!ad) return res.status(404).json({ message: "Ad not found" })

    // If dates are being updated, re-validate duration
    if (updates.startDate || updates.endDate) {
      const start = new Date(updates.startDate || ad.startDate)
      const end = new Date(updates.endDate || ad.endDate)
      const duration = getDurationInDays(start, end)

      if (duration < 1 || duration > 7) {
        return res.status(400).json({ message: "Ad duration must be between 1 and 7 days" })
      }
      updates.startDate = start
      updates.endDate = end
    }

    if (updates.price !== undefined && updates.price !== "") {
      updates.price = Number.parseFloat(updates.price)
    }
    if (updates.priority !== undefined && updates.priority !== "") {
      updates.priority = parseInt(updates.priority, 10)
    }
    if (updates.active !== undefined) updates.active = updates.active === 'true' || updates.active === true

    const updatedAd = await prisma.adPlacement.update({
        where: { id: ad.id },
        data: {
            ...updates,
            updatedByMongoId: req.user.mongoId
        }
    })

    res.status(200).json({ ...updatedAd, _id: updatedAd.mongoId })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteAd = async (req, res) => {
  try {
    const { id } = req.params
    const ad = await prisma.adPlacement.findFirst({
        where: { OR: [{ id }, { mongoId: id }] }
    })
    
    if (!ad) {
      return res.status(404).json({ message: "Ad not found" })
    }

    await prisma.adPlacement.delete({ where: { id: ad.id } })

    res.status(200).json({ message: "Ad deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
