import { successResponse, errorResponse } from "../utils/apiResponse.js"
import prisma from "../lib/prisma.js"
import {
  nigeriaLocationCatalog,
  isValidCatalogState,
  isValidLocalGovernmentForState,
} from "../data/nigeria-location-catalog.js"

const normalizeAreas = (areas) => {
  if (!Array.isArray(areas)) return []
  return Array.from(
    new Set(
      areas
        .map((a) => String(a || "").trim())
        .filter(Boolean)
    )
  )
}

const validateCatalogSelection = (state, region) => {
  if (!isValidCatalogState(state)) {
    return `State "${state}" is not in Nigeria state catalog`
  }
  if (!isValidLocalGovernmentForState(state, region)) {
    return `Region "${region}" is not a valid Local Government in ${state}`
  }
  return null
}

export const getNigeriaCatalog = async (req, res, next) => {
  try {
    res.json(successResponse(nigeriaLocationCatalog))
  } catch (error) {
    next(error)
  }
}

export const createLocation = async (req, res, next) => {
  try {
    const {
      state,
      region,
      areas,
      registrationFee,
      isActive,
      source = "custom"
    } = req.body
    const normalizedRegion = String(region || "").trim()
    const normalizedAreas = normalizeAreas(areas)
    const normalizedState = String(state || "").trim()

    if (!normalizedRegion) {
      return res.status(400).json(errorResponse("INVALID_INPUT", "Region is required"))
    }
    if (normalizedAreas.length === 0) {
      return res.status(400).json(errorResponse("INVALID_INPUT", "At least one area is required"))
    }

    if (source === "nigeria_catalog") {
      const err = validateCatalogSelection(normalizedState, normalizedRegion)
      if (err) {
        return res.status(400).json(errorResponse("INVALID_CATALOG_SELECTION", err))
      }
    }

    const existing = await prisma.location.findFirst({
      where: { region: { equals: normalizedRegion, mode: 'insensitive' } }
    })
    if (existing) {
      return res.status(400).json(errorResponse("LOCATION_EXISTS", "Region already exists"))
    }

    const crypto = await import('crypto');
    const mongoId = crypto.randomBytes(12).toString('hex');

    const location = await prisma.location.create({
      data: {
        mongoId,
        region: normalizedRegion,
        areas: normalizedAreas,
        registrationFee: Number(registrationFee) || 0,
        isActive: isActive !== false,
        // createdBy: req.user?._id,
      }
    })

    res.status(201).json(successResponse({ ...location, _id: location.mongoId }))
  } catch (error) {
    next(error)
  }
}

export const getLocations = async (req, res, next) => {
  try {
    const { activeOnly } = req.query
    const where = {}
    if (activeOnly === "true") {
      where.isActive = true
    }

    const locations = await prisma.location.findMany({
      where,
      orderBy: { region: 'asc' }
    })
    
    const mappedLocations = locations.map(l => ({ ...l, _id: l.mongoId }))
    res.json(successResponse(mappedLocations))
  } catch (error) {
    next(error)
  }
}

export const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      state,
      region,
      areas,
      registrationFee,
      isActive,
      source = "custom"
    } = req.body

    const existingLocation = await prisma.location.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!existingLocation) {
      return res.status(404).json(errorResponse("LOCATION_NOT_FOUND", "Location not found"))
    }

    const nextRegion = region ? String(region).trim() : existingLocation.region
    const nextAreas = Array.isArray(areas) ? normalizeAreas(areas) : existingLocation.areas
    const normalizedState = String(state || "").trim()

    if (!nextRegion) {
      return res.status(400).json(errorResponse("INVALID_INPUT", "Region is required"))
    }
    if (!nextAreas || nextAreas.length === 0) {
      return res.status(400).json(errorResponse("INVALID_INPUT", "At least one area is required"))
    }

    if (source === "nigeria_catalog") {
      const err = validateCatalogSelection(normalizedState, nextRegion)
      if (err) {
        return res.status(400).json(errorResponse("INVALID_CATALOG_SELECTION", err))
      }
    }

    if (region !== undefined) {
      const duplicate = await prisma.location.findFirst({
        where: { region: { equals: nextRegion, mode: 'insensitive' }, id: { not: existingLocation.id } }
      })
      if (duplicate) {
        return res.status(400).json(errorResponse("LOCATION_EXISTS", "Region name already exists"))
      }
    }

    const updatedLocation = await prisma.location.update({
      where: { id: existingLocation.id },
      data: {
        region: nextRegion,
        areas: nextAreas,
        registrationFee:
          registrationFee !== undefined
            ? Number(registrationFee) || 0
            : existingLocation.registrationFee,
        isActive: isActive !== undefined ? Boolean(isActive) : existingLocation.isActive,
      }
    })

    res.json(successResponse({ ...updatedLocation, _id: updatedLocation.mongoId }))
  } catch (error) {
    next(error)
  }
}

export const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params
    const location = await prisma.location.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!location) {
      return res.status(404).json(errorResponse("LOCATION_NOT_FOUND", "Location not found"))
    }

    await prisma.location.delete({
      where: { id: location.id }
    })

    res.json(successResponse({ message: "Location deleted successfully" }))
  } catch (error) {
    next(error)
  }
}
