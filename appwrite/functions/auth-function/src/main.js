const { createRoute, createHandler, login, refresh, logout, me } = require("@migration/shared");

const routes = [
  createRoute("POST", "/api/v1/auth/login", login),
  createRoute("POST", "/api/v1/auth/refresh", refresh),
  createRoute("POST", "/api/v1/auth/logout", logout),
  createRoute("GET", "/api/v1/auth/me", me),
];

module.exports = async (context) => createHandler(routes)(context);
