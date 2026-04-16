import express from "express";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { USER_ROLES } from "../utils/constants.js";
import {
  getUserThreads,
  getUserThreadByVendor,
  sendUserMessage,
  editUserMessage,
  deleteUserMessage,
  markUserThreadRead,
  getVendorThreads,
  getVendorThreadByMarketUser,
  sendVendorMessage,
  editVendorMessage,
  deleteVendorMessage,
  markVendorThreadRead,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/user/threads", getUserThreads);
router.get("/user/thread/:vendorMongoId", getUserThreadByVendor);
router.post("/user/thread/:vendorMongoId/messages", sendUserMessage);
router.patch("/user/thread/:vendorMongoId/messages/:messageId", editUserMessage);
router.delete("/user/thread/:vendorMongoId/messages/:messageId", deleteUserMessage);
router.post("/user/thread/:vendorMongoId/read", markUserThreadRead);

router.use("/vendor", authenticate, authorize(USER_ROLES.VENDOR));
router.get("/vendor/threads", getVendorThreads);
router.get("/vendor/thread/:marketUserId", getVendorThreadByMarketUser);
router.post("/vendor/thread/:marketUserId/messages", sendVendorMessage);
router.patch("/vendor/thread/:marketUserId/messages/:messageId", editVendorMessage);
router.delete("/vendor/thread/:marketUserId/messages/:messageId", deleteVendorMessage);
router.post("/vendor/thread/:marketUserId/read", markVendorThreadRead);

export default router;
