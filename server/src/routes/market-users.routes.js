import express from "express";
import { z } from "zod";
import {
  listMarketUsers,
  loginMarketUser,
  registerMarketUser,
  updateMarketUserStatus,
  validateMarketUserSession,
} from "../controllers/market-user.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Valid email is required"),
    phoneNumber: z.string().min(3, "Phone number is required"),
    region: z.string().min(2, "Region is required"),
    area: z.string().min(2, "Area is required"),
    selectedProductIds: z.array(z.string()).optional(),
    selectedProductNames: z.array(z.string()).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    phoneNumber: z.string().min(3, "Phone number is required"),
  }),
});

const validateSessionSchema = z.object({
  body: z.object({
    id: z.string().min(1, "User session id is required"),
    email: z.string().email("Valid email is required"),
  }),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "suspended"]),
  }),
});

router.post("/register", validate(registerSchema), registerMarketUser);
router.post("/login", validate(loginSchema), loginMarketUser);
router.post("/session/validate", validate(validateSessionSchema), validateMarketUserSession);

router.get(
  "/",
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  listMarketUsers
);
router.patch(
  "/:id/status",
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validate(updateStatusSchema),
  updateMarketUserStatus
);

export default router;
