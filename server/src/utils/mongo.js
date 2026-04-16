export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

export const sanitizeQuery = (query) => {
  const sanitized = { ...query }

  // Remove MongoDB operators from user input
  Object.keys(sanitized).forEach((key) => {
    if (key.startsWith("$")) {
      delete sanitized[key]
    }
  })

  return sanitized
}
