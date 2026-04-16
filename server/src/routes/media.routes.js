import express from "express";
import {
	uploadImage,
	listMedia,
	deleteMedia,
} from "../controllers/media.controller.js";
import { authenticate } from "../middleware/auth.js";
import {
	fileUploaded,
	upload,
	uploadErrorHandler,
} from "../middleware/upload.js";

const router = express.Router();

// Media routes
router.post(
	"/upload",
	authenticate,
	upload.single("image"),
	uploadErrorHandler,
	uploadImage
);
router.post("/uploadfile", fileUploaded);
router.get("/", authenticate, listMedia);
router.delete("/:id", authenticate, deleteMedia);

export default router;
