import crypto from "crypto";
import prisma from "../lib/prisma.js";

export const generateSubdomain = (businessName) => {
	// Convert to lowercase, remove special characters, replace spaces with hyphens
	const generated = (businessName || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);

	return generated || `store-${crypto.randomBytes(3).toString("hex")}`;
};

export const findAvailableSubdomain = async (baseSubdomain) => {
	let subdomain = baseSubdomain;
	let counter = 1;

	while (true) {
		const [existingSubdomain, existingVendor] = await Promise.all([
			prisma.subdomain.findUnique({ where: { name: subdomain } }),
			prisma.vendor.findUnique({ where: { subdomain } }),
		]);

		if (!existingSubdomain && !existingVendor) {
			return subdomain;
		}

		subdomain = `${baseSubdomain}-${counter}`;
		counter++;

		// Prevent infinite loop
		if (counter > 1000) {
			throw new Error("Unable to generate unique subdomain");
		}
	}
};

// export const checkSubdomainAvailability = async (subdomain) => {
// 	const existing = await Subdomain.findOne({ name: subdomain });
// 	return !existing;
// };

// export const checkSubdomainExists = async (subdomain) => {
// 	const existing = await Subdomain.findOne({ name: subdomain });
// 	return !!existing;
// };

export const createSubdomainForVendor = async (vendor) => {
	if (!vendor) throw new Error("Vendor is required");

	const vendorId = vendor.id;
	const vendorMongoId = vendor.mongoId;

	if (!vendorMongoId) {
		throw new Error("Vendor mongoId is required to create subdomain");
	}

	// If vendor already has a subdomain, ensure Subdomain table is consistent.
	if (vendor.subdomain) {
		await prisma.subdomain.upsert({
			where: { name: vendor.subdomain },
			update: { vendorMongoId, active: true },
			create: {
				mongoId: crypto.randomBytes(12).toString("hex"),
				name: vendor.subdomain,
				vendorMongoId,
				active: true,
			},
		});
		return vendor.subdomain;
	}

	// If there is already a subdomain row for this vendor, sync back to vendor record.
	const existingForVendor = await prisma.subdomain.findFirst({
		where: { vendorMongoId, active: true },
		orderBy: { createdAt: "asc" },
	});
	if (existingForVendor) {
		await prisma.vendor.update({
			where: vendorId ? { id: vendorId } : { mongoId: vendorMongoId },
			data: { subdomain: existingForVendor.name },
		});
		return existingForVendor.name;
	}

	const baseSubdomain = generateSubdomain(vendor.businessName);
	for (let attempt = 0; attempt < 5; attempt++) {
		const availableSubdomain = await findAvailableSubdomain(baseSubdomain);
		try {
			await prisma.$transaction(async (tx) => {
				await tx.subdomain.create({
					data: {
						mongoId: crypto.randomBytes(12).toString("hex"),
						name: availableSubdomain,
						vendorMongoId,
						active: true,
					},
				});

				await tx.vendor.update({
					where: vendorId ? { id: vendorId } : { mongoId: vendorMongoId },
					data: { subdomain: availableSubdomain },
				});
			});
			return availableSubdomain;
		} catch (error) {
			if (error?.code === "P2002") {
				continue;
			}
			throw error;
		}
	}

	throw new Error("Unable to generate unique subdomain");
};
