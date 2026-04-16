export const paginate = (req, res, next) => {
  const page = Number.parseInt(req.query.page) || 1
  const limit = Math.min(Number.parseInt(req.query.limit) || 20, 100) // Max 100 items
  const skip = (page - 1) * limit

  req.pagination = {
    page,
    limit,
    skip,
  }

  next()
}

export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit)

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}
