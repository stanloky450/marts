import { generateSKU } from "./crypto.js"

export const ensureSKU = (product) => {
  if (!product.sku) {
    product.sku = generateSKU()
  }

  // Ensure variants have SKUs
  if (product.variants && product.variants.length > 0) {
    product.variants = product.variants.map((variant) => {
      if (!variant.sku) {
        variant.sku = generateSKU()
      }
      return variant
    })
  }

  return product
}
