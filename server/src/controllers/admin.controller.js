import { successResponse, errorResponse } from "../utils/apiResponse.js"
import { USER_ROLES, PRODUCT_STATUS, PAYMENT_STATUS, VENDOR_STATUS } from "../utils/constants.js"
import { logger } from "../utils/logger.js"
import prisma from "../lib/prisma.js"

export const createAdmin = async (req, res, next) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      region,
      notes,
      locationRegion,
      vendorIds,
      referralCode,
    } = req.body

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(409).json(errorResponse("USER_EXISTS", "Email already registered"))
    }

    const crypto = await import('crypto');
    const mongoId = crypto.randomBytes(12).toString('hex');

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        mongoId,
        email,
        passwordHash: password, // Logic assumes hashing happened before or handled by app logic
        role: USER_ROLES.ADMIN,
        profileFirstName: firstName,
        profileLastName: lastName,
        profileRegion: region,
        profileNotes: notes,
      }
    })

    logger.info(`Admin created: ${admin.id} by ${req.user.email}`)

    // --- Auto-assign vendors based on the chosen mode ---
    let vendorsToAssignIds = []

    if (locationRegion) {
      const vendors = await prisma.vendor.findMany({ 
        where: { locationRegion: locationRegion },
        select: { id: true } 
      })
      vendorsToAssignIds = vendors.map(v => v.id)
    } else if (vendorIds && vendorIds.length > 0) {
      // Find internal ids for the provided mongoIds or internal ids
      const vendors = await prisma.vendor.findMany({
        where: { OR: [{ mongoId: { in: vendorIds } }, { id: { in: vendorIds } }] },
        select: { id: true }
      })
      vendorsToAssignIds = vendors.map(v => v.id)
    } else if (referralCode) {
      const vendors = await prisma.vendor.findMany({ 
        where: { referralCodeUsed: referralCode },
        select: { id: true }
      })
      vendorsToAssignIds = vendors.map(v => v.id)
    }

    let assignmentCount = 0
    if (vendorsToAssignIds.length > 0) {
      const assignments = vendorsToAssignIds.map((vId) => ({
        adminId: admin.id,
        vendorId: vId,
        region: locationRegion || region,
        notes,
      }))

      const result = await prisma.adminAssignment.createMany({
        data: assignments,
        skipDuplicates: true
      })
      assignmentCount = result.count
      logger.info(`Admin ${admin.id}: ${assignmentCount} vendor(s) assigned`)
    }

    const { passwordHash, ...safeAdmin } = admin
    res.status(201).json(successResponse({ 
      ...safeAdmin, 
      _id: admin.mongoId,
      profile: {
        firstName: admin.profileFirstName,
        lastName: admin.profileLastName,
        region: admin.profileRegion,
        notes: admin.profileNotes
      },
      assignedVendors: assignmentCount 
    }))
  } catch (error) {
    next(error)
  }
}

