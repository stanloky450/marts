# Appwrite Function Migration

This workspace migrates the existing Express backend in [`/server`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/server) into modular Appwrite Functions without changing the API contract used by the frontend.

## Goals

- Preserve `/api/v1/...` response shapes and legacy `mongoId` fields.
- Replace Express middleware with reusable function-layer auth, validation, and response helpers.
- Keep Prisma/Postgres as the first migration target for backward compatibility.
- Allow selective replacement with Appwrite Databases via repository adapters.

## Function Layout

```text
appwrite/
  functions/
    shared/
      src/
        auth/
        db/
        http/
        repositories/
        services/
    auth-function/
    user-function/
    product-function/
    payment-function/
    storefront-function/
    analytics-function/
```

## Route Mapping

| Express Route | Appwrite Function | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/login` | `auth-function` | Legacy login preserved. |
| `POST /api/v1/auth/refresh` | `auth-function` | Refresh contract preserved. |
| `POST /api/v1/auth/logout` | `auth-function` | Supports Appwrite JWT or legacy bearer token. |
| `GET /api/v1/auth/me` | `auth-function` | Resolves user and vendor profile. |
| `GET /api/v1/products` | `product-function` | Filters, pagination, role-aware visibility. |
| `POST /api/v1/products` | `product-function` | Vendor-only. |
| `GET /api/v1/products/:id` | `product-function` | Preserves approval/ownership checks. |
| `PATCH /api/v1/products/:id` | `product-function` | Vendor/admin-safe update flow. |
| `DELETE /api/v1/products/:id` | `product-function` | Contract unchanged. |
| `PATCH /api/v1/products/:id/approve` | `product-function` | Admin and super admin only. |
| `PATCH /api/v1/products/:id/reject` | `product-function` | Admin and super admin only. |
| `POST /api/v1/products/:id/view` | `product-function` | Public. |
| `GET /api/v1/products/analytics/mine` | `product-function` | Vendor analytics. |
| `GET /api/v1/payments/verify/:reference` | `payment-function` | Public callback-safe verification. |
| `GET /api/v1/payments` | `payment-function` | Authenticated list. |
| `GET /api/v1/storefront/stores` | `storefront-function` | Public. |
| `GET /api/v1/storefront/stores/search` | `storefront-function` | Public. |
| `GET /api/v1/storefront/products/*` | `storefront-function` | Public. |
| `GET /api/v1/users/*` | `user-function` | Super-admin routes. |
| Marketplace analytics | `analytics-function` | Gateway-friendly aggregated endpoints. |

## Authentication Strategy

The migration supports two modes during cutover:

1. Appwrite-first via `x-appwrite-user-jwt`.
2. Legacy compatibility via `Authorization: Bearer <jwt>`.

Set `AUTH_STRATEGY=hybrid` during migration, then move to `AUTH_STRATEGY=appwrite` once the frontend no longer depends on legacy tokens.

## Database Strategy

Default implementation in this workspace keeps the external Postgres/Prisma data path because that is the current source of truth in [`server/src/lib/prisma.js`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/server/src/lib/prisma.js).

To move feature-by-feature into Appwrite Databases:

- Keep service interfaces stable.
- Replace repository implementations behind `DATA_PROVIDER`.
- Preserve API response mappers so frontend payloads stay unchanged.

An Appwrite Databases repository example is included for products.

## DataTables Support

Use the shared request helpers when the frontend sends `draw`, `start`, and `length`.

Response shape stays:

```json
{
  "draw": 1,
  "recordsTotal": 100,
  "recordsFiltered": 50,
  "data": []
}
```

## Environment Variables

```bash
APPWRITE_ENDPOINT=
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DATABASE_ID=
APPWRITE_USERS_COLLECTION_ID=
APPWRITE_PRODUCTS_COLLECTION_ID=
APPWRITE_VENDORS_COLLECTION_ID=
APPWRITE_PAYMENTS_COLLECTION_ID=
APPWRITE_CATEGORIES_COLLECTION_ID=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
AUTH_STRATEGY=hybrid
DATA_PROVIDER=prisma
```

## Deployment

1. Copy [`appwrite/.env.example`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite/.env.example) into your Appwrite Function variables.
2. Copy [`appwrite/appwrite.config.json.example`](/C:/Users/Stanloky/Desktop/learning/commm/new_com3/appwrite/appwrite.config.json.example) to `appwrite.config.json`.
3. Replace the placeholder project ID, endpoint, and function IDs with your real Appwrite values.
4. From the `appwrite/` folder, run `appwrite init project` if the CLI has not been initialized yet.
5. Run `appwrite push functions` to push the local function folders defined in `appwrite.config.json`.
6. Expose the deployed functions behind Appwrite Sites or your own reverse proxy so they are reachable under `/api/v1/...`.

## Frontend Cutover

The frontend now defaults to a local proxy route instead of calling the backend host directly.

1. Set `NEXT_PUBLIC_API_URL=/api/v1`.
2. During migration, keep `API_PROXY_TARGET_URL=http://localhost:5700/api/v1`.
3. When your Appwrite gateway is ready, change `API_PROXY_TARGET_URL` or `APPWRITE_API_GATEWAY_URL` to the Appwrite-backed `/api/v1` base URL.
4. No frontend code changes are required after that switch.

## API Gateway Pattern

- `POST /api/v1/auth/*` -> `auth-function`
- `GET|POST|PATCH|DELETE /api/v1/products/*` -> `product-function`
- `GET /api/v1/storefront/*` -> `storefront-function`
- `GET /api/v1/payments/*` -> `payment-function`

## Logging, Monitoring, Rate Limiting

- Emit one JSON log line per request with `requestId`, `path`, `method`, `statusCode`, `durationMs`, `userId`.
- Track function error rate, cold start duration, DB latency, and Paystack verification latency.
- Apply rate limiting first at the edge gateway/CDN, then per-user on auth/payment endpoints if needed.

## Scaling Notes

- Keep top-level imports small to reduce cold starts.
- Reuse Prisma/Appwrite clients across invocations.
- Split long-running jobs like webhooks and analytics recomputations into async worker functions.
