import prisma from "../lib/prisma.js"
import { logger } from "../utils/logger.js"

export const connectDB = async () => {
  try {
    await prisma.$connect()
    logger.info("Prisma connected to PostgreSQL")
    return prisma
  } catch (error) {
    logger.error("Error connecting to PostgreSQL via Prisma:", error)
    process.exit(1)
  }
}
