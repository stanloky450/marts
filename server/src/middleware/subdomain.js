import prisma from "../lib/prisma.js"
import { errorResponse } from "../utils/apiResponse.js"

export const extractSubdomain = async (req, res, next) => {
  try {
    // Get subdomain from header (set by frontend/proxy)
    const subdomainHeader = req.headers["x-subdomain"]

    // Or extract from host
    const host = req.headers.host || ""
    const parts = host.split(".")

    let subdomainName = subdomainHeader

    // If no header, try to extract from host
    if (!subdomainName && parts.length > 2) {
      subdomainName = parts[0]
    }

    if (subdomainName) {
      const subdomain = await prisma.subdomain.findFirst({
        where: {
          name: subdomainName,
          active: true,
        },
        include: { vendor: true }
      })

      if (subdomain && subdomain.vendor) {
        req.subdomain = { ...subdomain, _id: subdomain.mongoId }
        req.vendor = { ...subdomain.vendor, _id: subdomain.vendor.mongoId }
      }
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const requireSubdomain = (req, res, next) => {
  if (!req.subdomain || !req.vendor) {
    return res.status(404).json(errorResponse("SUBDOMAIN_NOT_FOUND", "Store not found"))
  }

  if (req.vendor.status !== "active") {
    return res.status(403).json(errorResponse("STORE_INACTIVE", "This store is currently inactive"))
  }

  next()
}
