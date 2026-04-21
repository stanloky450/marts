import prisma from "../lib/prisma.js";
import { USER_ROLES } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const seedAdmin = async () => {
	try {
		const email = process.env.SEED_ADMIN_EMAIL || "adminweb@ecommerce.com";
		const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";

		if (!email || !password) {
			logger.warn(
				"Admin credentials not provided"
			);
			return;
		}

		// Check if admin already exists
		const existingAdmin = await prisma.user.findUnique({
			where: { email },
		});

		if (existingAdmin) {
			logger.info("Admin already exists");
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const mongoId = crypto.randomBytes(12).toString("hex");

		// Create admin using Prisma
		await prisma.user.create({
			data: {
				mongoId,
				email,
				passwordHash: hashedPassword,
				role: USER_ROLES.ADMIN,
				profileFirstName: "Web",
				profileLastName: "Admin",
			},
		});

		logger.info(`Admin created: ${email}`);
	} catch (error) {
		logger.error("Error seeding admin:", error);
		throw error;
	}
};
