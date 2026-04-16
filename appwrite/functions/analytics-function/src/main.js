const { createRoute, createHandler, marketplaceOverview } = require("@migration/shared");

const routes = [
  createRoute("GET", "/api/v1/analytics/overview", marketplaceOverview),
];

module.exports = async (context) => createHandler(routes)(context);
