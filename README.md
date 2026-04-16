# Multi-Vendor Marketplace

This repository contains a Next.js frontend in [`app/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/app), a legacy Express backend in [`server/src/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/server/src), and an Appwrite function migration workspace in [`appwrite/`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite).

## API Routing

The frontend now uses a local proxy route for API calls:

- Browser requests go to `/api/v1/...`
- Next.js proxies those requests to `API_PROXY_TARGET_URL` or `APPWRITE_API_GATEWAY_URL`
- The default local target remains the legacy backend at `http://localhost:5700/api/v1`

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
