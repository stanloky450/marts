import express from "express"
import {
  getStoreInfo,
  getStoreProducts,
  getStoreProduct,
  getStoreProductBySKU,
  searchStores,
  listAllStores,
  getFeaturedProducts,
  getNewArrivals,
  getPublicProductById,
  listPublicProducts,
  searchAllProducts,
} from "../controllers/storefront.controller.js"
import { extractSubdomain, requireSubdomain } from "../middleware/subdomain.js"

const router = express.Router()

// Global marketplace routes (no subdomain required)
router.get("/stores", listAllStores)
router.get("/stores/search", searchStores)
router.get("/products/featured", getFeaturedProducts)
router.get("/products/new", getNewArrivals)
router.get("/products", listPublicProducts)
router.get("/products/search", searchAllProducts)
router.get("/products/:id", getPublicProductById)

// Store-specific routes (subdomain required)
router.use(extractSubdomain)

router.get("/store/info", requireSubdomain, getStoreInfo)
router.get("/store/products", requireSubdomain, getStoreProducts)
router.get("/store/products/:id", requireSubdomain, getStoreProduct)
router.get("/store/products/sku/:sku", requireSubdomain, getStoreProductBySKU)

export default router
