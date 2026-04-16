import mongoose from "mongoose";
import { CATEGORY_STATUS } from "../utils/constants.js";

const categorySchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		parent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Category",
			default: null,
		},
		icon: String,
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		status: {
			type: String,
			enum: Object.values(CATEGORY_STATUS),
			default: CATEGORY_STATUS.ACTIVE,
		  },
		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
// categorySchema.index({ slug: 1 });
// categorySchema.index({ name: 1 });

export const Category = mongoose.model("Category", categorySchema);
