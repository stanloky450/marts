import { errorResponse } from "../utils/apiResponse.js"

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })

      req.body = validated.body || req.body
      req.query = validated.query || req.query
      req.params = validated.params || req.params

      next()
    } catch (error) {
      if (error.errors) {
        // Zod validation error
        const details = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }))

        return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", details))
      }

      next(error)
    }
  }
}
