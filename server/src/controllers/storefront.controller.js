import { successResponse, errorResponse } from "../utils/apiResponse.js"
import { PRODUCT_STATUS } from "../utils/constants.js"
import prisma from "../lib/prisma.js"

const PRODUCT_TYPE_TAG_PREFIX = "__type:"

const detectProductType = (product) => {
  const tags = Array.isArray(product?.tags) ? product.tags : []
  const tagged = tags.find((t) => typeof t === "string" && t.startsWith(PRODUCT_TYPE_TAG_PREFIX))
  if (tagged === `${PRODUCT_TYPE_TAG_PREFIX}service`) return "service"
  if (tagged === `${PRODUCT_TYPE_TAG_PREFIX}product`) return "product"

  const variants = product?.variants
  if (variants && !Array.isArray(variants) && typeof variants === "object" && variants.kind === "service") {
    return "service"
  }
  return "product"
}

const extractServiceMeta = (product) => {
  const variants = product?.variants
  if (variants && !Array.isArray(variants) && typeof variants === "object" && variants.kind === "service") {
    return variants
  }
  return null
}

const mapStoreProduct = (product) => {
  const productType = detectProductType(product)
  const serviceMeta = extractServiceMeta(product)
  return {
    ...product,
    _id: product.mongoId,
    productType,
    duration: productType === "service" ? serviceMeta?.duration : undefined,
    videoUrl: productType === "service" ? serviceMeta?.videoUrl : undefined,
    priceMin: productType === "service" ? serviceMeta?.priceMin : undefined,
    priceMax: productType === "service" ? serviceMeta?.priceMax : undefined,
    category: product.category ? { ...product.category, _id: product.category.mongoId } : null
  }
}

export const getStoreInfo = async (req, res, next) => {
  try {
    const vendor = req.vendor

    // Get product count
    const productCount = await prisma.product.count({
      where: {
        vendorMongoId: vendor.mongoId,
        status: PRODUCT_STATUS.APPROVED,
      }
    })

    // Get categories used by this vendor
    const productCategories = await prisma.product.findMany({
      where: {
        vendorMongoId: vendor.mongoId,
        status: PRODUCT_STATUS.APPROVED,
      },
      distinct: ['categoryMongoId'],
      select: { categoryMongoId: true }
    })

    const categoryMongoIds = productCategories.map(p => p.categoryMongoId).filter(Boolean)

    const categories = await prisma.category.findMany({
      where: {
        mongoId: { in: categoryMongoIds },
      },
      select: { name: true, slug: true, icon: true, mongoId: true }
    })

    const storeInfo = {
      mongoId: vendor.mongoId,
      businessName: vendor.businessName,
      description: vendor.description,
      subdomain: vendor.subdomain,
      logoUrl: vendor.logoUrl,
      profilePhotoUrl: vendor.profilePhotoUrl,
      phone: vendor.phone || vendor.phoneNumber,
      whatsapp: vendor.whatsapp || vendor.whatsappNumber,
      socials: vendor.socials,
      address: vendor.address,
      bannerImage: vendor.bannerImage,
      themeColor: vendor.themeColor,
      productCount,
      categories: categories.map(c => ({ ...c, _id: c.mongoId })),
    }

    res.json(successResponse(storeInfo))
  } catch (error) {
    next(error)
  }
}

export const getStoreProducts = async (req, res, next) => {
  try {
    const vendor = req.vendor
    const { category, search, minPrice, maxPrice, sort = "createdAt_desc", page = 1, limit = 20 } = req.query

    const where = {
      vendorMongoId: vendor.mongoId,
      status: PRODUCT_STATUS.APPROVED,
    }

    if (category) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(category)
        const cat = await prisma.category.findFirst({ 
          where: isUuid ? { id: category } : { mongoId: category }
        })
        if (cat) where.categoryMongoId = cat.mongoId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = Number.parseFloat(minPrice)
      if (maxPrice) where.price.lte = Number.parseFloat(maxPrice)
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    // Handle sort string
    let orderBy = { createdAt: 'desc' }
    if (sort) {
        const parts = sort.replace('-', '').split('_')
        const field = parts[0]
        const order = sort.startsWith('-') || parts[1] === 'desc' ? 'desc' : 'asc'
        if (['price', 'createdAt', 'name'].includes(field)) {
            orderBy = { [field]: order }
        }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
            category: { select: { name: true, slug: true, mongoId: true } },
        },
        orderBy,
        skip,
        take: qLimit,
      }),
      prisma.product.count({ where }),
    ])

    const mappedProducts = products.map(mapStoreProduct)

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

