// lib/redis.ts
import { createClient } from "redis";
import { logger } from "../utils/logger.js";

const redisClient = createClient({
	url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));
redisClient.on("connect", () => logger.info("✅ Redis connected successfully"));

await redisClient.connect();

export default redisClient;

// Helper functions
export const cacheSet = async (key, value, ttlSeconds = 3600) => {
	try {
		await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
	} catch (err) {
		logger.error("Redis set error:", err);
	}
};

export const cacheGet = async (key) => {
	try {
		const data = await redisClient.get(key);
		return data ? JSON.parse(data) : null;
	} catch (err) {
		logger.error("Redis get error:", err);
		return null;
	}
};

export const cacheDelete = async (key) => {
	try {
		await redisClient.del(key);
	} catch (err) {
		logger.error("Redis delete error:", err);
	}
};
