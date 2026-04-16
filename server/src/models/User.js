import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { USER_ROLES, USER_STATUS } from "../utils/constants.js";

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		passwordHash: {
			type: String,
			required: true,
		},
		role: {
			type: String,
			enum: Object.values(USER_ROLES),
			required: true,
		},
		status: {
			type: String,
			enum: Object.values(USER_STATUS),
			default: USER_STATUS.ACTIVE,
		},
		profile: {
			firstName: String,
			lastName: String,
			phone: String,
			region: String,
			notes: String,
		},
		lastLoginAt: Date,
	},
	{
		timestamps: true,
	}
);

// Indexes
// userSchema.index({ email: 1 })
// userSchema.index({ role: 1 })

// Hash password before saving
userSchema.pre("save", async function (next) {
	if (!this.isModified("passwordHash")) return next();

	try {
		const salt = await bcrypt.genSalt(10);
		this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove sensitive data from JSON
userSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.passwordHash;
	return obj;
};

export const User = mongoose.model("User", userSchema);
