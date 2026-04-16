import cors from "cors"
import { config } from "./env.js"

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    // Allow configured origin
    if (origin === config.cors.origin) {
      return callback(null, true)
    }

    // Allow subdomains of base domain
    const baseDomain = config.domain.base
    if (origin.endsWith(`.${baseDomain}`) || origin === `https://${baseDomain}`) {
      return callback(null, true)
    }

    callback(new Error("Not allowed by CORS"))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-subdomain"],
}

export const corsMiddleware = cors(corsOptions)
