# Appwrite Deployment Steps

1. **Gather secrets and configuration** – copy `appwrite/.env.example` into your Appwrite project variables (Appwrite Console > Functions > Environment Variables). Populate `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, database/collection IDs, `DATABASE_URL`, JWT secrets, Paystack secrets, and keep `AUTH_STRATEGY=hybrid` while the frontend still uses legacy tokens and `DATA_PROVIDER=prisma` until the migration is further along.

2. **Prepare `appwrite.config.json`** – duplicate `appwrite/appwrite.config.json.example` to `appwrite.config.json`, replace the placeholder `projectId`, `endpoint`, and `$id` values with your Appwrite project and function IDs, and make sure each function path matches the folders under `appwrite/functions/`.

3. **Initialize the CLI** – from inside the `appwrite/` folder run `appwrite init project` to authenticate and bind the local workspace to your Appwrite deployment. Confirm the CLI reports the same project ID you just inserted into `appwrite.config.json`.

4. **Push the functions** – while still inside `appwrite/`, run `appwrite push functions`. The CLI will install dependencies in each function folder and upload the entrypoint (`src/main.js`) for `auth-function`, `user-function`, `product-function`, `payment-function`, `storefront-function`, and `analytics-function`. Verify no runtime errors occur during the push.

5. **Expose the gateway** – ensure Appwrite sites or your reverse proxy exposes the deployed functions under `/api/v1`. If you use Appwrite Sites, point the site to the same project and configure rewrites so `/api/v1/*` is forwarded to the functions gateway URL.

6. **Update the frontend proxy** – when the Appwrite deployment is ready, set `API_PROXY_TARGET_URL` or `APPWRITE_API_GATEWAY_URL` to the Appwrite gateway base (e.g., `https://your-appwrite-instance/api/v1`). Keep `NEXT_PUBLIC_API_URL=/api/v1` so the frontend continues to call the local proxy route `app/api/v1/[...path]/route.ts`, which forwards requests to Appwrite.

7. **Verify auth strategy** – during cutover keep `AUTH_STRATEGY=hybrid` so the functions accept either `x-appwrite-user-jwt` or the legacy bearer token from `apiClient`. Once every client request uses Appwrite JWTs and the legacy backend is retired, switch to `AUTH_STRATEGY=appwrite`.

8. **Smoke-test critical routes** – hit `/api/v1/auth/*`, `/api/v1/products/*`, `/api/v1/storefront/*`, `/api/v1/payments/*`, `/api/v1/users/*`, and `/api/v1/analytics/overview` to ensure responses match the legacy contract (refer to `appwrite/README.md` for the route mapping). Log and monitor each function for cold starts, latency, and errors as recommended.

9. **Roll forward frontend cutover** – after Appwrite proves reliable, update the frontend environment files (`.env.local` and production) so the proxy targets the Appwrite gateway permanently and remove references to `http://localhost:5700`. Optionally retire or archive the legacy Express backend once no clients still hit it.
