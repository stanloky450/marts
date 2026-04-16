import { successResponse, errorResponse } from "../utils/apiResponse.js"
import { logger } from "../utils/logger.js"
import prisma from "../lib/prisma.js"

export const listUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query

    const where = {}
    if (role) where.role = role
    if (status) where.status = status

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profileFirstName: { contains: search, mode: 'insensitive' } },
        { profileLastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: qLimit,
      }),
      prisma.user.count({ where }),
    ])

    const mappedUsers = users.map(u => {
      const { passwordHash, ...rest } = u
      return { 
        ...rest, 
        _id: u.mongoId,
        profile: {
          firstName: u.profileFirstName,
          lastName: u.profileLastName,
          phone: u.profilePhone,
          photoUrl: u.profilePhotoUrl
        }
      }
    })

    res.json(
      successResponse(mappedUsers, {
        total,
        page: qPage,
        limit: qLimit,
        totalPages: Math.ceil(total / qLimit),
      }),
    )
  } catch (error) {
    next(error)
  }
}

export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!user) {
      return res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"))
    }

    const { passwordHash, ...safeUser } = user
    res.json(successResponse({
      ...safeUser, 
      _id: user.mongoId,
      profile: {
        firstName: user.profileFirstName,
        lastName: user.profileLastName,
        phone: user.profilePhone,
        photoUrl: user.profilePhotoUrl
      }
    }))
  } catch (error) {
    next(error)
  }
}

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const { firstName, lastName, phone, status } = req.body

    const user = await prisma.user.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!user) {
      return res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"))
    }

    const updateData = {}
    if (firstName) updateData.profileFirstName = firstName
    if (lastName) updateData.profileLastName = lastName
    if (phone) updateData.profilePhone = phone
    if (status) updateData.status = status

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    })

    logger.info(`User updated: ${id} by ${req.user.email}`)

    const { passwordHash, ...safeUser } = updatedUser
    res.json(successResponse({
      ...safeUser, 
      _id: updatedUser.mongoId,
      profile: {
        firstName: updatedUser.profileFirstName,
        lastName: updatedUser.profileLastName,
        phone: updatedUser.profilePhone,
        photoUrl: updatedUser.profilePhotoUrl
      }
    }))
  } catch (error) {
    next(error)
  }
}

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!user) {
      return res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"))
    }

    // Prevent deleting super admin
    if (user.role === "super_admin") {
      return res.status(403).json(errorResponse("FORBIDDEN", "Cannot delete super admin"))
    }

    await prisma.user.delete({
      where: { id: user.id }
    })

    logger.info(`User deleted: ${id} by ${req.user.email}`)

    res.json(successResponse({ message: "User deleted successfully" }))
  } catch (error) {
    next(error)
  }
}
