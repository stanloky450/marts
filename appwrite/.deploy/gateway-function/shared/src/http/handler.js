const { buildContext } = require("./request");
const { sendError } = require("./response");

function pathToRegex(pathTemplate) {
  const names = [];
  const pattern = pathTemplate.replace(/:([^/]+)/g, (_, name) => {
    names.push(name);
    return "([^/]+)";
  });
  return {
    regex: new RegExp(`^${pattern}$`),
    names,
  };
}

function createRoute(method, path, handler) {
  const { regex, names } = pathToRegex(path);
  return { method: method.toUpperCase(), path, handler, regex, names };
}

function createHandler(routeDefinitions) {
  return async ({ req, res, log, error }) => {
    const ctx = buildContext(req);
    const matched = routeDefinitions.find((route) => route.method === ctx.method && route.regex.test(ctx.path));

    if (!matched) {
      return sendError(res, 404, "NOT_FOUND", `No route for ${ctx.method} ${ctx.path}`);
    }

    const match = ctx.path.match(matched.regex);
    ctx.params = {};
    matched.names.forEach((name, index) => {
      ctx.params[name] = decodeURIComponent(match[index + 1]);
    });

    try {
      return await matched.handler({ req, res, log, error, ctx });
    } catch (err) {
      if (error) error(err.stack || err.message);
      return sendError(res, err.statusCode || 500, err.code || "INTERNAL_SERVER_ERROR", err.message || "Unexpected error");
    }
  };
}

module.exports = {
  createRoute,
  createHandler,
};
