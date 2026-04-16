// In payment.controller.js - Add these imports at the top
// Assuming processSuccessfulRegistration is exported from the vendor controller:
import { processSuccessfulRegistration } from "./vendor.controller.js";
import { PAYMENT_TYPE, PAYMENT_STATUS } from "../utils/constants.js";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { verifyPayment } from "../utils/paystack.js";
import { logger } from "../utils/logger.js";

// export const verifyPaymentStatus = async (req, res, next) => {
//   try {
//     const { reference } = req.params

//     // Find payment in database
//     const payment = await Payment.findOne({ reference }).populate("user", "email").populate("vendor", "businessName")

//     if (!payment) {
//       return res.status(404).json(errorResponse("PAYMENT_NOT_FOUND", "Payment not found"))
//     }

//     // If already successful, return current status
//     if (payment.status === "success") {
//       return res.json(
//         successResponse({
//           payment,
//           message: "Payment already verified",
//         }),
//       )
//     }

//     // Verify with Paystack
//     const paystackData = await verifyPayment(reference)

//     if (paystackData.status === "success") {
//       payment.status = "success"
//       payment.paidAt = new Date(paystackData.paid_at)
//       await payment.save()

//       logger.info(`Payment verified: ${reference}`)
//     } else {
//       payment.status = "failed"
//       await payment.save()
//     }

//     res.json(
//       successResponse({
//         payment,
//         paystackStatus: paystackData.status,
//       }),
//     )
//   } catch (error) {
//     next(error)
//   }
// }

export const verifyPaymentStatus = async (req, res, next) => {
	try {
		const { reference } = req.params;

		// 1. Find payment
		let payment = await prisma.payment.findUnique({
			where: { reference }
		});

		if (!payment) {
			return res
				.status(404)
				.json(errorResponse("PAYMENT_NOT_FOUND", "Payment not found"));
		}

		// 2. Check if already successful AND registration is complete
		if (payment.status === "success" && payment.userMongoId && payment.vendorMongoId) {
			payment = await prisma.payment.findUnique({
				where: { id: payment.id },
				include: {
					user: { select: { email: true, profileFirstName: true, profileLastName: true, profilePhone: true } },
					vendor: { select: { businessName: true } }
				}
			});

			const mappedPayment = {
				...payment,
				_id: payment.mongoId,
				user: payment.user ? { ...payment.user, _id: payment.userMongoId } : null,
				vendor: payment.vendor ? { ...payment.vendor, _id: payment.vendorMongoId } : null,
			};

			return res.json(
				successResponse({
					payment: mappedPayment,
					message: "Payment already verified and registration complete",
				})
			);
		}

		let paystackData = null;
		let registrationTriggered = false;

		// 3. Verify with Paystack (if pending)
		if (payment.status !== "success") {
			paystackData = await verifyPayment(reference);
		}

		if (payment.status === "pending" && paystackData?.status === "success") {
			payment = await prisma.payment.update({
				where: { id: payment.id },
				data: {
					status: "success",
					paidAt: new Date(paystackData.paid_at)
				}
			});
			logger.info(`Payment verified and status updated: ${reference}`);
		} else if (paystackData?.status === "failed") {
			payment = await prisma.payment.update({
				where: { id: payment.id },
				data: { status: "failed" }
			});
			return res.json(
				successResponse({
					payment: { ...payment, _id: payment.mongoId },
					paystackStatus: paystackData.status,
				})
			);
		}

		// 4. Synchronous registration fallback
		if (
			payment.status === "success" &&
			!payment.userMongoId &&
			payment.type === "registration"
		) {
			logger.warn(`Payment verified but user/vendor missing for: ${reference}. Triggering synchronous registration.`);
			const registrationData = payment.metadata?.registrationData;

			if (registrationData) {
				try {
					await processSuccessfulRegistration(payment, registrationData);
					registrationTriggered = true;
					logger.info(`Synchronous registration completed for ${reference}.`);
				} catch (regError) {
					logger.error(`Synchronous registration FAILED for ${reference}: ${regError.message}`);
				}
			} else {
				logger.error(`Cannot complete registration for ${reference}: Missing registrationData in metadata.`);
			}
		}

		// 5. Re-fetch and Populate
		if (registrationTriggered || payment.status === "success") {
			payment = await prisma.payment.findUnique({
				where: { reference },
				include: {
					user: { select: { email: true, profileFirstName: true, profileLastName: true, profilePhone: true } },
					vendor: { select: { businessName: true } }
				}
			});
		}

		const finalMappedPayment = {
			...payment,
			_id: payment.mongoId,
			user: payment.user ? { ...payment.user, _id: payment.userMongoId } : null,
			vendor: payment.vendor ? { ...payment.vendor, _id: payment.vendorMongoId } : null,
		};

		res.json(
			successResponse({
				payment: finalMappedPayment,
				paystackStatus: paystackData?.status || "success",
			})
		);
	} catch (error) {
		next(error);
	}
};

export const listPayments = async (req, res, next) => {
	try {
		const { type, status, page = 1, limit = 20 } = req.query;

		const where = {};

		// Vendors see their own (by mongoId mapping)
		if (req.user.role === "vendor") {
			where.userMongoId = req.user.id;
		}

		if (type) where.type = type;
		if (status) where.status = status;

		const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

		const [payments, total] = await Promise.all([
			prisma.payment.findMany({
				where,
				include: {
					user: { select: { email: true, profileFirstName: true, profileLastName: true } },
					vendor: { select: { businessName: true } }
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take: Number.parseInt(limit),
			}),
			prisma.payment.count({ where }),
		]);

		const mappedPayments = payments.map(p => ({
			...p,
			_id: p.mongoId,
			user: p.user ? { ...p.user, _id: p.userMongoId } : null,
			vendor: p.vendor ? { ...p.vendor, _id: p.vendorMongoId } : null,
		}));

		res.json(
			successResponse(mappedPayments, {
				total,
				page: Number.parseInt(page),
				limit: Number.parseInt(limit),
				totalPages: Math.ceil(total / limit),
			})
		);
	} catch (error) {
		next(error);
	}
};
