function successResponse(data, meta = null) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return body;
}

function errorResponse(code, message, details = null) {
  const body = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) body.error.details = details;
  return body;
}

function sendJson(res, statusCode, body, headers = {}) {
  return res.json(body, statusCode, {
    "content-type": "application/json",
    ...headers,
  });
}

function sendSuccess(res, data, meta = null, statusCode = 200, headers = {}) {
  return sendJson(res, statusCode, successResponse(data, meta), headers);
}

function sendError(res, statusCode, code, message, details = null, headers = {}) {
  return sendJson(res, statusCode, errorResponse(code, message, details), headers);
}

module.exports = {
  successResponse,
  errorResponse,
  sendJson,
  sendSuccess,
  sendError,
};
