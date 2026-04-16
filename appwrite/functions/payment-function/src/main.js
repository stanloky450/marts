const { createRoute, createHandler, verifyPaymentStatus, listPayments } = require("@migration/shared");

const routes = [
  createRoute("GET", "/api/v1/payments", listPayments),
  createRoute("GET", "/api/v1/payments/verify/:reference", verifyPaymentStatus),
];

module.exports = async (context) => createHandler(routes)(context);
