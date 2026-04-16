import express from "express";
import {
  listVendorReviews,
  listProductReviews,
  upsertVendorReview,
  upsertProductReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.get("/vendor/:vendorMongoId", listVendorReviews);
router.get("/product/:productMongoId", listProductReviews);
router.post("/vendor/:vendorMongoId", upsertVendorReview);
router.post("/product/:productMongoId", upsertProductReview);

export default router;
