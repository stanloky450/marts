import mongoose from "mongoose";
import { VENDOR_STATUS } from "../utils/constants.js";

const vendorSchema = new mongoose.Schema(
	{
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		businessName: {
			type: String,
			required: false,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
		},
		artisanCategory: String, // ✅ new
		logo: String, // ✅ new
		logoUrl: String,
		profilePhotoUrl: String,
		bannerImage: String,
		themeColor: {
			type: String,
			enum: ["black", "deep_blue", "green", "purple_blue"],
			default: "black",
		},
		phoneNumber: String,
		whatsappNumber: String,
		socials: {
			facebook: String,
			instagram: String,
			x: String,
		},
		referralCodeUsed: String,
		status: {
			type: String,
			enum: Object.values(VENDOR_STATUS),
			default: VENDOR_STATUS.PENDING,
		},
		subdomain: {
			type: String,
			unique: true,
			sparse: true,
			lowercase: true,
		},
		address: {
			street: String,
			city: String,
			state: String,
			country: String,
			postalCode: String,
		},

		location: {
			region: { type: String, required: false },
			area: { type: String, required: false },
		},
		referralCodeUsed: String,
		meta: {
			views: { type: Number, default: 0 },
			followers: { type: Number, default: 0 },
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
vendorSchema.index({ businessName: 1 });
// vendorSchema.index({ subdomain: 1 });
vendorSchema.index({ status: 1 });

export const Vendor = mongoose.model("Vendor", vendorSchema);
