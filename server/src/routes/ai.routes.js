import express from "express";
import { z } from "zod";
import { aiChat } from "../controllers/ai.controller.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

const aiChatSchema = z.object({
  body: z.object({
    message: z.string().min(1, "Message is required").max(500),
    subdomain: z.string().optional(),
    context: z.string().max(200).optional(),
  }),
});

// Public endpoint — no auth required
router.post("/chat", aiChat);
// router.post("/chat", validate(aiChatSchema), aiChat);

export default router;
