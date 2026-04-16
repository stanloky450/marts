export const successResponse = (data, meta = null) => {
  const response = {
    success: true,
    data,
  }

  if (meta) {
    response.meta = meta
  }

  return response
}

export const errorResponse = (code, message, details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  }

  if (details) {
    response.error.details = details
  }

  return response
}
