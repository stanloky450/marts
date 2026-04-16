import prisma from "../lib/prisma.js"

// helper
const calculateExpiryDate = (days) => {
  const now = new Date()
  now.setDate(now.getDate() + days)
  return now
}

// CREATE AD
export const createAd = async (req, res) => {
  try {
    const { title, description, price, expiryDays } = req.body

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Banner image required" })
    }

    if (expiryDays < 1 || expiryDays > 7) {
      return res.status(400).json({
        success: false,
        message: "expiryDays must be between 1 and 7",
      })
    }

    const ad = await prisma.adPlacement.create({
      data: {
        slot: "home_hero", // Default slot for legacy compatibility
        description: description || title,
        price: Number.parseFloat(price) || 0,
        imageUrl: req.file.path,
        startDate: new Date(),
        endDate: calculateExpiryDate(parseInt(expiryDays, 10)),
        createdByMongoId: req.user.mongoId,
      }
    })

    res.status(201).json({
      success: true,
      message: "Ad created successfully",
      data: { ...ad, _id: ad.mongoId },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
