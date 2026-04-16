import winston from "winston";
import { config } from "../config/env.js";


const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
);

export const logger = winston.createLogger({
	level: config.env === "development" ? "debug" : "info",
	format: logFormat,
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(
					({ timestamp, level, message, ...meta }) =>
						`${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""}`
				)
			),
		}),
	],
});