export const getStoreProduct = async (req, res, next) => {
  try {
    const vendor = req.vendor
    const { id } = req.params

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)

    const product = await prisma.product.findFirst({
      where: {
        ...(isUuid ? { id } : { mongoId: id }),
        vendorMongoId: vendor.mongoId,
        status: PRODUCT_STATUS.APPROVED,
      },
      include: {
        category: { select: { name: true, slug: true, mongoId: true } },
      }
    })

    if (!product) {
      return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"))
    }

    // Increment views
    await prisma.product.update({
      where: { id: product.id },
      data: { metaViews: { increment: 1 } }
    })

    res.json(successResponse(mapStoreProduct(product)))
  } catch (error) {
    next(error)
  }
}

export const getStoreProductBySKU = async (req, res, next) => {
  try {
    const vendor = req.vendor
    const { sku } = req.params

    const product = await prisma.product.findFirst({
      where: {
        sku: sku.toUpperCase(),
        vendorMongoId: vendor.mongoId,
        status: PRODUCT_STATUS.APPROVED,
      },
      include: {
        category: { select: { name: true, slug: true, mongoId: true } },
      }
    })

    if (!product) {
      return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"))
    }

    // Increment views
    await prisma.product.update({
      where: { id: product.id },
      data: { metaViews: { increment: 1 } }
    })

    res.json(successResponse(mapStoreProduct(product)))
  } catch (error) {
    next(error)
  }
}

export const searchStores = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query

    if (!search) {
      return res.status(400).json(errorResponse("MISSING_SEARCH", "Search query is required"))
    }

    const where = {
      status: "active",
      OR: [
        { businessName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ],
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: { 
            id: true,
            mongoId: true,
            businessName: true,
            description: true,
            subdomain: true,
            logoUrl: true,
            profilePhotoUrl: true,
            _count: {
                select: { products: { where: { status: PRODUCT_STATUS.APPROVED } } }
            }
        },
        orderBy: { businessName: 'asc' },
        skip,
        take: qLimit,
      }),
      prisma.vendor.count({ where }),
    ])

    const vendorsWithCounts = vendors.map((vendor) => {
      const { _count, ...rest } = vendor
      return {
        ...rest,
        _id: vendor.mongoId,
        productCount: _count.products,
      }
    })

    res.json(
      successResponse(vendorsWithCounts, {
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

export const listAllStores = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const where = { status: "active" }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: { 
            id: true,
            mongoId: true,
            businessName: true,
            description: true,
            subdomain: true,
            logoUrl: true,
            profilePhotoUrl: true,
            _count: {
                select: { products: { where: { status: PRODUCT_STATUS.APPROVED } } }
            }
        },
        orderBy: { businessName: 'asc' },
        skip,
        take: qLimit,
      }),
      prisma.vendor.count({ where }),
    ])

    const vendorsWithCounts = vendors.map((vendor) => {
        const { _count, ...rest } = vendor
        return {
          ...rest,
          _id: vendor.mongoId,
          productCount: _count.products,
        }
    })

    res.json(
      successResponse(vendorsWithCounts, {
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

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 12 } = req.query

    const qLimit = Math.min(100, parseInt(limit, 10) || 12)

    // Get products with highest views
    const products = await prisma.product.findMany({
      where: {
        status: PRODUCT_STATUS.APPROVED,
      },
      include: {
        vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
      orderBy: [
        { metaViews: 'desc' },
        { createdAt: 'desc' }
      ],
      take: qLimit
    })

    const mappedProducts = products.map(p => ({
        ...p,
        _id: p.mongoId,
        vendor: p.vendor ? { ...p.vendor, _id: p.vendor.mongoId } : null,
        category: p.category ? { ...p.category, _id: p.category.mongoId } : null
    }))

    res.json(successResponse(mappedProducts))
  } catch (error) {
    next(error)
  }
}

export const listPublicProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      region,
      area,
      minPrice,
      maxPrice,
      page = 1,
      limit = 24,
    } = req.query

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 24)
    const skip = (qPage - 1) * qLimit

    const where = {
      status: PRODUCT_STATUS.APPROVED,
    }

    if (category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(category)
      const cat = await prisma.category.findFirst({
        where: isUuid ? { id: category } : { mongoId: category }
      })
      if (cat) where.categoryMongoId = cat.mongoId
    }

    if (region) {
      where.region = String(region).trim()
    }

    if (area) {
      where.vendor = {
        is: {
          locationArea: String(area).trim(),
        },
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { vendor: { is: { businessName: { contains: search, mode: "insensitive" } } } },
      ]
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = Number.parseFloat(minPrice)
      if (maxPrice) where.price.lte = Number.parseFloat(maxPrice)
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          vendor: {
            select: {
              businessName: true,
              subdomain: true,
              logoUrl: true,
              mongoId: true,
              locationRegion: true,
              locationArea: true,
              phoneNumber: true,
              whatsappNumber: true,
            },
          },
          category: { select: { name: true, slug: true, mongoId: true } },
        },
        orderBy: [{ metaViews: "desc" }, { createdAt: "desc" }],
        skip,
        take: qLimit,
      }),
      prisma.product.count({ where }),
    ])

    const mappedProducts = products.map((product) => ({
      ...mapStoreProduct(product),
      vendor: product.vendor
        ? {
            ...product.vendor,
            _id: product.vendor.mongoId,
          }
        : null,
      category: product.category ? { ...product.category, _id: product.category.mongoId } : null,
    }))

    res.json(
      successResponse(mappedProducts, {
        total,
        page: qPage,
        limit: qLimit,
        totalPages: Math.ceil(total / qLimit),
      })
    )
  } catch (error) {
    next(error)
  }
}

