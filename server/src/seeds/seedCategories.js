import prisma from "../lib/prisma.js"
import { USER_ROLES } from "../utils/constants.js"
import { logger } from "../utils/logger.js"
import crypto from "crypto"

const categories = [
  { name: "Electronics", slug: "electronics" },
  { name: "Fashion", slug: "fashion" },
  { name: "Home & Garden", slug: "home-garden" },
  { name: "Sports & Outdoors", slug: "sports-outdoors" },
  { name: "Books", slug: "books" },
  { name: "Toys & Games", slug: "toys-games" },
  { name: "Health & Beauty", slug: "health-beauty" },
  { name: "Food & Beverages", slug: "food-beverages" },
]

export const seedCategories = async () => {
  try {
    // Check if categories already exist
    const existingCount = await prisma.category.count()

    if (existingCount > 0) {
      logger.info("Categories already seeded")
      return
    }

    // Get super admin as creator
    const superAdmin = await prisma.user.findFirst({ where: { role: USER_ROLES.SUPER_ADMIN } })

    if (!superAdmin) {
      logger.warn("Super admin not found, skipping category seeding")
      return
    }

    // Create categories
    const categoryData = categories.map((cat) => ({
      ...cat,
      mongoId: crypto.randomBytes(12).toString("hex"),
      createdByMongoId: superAdmin.mongoId,
    }))

    await prisma.category.createMany({
      data: categoryData,
      skipDuplicates: true,
    })

    logger.info(`Seeded ${categories.length} categories`)
  } catch (error) {
    logger.error("Error seeding categories:", error)
    throw error
  }
}
