import multer from "multer";
import { errorResponse } from "../utils/apiResponse.js";
import { uploadToCloud } from "../config/cloudinary.js";

// Configure multer for memory storage

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
	// Accept images and videos
	if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
		cb(null, true);
	} else {
		cb(new Error("Only image and video files are allowed"), false);
	}
};

export const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
});

export const fileUploaded = [
	upload.single("file"),
	async (req, res, next) => {
		try {
			console.log("[v0] Upload temp called");
			if (!req.file) {
				console.log("[v0] No file provided");
				return res.status(400).json({ error: "No file provided" });
			}

			console.log("[v0] Uploading file to Cloudinary:", req.file.originalname);
			const imageUrl = await uploadToCloud(
				req.file.buffer,
				req.file.originalname
			);
			console.log("[v0] File uploaded successfully:", imageUrl);
			res.json({ imageUrl });
		} catch (error) {
			console.error("[v0] Upload temp error:", error.message);
			res.status(500).json({ error: error.message || "Upload failed" });
		}
	},
];

export const uploadErrorHandler = (err, req, res, next) => {
	if (err instanceof multer.MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			return res
				.status(400)
				.json(errorResponse("FILE_TOO_LARGE", "File size cannot exceed 5MB"));
		}
		return res.status(400).json(errorResponse("UPLOAD_ERROR", err.message));
	}

	if (err) {
		return res.status(400).json(errorResponse("UPLOAD_ERROR", err.message));
	}

	next();
};
