import { verifyAccessToken } from "../utils/jwt.js"
import { errorResponse } from "../utils/apiResponse.js"
import prisma from "../lib/prisma.js"

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "No token provided"))
    }

    const token = authHeader.substring(7)

    try {
      const decoded = verifyAccessToken(token)

      // Check if the decoded sub is a valid UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.sub);

      // Fetch user from database using Prisma
      // Look up by internal id (UUID) or legacy mongoId securely
      const user = await prisma.user.findFirst({
        where: isUuid 
          ? { id: decoded.sub } 
          : { mongoId: decoded.sub }
      })

      if (!user) {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"))
      }

      if (user.status !== "active") {
        return res.status(403).json(errorResponse("FORBIDDEN", "Account is suspended"))
      }

      // Attach user to request
      req.user = {
        id: user.mongoId, // Keep id as mongoId for backward compatibility
        pgId: user.id,    // Postgres UUID
        mongoId: user.mongoId,
        email: user.email,
        role: user.role,
        status: user.status,
      }

      next()
    } catch (error) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid or expired token"))
    }
  } catch (error) {
    next(error)
  }
}
