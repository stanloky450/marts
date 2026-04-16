import mongoose from "mongoose";
import { PRODUCT_STATUS } from "../utils/constants.js";

const productSchema = new mongoose.Schema(
	{
		vendor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Vendor",
			required: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
		},
		category: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Category",
			required: true,
		},
		region: {
			type: String,
			trim: true,
		},
		price: {
			type: Number,
			required: true,
			min: 0,
		},
		discountPrice: {
			type: Number,
			min: 0,
		},
		promo: {
			start: Date,
			end: Date,
		},
		sku: {
			type: String,
			unique: true,
			sparse: true,
		},
		stock: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		// images: [
		// 	{
		// 		type: mongoose.Schema.Types.ObjectId,
		// 		ref: "Media",
		// 	},
		// ],
		images: [String],
		tags: [String],
		variants: [
			{
				size: String,
				color: String,
				sku: String,
				stock: Number,
				price: Number,
			},
		],
		status: {
			type: String,
			enum: Object.values(PRODUCT_STATUS),
			default: PRODUCT_STATUS.PENDING,
		},
		rejectionNote: String,
		meta: {
			views: { type: Number, default: 0 },
			sales: { type: Number, default: 0 },
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: "text", description: "text", tags: "text" });

// Validation: discountPrice must be less than price
productSchema.pre("save", function (next) {
	if (this.discountPrice && this.discountPrice >= this.price) {
		next(new Error("Discount price must be less than regular price"));
	}
	next();
});

export const Product = mongoose.model("Product", productSchema);
