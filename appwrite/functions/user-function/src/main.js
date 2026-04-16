const { createRoute, createHandler, listUsers, getUser } = require("@migration/shared");

const routes = [
  createRoute("GET", "/api/v1/users", listUsers),
  createRoute("GET", "/api/v1/users/:id", getUser),
];

module.exports = async (context) => createHandler(routes)(context);