export const listAdmins = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query

    const where = { role: USER_ROLES.ADMIN }
    if (status) where.status = status

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: qLimit,
        include: { _count: { select: { adminAssignments: true } } }
      }),
      prisma.user.count({ where }),
    ])

    const mappedAdmins = admins.map(a => {
      const { passwordHash, _count, ...rest } = a
      return {
        ...rest,
        _id: a.mongoId,
        profile: {
          firstName: a.profileFirstName,
          lastName: a.profileLastName,
          region: a.profileRegion,
          notes: a.profileNotes
        },
        assignedVendors: _count.adminAssignments
      }
    })

    res.json(
      successResponse(mappedAdmins, {
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

export const updateAdmin = async (req, res, next) => {
  try {
    const { id } = req.params
    const { firstName, lastName, status, region, notes, email } = req.body

    const admin = await prisma.user.findFirst({
      where: { 
        OR: [{ mongoId: id }, { id: id }],
        role: USER_ROLES.ADMIN 
      }
    })

    if (!admin) {
      return res.status(404).json(errorResponse("ADMIN_NOT_FOUND", "Admin not found"))
    }

    const updateData = {}
    if (firstName) updateData.profileFirstName = firstName
    if (lastName) updateData.profileLastName = lastName
    if (email) updateData.email = email
    if (region) updateData.profileRegion = region
    if (notes) updateData.profileNotes = notes
    if (status) updateData.status = status

    const updatedAdmin = await prisma.user.update({
      where: { id: admin.id },
      data: updateData
    })

    logger.info(`Admin updated: ${id} by ${req.user.email}`)

    const { passwordHash, ...safeAdmin } = updatedAdmin
    res.json(successResponse({
      ...safeAdmin,
      _id: updatedAdmin.mongoId,
      profile: {
        firstName: updatedAdmin.profileFirstName,
        lastName: updatedAdmin.profileLastName,
        region: updatedAdmin.profileRegion,
        notes: updatedAdmin.profileNotes
      }
    }))
  } catch (error) {
    next(error)
  }
}

export const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params

    const admin = await prisma.user.findFirst({
      where: { 
        OR: [{ mongoId: id }, { id: id }],
        role: USER_ROLES.ADMIN 
      }
    })

    if (!admin) {
      return res.status(404).json(errorResponse("ADMIN_NOT_FOUND", "Admin not found"))
    }

    await prisma.$transaction([
      prisma.adminAssignment.deleteMany({ where: { adminId: admin.id } }),
      prisma.user.delete({ where: { id: admin.id } })
    ])

    logger.info(`Admin deleted: ${id} by ${req.user.email}`)

    res.json(successResponse({ message: "Admin deleted successfully" }))
  } catch (error) {
    next(error)
  }
}

export const assignVendor = async (req, res, next) => {
  try {
    const { adminId, vendorId, region, notes } = req.body

    // Validate admin
    const admin = await prisma.user.findFirst({
      where: { OR: [{ mongoId: adminId }, { id: adminId }], role: USER_ROLES.ADMIN }
    })
    if (!admin) {
      return res.status(404).json(errorResponse("ADMIN_NOT_FOUND", "Admin not found"))
    }

    // Validate vendor
    const vendor = await prisma.vendor.findFirst({
      where: { OR: [{ mongoId: vendorId }, { id: vendorId }] }
    })
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor not found"))
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.adminAssignment.findUnique({
      where: {
        adminId_vendorId: {
          adminId: admin.id,
          vendorId: vendor.id
        }
      }
    })

    if (existingAssignment) {
      return res.status(409).json(errorResponse("ASSIGNMENT_EXISTS", "This admin is already assigned to this vendor"))
    }

    const crypto = await import('crypto');
    const mongoId = crypto.randomBytes(12).toString('hex');

    // Create assignment
    const assignment = await prisma.adminAssignment.create({
      data: {
        mongoId,
        adminId: admin.id,
        vendorId: vendor.id,
        region,
        notes,
      }
    })

    logger.info(`Admin ${admin.id} assigned to vendor ${vendor.id}`)

    res.status(201).json(successResponse({ ...assignment, _id: assignment.mongoId }))
  } catch (error) {
    next(error)
  }
}

export const unassignVendor = async (req, res, next) => {
  try {
    const { id } = req.params

    const assignment = await prisma.adminAssignment.findFirst({
      where: { OR: [{ mongoId: id }, { id: id }] }
    })

    if (!assignment) {
      return res.status(404).json(errorResponse("ASSIGNMENT_NOT_FOUND", "Assignment not found"))
    }

    await prisma.adminAssignment.delete({ where: { id: assignment.id } })

    logger.info(`Assignment deleted: ${id}`)

    res.json(successResponse({ message: "Vendor unassigned successfully" }))
  } catch (error) {
    next(error)
  }
}

export const getAssignedVendors = async (req, res, next) => {
  try {
    const adminId = req.user.id

    // Use findFirst for user context
    const user = await prisma.user.findFirst({
      where: { OR: [{ mongoId: adminId }, { id: adminId }] }
    })
    
    if (!user) {
        return res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"))
    }

    const assignments = await prisma.adminAssignment.findMany({
      where: { adminId: user.id },
      include: {
        vendor: {
          include: {
            owner: {
              select: {
                email: true,
                mongoId: true,
                profileFirstName: true,
                profileLastName: true,
                profilePhone: true,
                profilePhotoUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get product counts for each vendor
    const vendorsWithStats = await Promise.all(
      assignments.map(async (assignment) => {
        const productStats = await prisma.product.groupBy({
          by: ['status'],
          where: { vendorId: assignment.vendorId },
          _count: { _all: true }
        })

        const stats = {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }

        productStats.forEach((stat) => {
          const statusKey = stat.status.toLowerCase()
          if (stats.hasOwnProperty(statusKey)) {
              stats[statusKey] = stat._count._all
          }
          stats.total += stat._count._all
        })

        const { vendor, ...assignmentRest } = assignment
        const mappedVendor = {
            ...vendor,
            _id: vendor.mongoId,
            owner: vendor.owner ? {
                ...vendor.owner,
                _id: vendor.owner.mongoId,
                profile: {
                    firstName: vendor.owner.profileFirstName,
                    lastName: vendor.owner.profileLastName,
                    phone: vendor.owner.profilePhone,
                    photoUrl: vendor.owner.profilePhotoUrl
                }
            } : null
        }

        return {
          assignment: { ...assignmentRest, _id: assignment.mongoId, vendor: mappedVendor },
          stats,
        }
      }),
    )

    res.json(successResponse(vendorsWithStats))
  } catch (error) {
    next(error)
  }
}

export const getPendingProducts = async (req, res, next) => {
  try {
    const adminId = req.user.id
    const { page = 1, limit = 20 } = req.query

    const user = await prisma.user.findFirst({
        where: { OR: [{ mongoId: adminId }, { id: adminId }] }
    })

    if (!user) {
        return res.status(404).json(errorResponse("USER_NOT_FOUND", "User not found"))
    }

    // Get assigned vendors
    const assignments = await prisma.adminAssignment.findMany({ 
        where: { adminId: user.id },
        select: { vendorId: true }
    })

    const vendorIds = assignments.map((a) => a.vendorId)

    // Get pending products for assigned vendors
    const where = {
      vendorId: { in: vendorIds },
      status: PRODUCT_STATUS.PENDING,
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
            vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
            category: { select: { name: true, slug: true, mongoId: true } },
            images: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: qLimit,
      }),
      prisma.product.count({ where }),
    ])

    const mappedProducts = products.map(p => ({
        ...p,
        _id: p.mongoId,
        vendor: p.vendor ? { ...p.vendor, _id: p.vendor.mongoId } : null,
        category: p.category ? { ...p.category, _id: p.category.mongoId } : null
    }))

    res.json(
      successResponse(mappedProducts, {
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

export const listAllAssignments = async (req, res, next) => {
  try {
    const { adminId, vendorId, page = 1, limit = 20 } = req.query

    const where = {}

    if (adminId) {
        const user = await prisma.user.findFirst({ where: { OR: [{ mongoId: adminId }, { id: adminId }] } })
        if (user) where.adminId = user.id
    }

    if (vendorId) {
        const vendor = await prisma.vendor.findFirst({ where: { OR: [{ mongoId: vendorId }, { id: vendorId }] } })
        if (vendor) where.vendorId = vendor.id
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [assignments, total] = await Promise.all([
      prisma.adminAssignment.findMany({
        where,
        include: {
            admin: {
                select: {
                    email: true,
                    mongoId: true,
                    profileFirstName: true,
                    profileLastName: true,
                    profilePhone: true,
                    profilePhotoUrl: true
                }
            },
            vendor: { select: { businessName: true, subdomain: true, mongoId: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: qLimit,
      }),
      prisma.adminAssignment.count({ where }),
    ])

    const mappedAssignments = assignments.map(a => ({
        ...a,
        _id: a.mongoId,
        adminUser: a.admin ? {
            ...a.admin,
            _id: a.admin.mongoId,
            profile: {
                firstName: a.admin.profileFirstName,
                lastName: a.admin.profileLastName,
                phone: a.admin.profilePhone,
                photoUrl: a.admin.profilePhotoUrl
            }
        } : null,
        vendor: a.vendor ? { ...a.vendor, _id: a.vendor.mongoId } : null
    }))

    res.json(
      successResponse(mappedAssignments, {
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

export const getDashboardStats = async (req, res, next) => {
  try {
    // Get total counts
    const [
      totalProducts,
      totalVendors,
      totalAdmins,
      totalRevenueData,
      totalViewsData
    ] = await Promise.all([
      prisma.product.count({ where: { status: PRODUCT_STATUS.APPROVED } }),
      prisma.vendor.count({ where: { status: VENDOR_STATUS.ACTIVE } }),
      prisma.user.count({ where: { role: USER_ROLES.ADMIN } }),
      prisma.payment.aggregate({
        where: { status: PAYMENT_STATUS.SUCCESS },
        _sum: { amount: true }
      }),
      prisma.product.aggregate({
        _sum: { views: true }
      })
    ])

    // Get recent activity counts (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      recentProducts,
      recentVendors,
      recentRevenueData,
      dailyRevenueData
    ] = await Promise.all([
      prisma.product.count({ 
        where: { 
          status: PRODUCT_STATUS.APPROVED,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.vendor.count({ 
        where: { 
          status: VENDOR_STATUS.ACTIVE,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.payment.aggregate({
        where: { 
          status: PAYMENT_STATUS.SUCCESS,
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true }
      }),
      prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as date, SUM(amount) as revenue
        FROM "Payment"
        WHERE status = ${PAYMENT_STATUS.SUCCESS} AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1 ASC
      `
    ])

    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyRevenueData.find(d => d.date.toISOString().split('T')[0] === dateStr);
      chartData.push({
        date: dateStr,
        revenue: dayData ? Number(dayData.revenue) : 0,
      });
    }

    const stats = {
      totals: {
        products: totalProducts,
        vendors: totalVendors,
        admins: totalAdmins,
        revenue: Number(totalRevenueData._sum.amount || 0),
        views: Number(totalViewsData._sum.views || 0)
      },
      recent: {
        products: recentProducts,
        vendors: recentVendors,
        revenue: Number(recentRevenueData._sum.amount || 0)
      },
      chartData
    }

    res.json(successResponse(stats))
  } catch (error) {
    next(error)
  }
}
