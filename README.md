# Multi-Vendor Marketplace

This repository contains a Next.js frontend in [`app/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/app), a legacy Express backend in [`server/src/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/server/src), and an Appwrite function migration workspace in [`appwrite/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite).

## API Routing

The frontend now uses a local proxy route for API calls:

- Browser requests go to `/api/v1/...`
- Next.js first tries `API_PROXY_TARGET_URL` or `APPWRITE_API_GATEWAY_URL` when those are configured
- If that target is unavailable and Appwrite server variables are present, Next.js falls back to direct Appwrite function execution
- If neither Appwrite path is configured, the final local fallback remains `LEGACY_API_BASE_URL` or `http://localhost:5700/api`

Recommended deployment options:

- Option 1: Set `APPWRITE_API_GATEWAY_URL` to a real HTTP gateway that fronts `gateway-function`
- Option 2: Set `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, and optionally `APPWRITE_FUNCTION_ID=gateway-function`
- Option 2 is useful when the app is deployed before a public Appwrite gateway URL is ready
- For local development against the legacy Express backend, set `API_PROXY_TARGET_URL=http://localhost:5700/api`

Files involved:

- [`lib/api-client.ts`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/lib/api-client.ts)
- [`app/api/v1/[...path]/route.ts`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/app/api/v1/[...path]/route.ts)
- [`.env.example`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/.env.example)

## Appwrite Migration

The Appwrite function workspace includes modular functions for auth, users, products, payments, storefront, and analytics.

See:

- [`appwrite/README.md`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite/README.md)
- [`appwrite/appwrite.config.json.example`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite/appwrite.config.json.example)
- [`appwrite/.env.example`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite/.env.example)
