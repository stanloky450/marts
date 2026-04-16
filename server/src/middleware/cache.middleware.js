// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redisClient.js";

export const cacheMiddleware = async (req, res, next) => {
	try {
		const key = req.originalUrl;

		const cachedData = await redisClient.get(key);
		if (cachedData) {
			console.log("🔁 Serving from cache:", key);
			return res.status(200).json(JSON.parse(cachedData));
		}

		// Override res.send to cache response automatically
		const originalJson = res.json.bind(res);
		res.json = (body) => {
			redisClient.setEx(key, 3600, JSON.stringify(body)); // cache for 1 hour
			return originalJson(body);
		};

		next();
	} catch (error) {
		console.error("Redis cache error:", error);
		next();
	}
};
