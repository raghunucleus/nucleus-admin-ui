# Deploying nucleus-admin-ui

The app is a **static bundle**. `npm run build` produces `dist/`; whatever serves
those files is the "host". It is a **single-audience app on a single hostname** —
`nucleusadmin.raghuenggcollege.in` — and a **separate artifact** from
nucleus-ui. There is no hostname sniffing here.

Admin sessions are deliberately per-tab: the auth store persists to
`sessionStorage` (`nucleus-auth-v2`), not `localStorage`, and there is a
15-minute client-side idle timeout in `src/config/session.ts`. That session model
is incompatible with the portals' per-origin persistence, which is one more
reason the two apps never share an origin.

## Build

```bash
cp .env.production.example .env.production   # then edit it
npm run build                                # tsc -b && vite build && postbuild
```

`vite build` runs in `production` mode, so it reads `.env.production`
automatically. Shell values win over the file, which is what CI should use:

```bash
VITE_API_URL=https://api-nucleus.raghuenggcollege.in npm run build
```

### Environment

| Key | Required | What it does |
| --- | --- | --- |
| `VITE_API_URL` | **yes** | API origin, no trailing slash. Baked into the bundle. |
| `VITE_GOOGLE_OIDC_CLIENT_ID` | no | Google sign-in. Must equal `GOOGLE_ADMIN_OIDC_CLIENT_ID` on the server. Unset hides the button. |
| `VITE_STORAGE_ORIGIN` | no | S3 origin serving presigned URLs. Only widens the generated CSP — unset, student photos are blocked. |
| `BASE_PATH` | no (`/`) | Sub-path the app is served from, with both slashes. |

### `VITE_API_URL` is mandatory, and the failure it prevents is nasty

`src/lib/api.ts` falls back to the relative `/api`, which only works behind the
Vite dev-server proxy (`vite.config.ts` rewrites `/api/*` → the backend with the
prefix stripped). A built bundle has no proxy.

On a static host that fallback points at the CDN itself, and it is **self-masking**:

- SPA routing requires a catch-all rewrite to `/index.html`, so
  `GET /api/health/live` returns **HTTP 200 with HTML**.
- `pingServer` only checks `res.ok`, so the ConnectivityMonitor concludes the
  server is **healthy**.
- Meanwhile every real call does `res.json()` on HTML and throws.

The result is confusing per-page errors and no offline screen — the feature meant
to explain an outage is disabled by the misconfiguration it should be catching.
Hence the build guard: `vite build` fails outright if `VITE_API_URL` is unset.

If the API genuinely is same-origin behind a proxy that strips `/api` (mirroring
the dev rewrite), say so explicitly with `VITE_API_URL=/api`.

### What the build emits

| File | Written by | Read by |
| --- | --- | --- |
| `_headers` | `emitHostConfig` in `vite.config.ts` | Netlify, Cloudflare Pages — and it is the source of truth to transcribe into a CloudFront Response Headers Policy |
| `_redirects` (`/*  /index.html  200`) | same | Netlify, Cloudflare Pages |
| `404.html` | `postbuild` in `package.json` | S3 website hosting |

See [SECURITY-HEADERS.md](SECURITY-HEADERS.md).

## SPA fallback — required, not optional

Client-routed with browser history (TanStack Router), so **every** path must serve
`index.html`. `/students`, `/employees` and every other route 404 on a cold load
or refresh without a catch-all rewrite.

**S3 + CloudFront (this deployment)** — set custom error responses mapping **403
and 404** → `/index.html` with HTTP 200. S3's REST endpoint returns **403**, not
404, for a missing key when the bucket is private behind Origin Access Control,
so a 404-only rule silently misses.

If you ever put a real `/api` proxy in front, its rule must be ordered **before**
the catch-all rewrite, and it must strip the `/api` prefix.

## Deploying to S3 + CloudFront

```bash
VITE_API_URL=https://api-nucleus.raghuenggcollege.in \
VITE_STORAGE_ORIGIN=https://raghu-nucleus.s3.ap-south-1.amazonaws.com \
VITE_GOOGLE_OIDC_CLIENT_ID=<client-id> \
  npm run build

aws s3 sync dist/ s3://<admin-ui-bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**Cache policy.** `/assets/*` is content-hashed and immutable (1 year), but
**`index.html` must be `no-cache`**. Otherwise a user holds a stale shell
referencing hashed chunks the last deploy deleted — and because `exceljs` and
`xlsx` load as lazy chunks on click, that failure surfaces later, on the bulk
upload screen, rather than at load time.

## Pairing with nucleus-server

| Server var | Value |
| --- | --- |
| `CORS_ORIGINS` | Must include `https://nucleusadmin.raghuenggcollege.in`. **This is easy to miss**: the server's default allowlist contains only the port-5000 portal origins, and admin has never needed CORS because dev uses the same-origin proxy. The moment admin is deployed statically, every request fails without this. |
| `GOOGLE_ADMIN_OIDC_CLIENT_ID` | Must equal this app's `VITE_GOOGLE_OIDC_CLIENT_ID`. |

Add the admin origin to the **Google Cloud Console** OAuth client's authorized
JavaScript origins too, or Google sign-in fails.

## Verifying a deployment

1. Hard-reload a deep link (`/students`) — proves the SPA fallback.
2. Sign in; confirm the Google button appears and works.
3. Open DevTools console — there must be no CSP violations.
4. Confirm a student photo renders (S3 CORS + `img-src`).
5. Confirm the page does **not** flash the wrong theme (inline script hash).
6. Open a bulk-upload screen to force the lazy `exceljs` chunk to load.
7. Stop the API; confirm the server-unreachable screen appears within ~5s — if it
   claims the server is fine while pages error, `VITE_API_URL` was not baked in.
