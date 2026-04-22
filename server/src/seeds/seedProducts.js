import prisma from "../lib/prisma.js"
import { PRODUCT_STATUS } from "../utils/constants.js"
import { logger } from "../utils/logger.js"
import crypto from "crypto"

const sampleProductsFor = (vendorMongoId, categories) => [
  {
    vendorMongoId,
    name: "Wireless Headphones",
    description: "Noise-cancelling over-ear headphones",
    categoryMongoId: categories["electronics"],
    price: 199.99,
    stock: 50,
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&auto=format&fit=crop",
    ],
    tags: ["audio", "wireless"],
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    vendorMongoId,
    name: "Fitness Tracker",
    description: "Waterproof fitness band with heart rate monitor",
    categoryMongoId: categories["electronics"],
    price: 69.99,
    stock: 120,
    images: [
      "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1510017803434-a899398421b3?w=900&auto=format&fit=crop",
    ],
    tags: ["fitness", "wearable"],
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    vendorMongoId,
    name: "Casual T-Shirt",
    description: "100% cotton unisex tee",
    categoryMongoId: categories["fashion"],
    price: 19.99,
    stock: 200,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=900&auto=format&fit=crop",
    ],
    tags: ["clothing"],
    status: PRODUCT_STATUS.APPROVED,
  },
]

export const seedProducts = async () => {
  try {
    const existingProducts = await prisma.product.count()
    if (existingProducts > 0) {
      logger.info("Products already seeded")
      return
    }

    const categories = await prisma.category.findMany({})
    if (!categories || categories.length === 0) {
      logger.warn("No categories found, skipping product seeding")
      return
    }

    // Build a slug->mongoId map for ease
    const catMap = categories.reduce((acc, c) => {
      acc[c.slug] = c.mongoId
      return acc
    }, {})

    const vendors = await prisma.vendor.findMany({})
    if (!vendors || vendors.length === 0) {
      logger.warn("No vendors found, skipping product seeding")
      return
    }

    for (const vendor of vendors) {
      const productBatch = sampleProductsFor(vendor.mongoId, catMap).map((product) => ({
        ...product,
        region: vendor.locationRegion || null,
      }))
      
      const productData = productBatch.map(p => ({
        ...p,
        mongoId: crypto.randomBytes(12).toString("hex"),
      }))

      await prisma.product.createMany({
        data: productData,
        skipDuplicates: true
      })
    }

    logger.info("Seeded sample products for vendors")
  } catch (error) {
    logger.error("Error seeding products:", error)
    throw error
  }
}


