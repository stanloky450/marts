import { errorResponse } from "../utils/apiResponse.js"

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required"))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"))
    }

    next()
  }
}
