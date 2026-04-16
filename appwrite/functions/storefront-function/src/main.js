const {
  createRoute,
  createHandler,
  listAllStores,
  searchStores,
  getStoreInfo,
  getStoreProducts,
  getStoreProduct,
  getPublicProductById,
  getFeaturedProducts,
  getNewArrivals,
  searchAllProducts,
} = require("@migration/shared");

const routes = [
  createRoute("GET", "/api/v1/storefront/stores", listAllStores),
  createRoute("GET", "/api/v1/storefront/stores/search", searchStores),
  createRoute("GET", "/api/v1/storefront/products/featured", getFeaturedProducts),
  createRoute("GET", "/api/v1/storefront/products/new", getNewArrivals),
  createRoute("GET", "/api/v1/storefront/products/search", searchAllProducts),
  createRoute("GET", "/api/v1/storefront/products/:id", getPublicProductById),
  createRoute("GET", "/api/v1/storefront/store/info", getStoreInfo),
  createRoute("GET", "/api/v1/storefront/store/products", getStoreProducts),
  createRoute("GET", "/api/v1/storefront/store/products/:id", getStoreProduct),
];

module.exports = async (context) => createHandler(routes)(context);
