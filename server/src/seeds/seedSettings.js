import prisma from "../lib/prisma.js"
import { logger } from "../utils/logger.js"
import crypto from "crypto"

const defaultSettings = [
  { key: "site.name", value: "Commm Storefront", description: "Global site name" },
  { key: "site.currency", value: "NGN", description: "Default currency" },
  { key: "site.supportEmail", value: "support@example.com", description: "Support contact" },
]

export const seedSettings = async () => {
  try {
    const count = await prisma.setting.count()
    if (count > 0) {
      logger.info("Settings already seeded")
      return
    }

    const settingData = defaultSettings.map(s => ({
      ...s,
      mongoId: crypto.randomBytes(12).toString("hex"),
    }))

    await prisma.setting.createMany({
      data: settingData,
      skipDuplicates: true
    })

    logger.info(`Seeded ${defaultSettings.length} settings`)
  } catch (error) {
    logger.error("Error seeding settings:", error)
    throw error
  }
}


