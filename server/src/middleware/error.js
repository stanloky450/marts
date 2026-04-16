import { logger } from "../utils/logger.js"
import { errorResponse } from "../utils/apiResponse.js"

export const errorHandler = (err, req, res, next) => {
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  })

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }))

    return res.status(400).json(errorResponse("VALIDATION_ERROR", "Validation failed", details))
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(409).json(errorResponse("DUPLICATE_ERROR", `${field} already exists`))
  }

  // Mongoose cast error
  if (err.name === "CastError") {
    return res.status(400).json(errorResponse("INVALID_ID", "Invalid ID format"))
  }

  // Default error
  const statusCode = err.statusCode || 500
  const message = err.message || "Internal server error"

  res.status(statusCode).json(errorResponse("SERVER_ERROR", message))
}

export const notFoundHandler = (req, res) => {
  res.status(404).json(errorResponse("NOT_FOUND", `Route ${req.method} ${req.url} not found`))
}
