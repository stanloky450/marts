import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function getProxyBaseUrl() {
  const value =
    process.env.API_PROXY_TARGET_URL ||
    process.env.APPWRITE_API_GATEWAY_URL ||
    "http://localhost:5700/api/v1";

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildUpstreamUrl(path: string[], request: NextRequest) {
  const upstream = new URL(`${getProxyBaseUrl()}/${path.join("/")}`);
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

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(path, request);
  const method = request.method.toUpperCase();
  const headers = buildRequestHeaders(request);

  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
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
