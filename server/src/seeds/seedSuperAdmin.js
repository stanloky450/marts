import prisma from "../lib/prisma.js";
import { USER_ROLES } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const seedSuperAdmin = async () => {
	try {
		const email =
			process.env.SEED_SUPERADMIN_EMAIL || "superadmin@ecommerce.com";
		const password =
			process.env.SEED_SUPERADMIN_PASSWORD || "SuperAdmin123!";

		if (!email || !password) {
			logger.warn(
				"Super admin credentials not provided"
			);
			return;
		}

		// Check if super admin already exists
		const existingSuperAdmin = await prisma.user.findUnique({
			where: { email },
		});

		if (existingSuperAdmin) {
			logger.info("Super admin already exists");
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const mongoId = crypto.randomBytes(12).toString("hex");

		// Create super admin using Prisma
		await prisma.user.create({
			data: {
				mongoId,
				email,
				passwordHash: hashedPassword,
				role: USER_ROLES.SUPER_ADMIN,
				profileFirstName: "Super",
				profileLastName: "Admin",
			},
		});

		logger.info(`Super admin created: ${email}`);
	} catch (error) {
		logger.error("Error seeding super admin:", error);
		throw error;
	}
};
