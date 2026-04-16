import prisma from "../lib/prisma.js"
import { USER_ROLES, VENDOR_STATUS, PAYMENT_STATUS, PAYMENT_TYPE } from "../utils/constants.js"
import { logger } from "../utils/logger.js"
import bcrypt from "bcrypt"
import crypto from "crypto"

const seedVendorsData = [
  {
    user: {
      email: "vendor1@example.com",
      passwordHash: "Vendor123!",
      profile: { firstName: "Alice", lastName: "Vendor" },
    },
    vendor: {
      businessName: "Alice Electronics",
      description: "Quality gadgets and electronics",
      phone: "+1-555-1001",
      status: VENDOR_STATUS.ACTIVE,
      subdomain: "alice-electronics",
      address: { city: "Lagos", country: "NG" },
    },
  },
  {
    user: {
      email: "vendor2@example.com",
      passwordHash: "Vendor123!",
      profile: { firstName: "Bob", lastName: "Vendor" },
    },
    vendor: {
      businessName: "Bob Fashion House",
      description: "Trendy fashion and accessories",
      phone: "+1-555-1002",
      status: VENDOR_STATUS.ACTIVE,
      subdomain: "bob-fashion",
      address: { city: "Abuja", country: "NG" },
    },
  },
]

export const seedVendors = async () => {
  try {
    const existingVendors = await prisma.vendor.count()
    if (existingVendors > 0) {
      logger.info("Vendors already seeded")
      return
    }

    const saltRounds = 10;

    for (const entry of seedVendorsData) {
      // Create or find vendor user
      let user = await prisma.user.findUnique({ where: { email: entry.user.email } })
      if (!user) {
        const hashedPassword = await bcrypt.hash(entry.user.passwordHash, saltRounds);
        const userMongoId = crypto.randomBytes(12).toString("hex");
        
        user = await prisma.user.create({
          data: {
            mongoId: userMongoId,
            email: entry.user.email,
            passwordHash: hashedPassword,
            role: USER_ROLES.VENDOR,
            profileFirstName: entry.user.profile.firstName,
            profileLastName: entry.user.profile.lastName,
          }
        })
      }

      // Create vendor
      const vendorMongoId = crypto.randomBytes(12).toString("hex");
      const vendor = await prisma.vendor.create({
        data: {
          mongoId: vendorMongoId,
          businessName: entry.vendor.businessName,
          description: entry.vendor.description,
          phone: entry.vendor.phone,
          status: entry.vendor.status,
          subdomain: entry.vendor.subdomain,
          address: entry.vendor.address,
          ownerMongoId: user.mongoId,
        }
      })

      // Create successful registration payment for this vendor user
      const reference = `REG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const paymentMongoId = crypto.randomBytes(12).toString("hex");
      
      await prisma.payment.create({
        data: {
          mongoId: paymentMongoId,
          type: PAYMENT_TYPE.REGISTRATION,
          amount: 5000,
          currency: "NGN",
          reference,
          status: PAYMENT_STATUS.SUCCESS,
          userMongoId: user.mongoId,
          vendorMongoId: vendor.mongoId,
          paidAt: new Date(),
          metadata: { note: "Seeded registration payment" },
        }
      })

      // Create Subdomain record
      if (entry.vendor.subdomain) {
        const subdomainMongoId = crypto.randomBytes(12).toString("hex");
        await prisma.subdomain.upsert({
          where: { name: entry.vendor.subdomain },
          update: { vendorMongoId: vendor.mongoId },
          create: {
            mongoId: subdomainMongoId,
            name: entry.vendor.subdomain,
            vendorMongoId: vendor.mongoId,
            active: true
          }
        })
      }
    }

    logger.info(`Seeded ${seedVendorsData.length} vendors`)
  } catch (error) {
    logger.error("Error seeding vendors:", error)
    throw error
  }
}


