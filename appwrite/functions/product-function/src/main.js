const {
  createRoute,
  createHandler,
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  approveProduct,
  rejectProduct,
  trackView,
  getProductAnalytics,
} = require("@migration/shared");

const routes = [
  createRoute("POST", "/api/v1/products", createProduct),
  createRoute("GET", "/api/v1/products", listProducts),
  createRoute("GET", "/api/v1/products/analytics/mine", getProductAnalytics),
  createRoute("GET", "/api/v1/products/:id", getProduct),
  createRoute("PATCH", "/api/v1/products/:id", updateProduct),
  createRoute("DELETE", "/api/v1/products/:id", deleteProduct),
  createRoute("PATCH", "/api/v1/products/:id/approve", approveProduct),
  createRoute("PATCH", "/api/v1/products/:id/reject", rejectProduct),
  createRoute("POST", "/api/v1/products/:id/view", trackView),
];

module.exports = async (context) => createHandler(routes)(context);
