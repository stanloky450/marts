import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { corsMiddleware } from "./config/cors.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { logger } from "./utils/logger.js";
import routes from "./routes/index.js";

const app = express();

// The Next.js dev server proxies requests to this API locally.
app.set("trust proxy", 1);

// Connect to database
await connectDB();

// Security middleware
app.use(helmet());
app.use(corsMiddleware);

// Body parsing middleware
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// RAW BODY for Paystack Webhook (must come BEFORE express.json)
app.use(
	"/api/v1/paystack/webhook", // <-- USE YOUR ACTUAL WEBHOOK PATH
	express.raw({ type: "*/*" })
);

// Now normal body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use(
	morgan("combined", {
		stream: {
			write: (message) => logger.info(message.trim()),
		},
	})
);

// Rate limiting
app.use(globalLimiter);

// API routes
app.use(config.apiPrefix, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
	logger.info(`Server running on port ${config.port} in ${config.env} mode`);
	logger.info(
		`API available at http://localhost:${config.port}${config.apiPrefix}`
	);
});

// Graceful shutdown
process.on("SIGTERM", () => {
	logger.info("SIGTERM signal received: closing HTTP server");
	process.exit(0);
});

process.on("SIGINT", () => {
	logger.info("SIGINT signal received: closing HTTP server");
	process.exit(0);
});
