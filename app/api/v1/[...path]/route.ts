import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "origin",
  "proxy-authenticate",
  "proxy-authorization",
  "referer",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type AppwriteExecutionHeader = {
  name: string;
  value: string;
};

type AppwriteExecutionResult = {
  responseStatusCode?: number;
  responseBody?: string;
  responseHeaders?: AppwriteExecutionHeader[];
  errors?: string;
};

type BufferedRequestBody = {
  bytes?: ArrayBuffer;
  text: string;
  base64?: string;
};

function shouldEncodeBodyAsBase64(contentType: string | null) {
  if (!contentType) return false;

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("multipart/form-data") ||
    normalized.includes("application/octet-stream")
  );
}

function getConfiguredProxyBaseUrl() {
  const value = process.env.API_PROXY_TARGET_URL || process.env.APPWRITE_API_GATEWAY_URL;

  if (!value) {
    return null;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getLegacyFallbackBaseUrl() {
  const value = process.env.LEGACY_API_BASE_URL;
  if (value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
  }

  return "http://localhost:5700/api";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function buildUpstreamUrl(baseUrl: string, path: string[], request: NextRequest) {
  const upstream = new URL(`${baseUrl}/${path.join("/")}`);
  upstream.search = request.nextUrl.search;
  return upstream;
}

function buildRequestHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const forwardedHost = request.headers.get("host");
  if (forwardedHost) {
    headers.set("x-forwarded-host", forwardedHost);
  }
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  return headers;
}

function getAppwriteExecutionConfig() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const functionId = process.env.APPWRITE_FUNCTION_ID || "gateway-function";

  if (!endpoint || !projectId || !apiKey) {
    return null;
  }

  return {
    endpoint: endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint,
    projectId,
    apiKey,
    functionId,
  };
}

function headersToExecutionObject(headers: Headers) {
  const object: Record<string, string> = {};

  headers.forEach((value, key) => {
    object[key] = value;
  });

  return object;
}

function responseHeadersFromExecution(headers: AppwriteExecutionHeader[] = []) {
  const responseHeaders = new Headers();

  for (const header of headers) {
    if (!HOP_BY_HOP_HEADERS.has(header.name.toLowerCase())) {
      responseHeaders.set(header.name, header.value);
    }
  }

  return responseHeaders;
}

async function executeViaAppwrite(
  request: NextRequest,
  path: string[],
  body: BufferedRequestBody,
) {
  const config = getAppwriteExecutionConfig();
  if (!config) {
    return null;
  }

  const method = request.method.toUpperCase();
  const headers = buildRequestHeaders(request);
  const useBase64Body = shouldEncodeBodyAsBase64(request.headers.get("content-type"));
  const executionUrl = `${config.endpoint}/functions/${config.functionId}/executions`;

  if (useBase64Body) {
    headers.set("x-body-encoding", "base64");
  }

  const executionResponse = await fetch(executionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": config.apiKey,
    },
    cache: "no-store",
    body: JSON.stringify({
      async: false,
      method,
      path: `/api/v1/${path.join("/")}${request.nextUrl.search}`,
      headers: headersToExecutionObject(headers),
      body: useBase64Body ? body.base64 || "" : body.text,
    }),
  });

  if (!executionResponse.ok) {
    const text = await executionResponse.text();
    return new Response(text || "Appwrite execution request failed", {
      status: executionResponse.status,
      statusText: executionResponse.statusText,
    });
  }

  const execution = (await executionResponse.json()) as AppwriteExecutionResult;
  const responseHeaders = responseHeadersFromExecution(execution.responseHeaders);
  const status = execution.responseStatusCode ?? 500;

  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(execution.responseBody || execution.errors || "", {
    status,
    headers: responseHeaders,
  });
}

async function proxyToBaseUrl(
  baseUrl: string,
  request: NextRequest,
  path: string[],
  body: BufferedRequestBody,
) {
  const upstreamUrl = buildUpstreamUrl(baseUrl, path, request);
  const method = request.method.toUpperCase();
  const headers = buildRequestHeaders(request);

  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = body.bytes ? body.bytes.slice(0) : undefined;
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const configuredBaseUrl = getConfiguredProxyBaseUrl();
  const legacyFallbackBaseUrl = getLegacyFallbackBaseUrl();
  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? { text: "" }
      : await (async (): Promise<BufferedRequestBody> => {
          const bytes = await request.arrayBuffer();
          const buffer = Buffer.from(bytes);
          return {
            bytes,
            text: new TextDecoder().decode(bytes),
            base64: buffer.toString("base64"),
          };
        })();

  if (configuredBaseUrl) {
    try {
      return await proxyToBaseUrl(configuredBaseUrl, request, path, body);
    } catch {
      try {
        const appwriteResponse = await executeViaAppwrite(request, path, body);
        if (appwriteResponse && appwriteResponse.status !== 404) {
          return appwriteResponse;
        }
      } catch {
        // Ignore Appwrite execution errors here and allow the local legacy fallback below.
      }
    }
  }

  try {
    const appwriteResponse = await executeViaAppwrite(request, path, body);
    if (appwriteResponse && appwriteResponse.status !== 404) {
      return appwriteResponse;
    }
  } catch {
    // Ignore Appwrite execution errors and fall back to the local legacy server below.
  }

  if (isProductionRuntime()) {
    return Response.json(
      {
        success: false,
        error: {
          code: "API_BACKEND_UNAVAILABLE",
          message:
            "API backend is unavailable. Configure APPWRITE_API_GATEWAY_URL or valid Appwrite execution credentials.",
        },
      },
      { status: 503 }
    );
  }

  return proxyToBaseUrl(legacyFallbackBaseUrl, request, path, body);
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
