function normalizeHeaders(headers = {}) {
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    result[String(key).toLowerCase()] = value;
  }
  return result;
}

function getRawPath(req) {
  return req.path || req.url || "/";
}

function trimFunctionPrefix(pathname) {
  return pathname.replace(/^https?:\/\/[^/]+/i, "") || "/";
}

function getRequestPath(req) {
  return trimFunctionPrefix(getRawPath(req)).split("?")[0] || "/";
}

function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;

  const path = getRawPath(req);
  const url = new URL(path.startsWith("http") ? path : `http://localhost${path}`);
  return Object.fromEntries(url.searchParams.entries());
}

function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (!req.bodyText) return {};
  try {
    return JSON.parse(req.bodyText);
  } catch {
    return {};
  }
}

function buildContext(req) {
  return {
    method: String(req.method || "GET").toUpperCase(),
    path: getRequestPath(req),
    query: getQuery(req),
    body: getBody(req),
    headers: normalizeHeaders(req.headers),
    raw: req,
  };
}

function getBearerToken(headers) {
  const authorization = headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.slice(7);
}

function buildPagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(100, Number.parseInt(query.limit || "20", 10) || 20);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildDataTableMeta(query) {
  const draw = Number.parseInt(query.draw || "0", 10) || 0;
  const start = Math.max(0, Number.parseInt(query.start || "0", 10) || 0);
  const length = Math.min(100, Number.parseInt(query.length || "20", 10) || 20);
  return {
    draw,
    start,
    length,
    page: Math.floor(start / length) + 1,
    limit: length,
    skip: start,
  };
}

module.exports = {
  buildContext,
  buildPagination,
  buildDataTableMeta,
  getBearerToken,
  getRequestPath,
};
