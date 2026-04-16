import "../config/env.js";
import { connectDB } from "../config/db.js"
import { seedAdmin } from "./seedAdmin.js"
import { seedSuperAdmin } from "./seedSuperAdmin.js"
import { seedCategories } from "./seedCategories.js"
import { seedVendors } from "./seedVendors.js"
import { seedProducts } from "./seedProducts.js"
import { seedSettings } from "./seedSettings.js"
import { logger } from "../utils/logger.js"

const runSeeds = async () => {
  try {
    logger.info("Starting database seeding...")

    await connectDB()

    await seedAdmin()
    await seedSuperAdmin()
    await seedSettings()
    await seedCategories()
    await seedVendors()
    await seedProducts()

    logger.info("Database seeding completed successfully")
    process.exit(0)
  } catch (error) {
    logger.error("Error during seeding:", error)
    process.exit(1)
  }
}

runSeeds()