export const getNewArrivals = async (req, res, next) => {
  try {
    const { limit = 12 } = req.query

    const qLimit = Math.min(100, parseInt(limit, 10) || 12)

    // Get newest approved products
    const products = await prisma.product.findMany({
      where: {
        status: PRODUCT_STATUS.APPROVED,
      },
      include: {
        vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: qLimit
    })

    const mappedProducts = products.map(p => ({
        ...p,
        _id: p.mongoId,
        vendor: p.vendor ? { ...p.vendor, _id: p.vendor.mongoId } : null,
        category: p.category ? { ...p.category, _id: p.category.mongoId } : null
    }))

    res.json(successResponse(mappedProducts))
  } catch (error) {
    next(error)
  }
}

export const getPublicProductById = async (req, res, next) => {
  try {
    const { id } = req.params
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)

    const product = await prisma.product.findFirst({
      where: {
        ...(isUuid ? { id } : { mongoId: id }),
        status: PRODUCT_STATUS.APPROVED,
      },
      include: {
        vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
        category: { select: { name: true, slug: true, mongoId: true } },
      },
    })

    if (!product) {
      return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product not found"))
    }

    res.json(
      successResponse({
        ...mapStoreProduct(product),
        vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
      })
    )
  } catch (error) {
    next(error)
  }
}

export const searchAllProducts = async (req, res, next) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query

    if (!search) {
      return res.status(400).json(errorResponse("MISSING_SEARCH", "Search query is required"))
    }

    const where = {
      status: PRODUCT_STATUS.APPROVED,
      OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(category)
        const cat = await prisma.category.findFirst({ 
          where: isUuid ? { id: category } : { mongoId: category }
        })
        if (cat) where.categoryMongoId = cat.mongoId
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = Number.parseFloat(minPrice)
      if (maxPrice) where.price.lte = Number.parseFloat(maxPrice)
    }

    const qPage = Math.max(1, parseInt(page, 10) || 1)
    const qLimit = Math.min(100, parseInt(limit, 10) || 20)
    const skip = (qPage - 1) * qLimit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
            vendor: { select: { businessName: true, subdomain: true, logoUrl: true, mongoId: true } },
            category: { select: { name: true, slug: true, mongoId: true } },
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
