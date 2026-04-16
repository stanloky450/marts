export const buildFilterQuery = (queryParams, allowedFields = []) => {
  const filter = {}

  allowedFields.forEach((field) => {
    if (queryParams[field] !== undefined) {
      filter[field] = queryParams[field]
    }
  })

  return filter
}

export const buildPriceRangeQuery = (minPrice, maxPrice) => {
  const priceQuery = {}

  if (minPrice !== undefined) {
    priceQuery.$gte = Number.parseFloat(minPrice)
  }

  if (maxPrice !== undefined) {
    priceQuery.$lte = Number.parseFloat(maxPrice)
  }

  return Object.keys(priceQuery).length > 0 ? priceQuery : null
}

export const buildTextSearchQuery = (searchTerm) => {
  if (!searchTerm) return null

  return {
    $or: [
      { name: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
      { tags: { $in: [new RegExp(searchTerm, "i")] } },
    ],
  }
}

export const buildSortQuery = (sortParam) => {
  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    featured: { "meta.views": -1 },
    promo: { discountPrice: -1 },
  }

  return sortMap[sortParam] || { createdAt: -1 }
}
