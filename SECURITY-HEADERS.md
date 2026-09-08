# Security headers — nucleus-admin-ui

`vite build` generates `dist/_headers` with the real origins substituted from
`VITE_API_URL` and `VITE_STORAGE_ORIGIN`, plus a SHA-256 hash of the inline
script in `index.html`. This document explains what is in that file and why, so
the values can be transcribed into a host that does not read `_headers`
(CloudFront, nginx).

**Do not check a policy into `public/`.** That directory is copied byte-for-byte
with no substitution, so a committed policy would ship the literal string
`API_ORIGIN` — which CSP parses happily as a hostname matching nothing, blocking
every API call. Worse than shipping no CSP at all.

## The policy

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'sha256-<INLINE_SCRIPT_HASH>' https://accounts.google.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: S3_ORIGIN;
font-src 'self' data:;
connect-src 'self' API_ORIGIN S3_ORIGIN https://accounts.google.com;
frame-src https://accounts.google.com;
worker-src 'self' blob:;
upgrade-insecure-requests
```

| Placeholder | Value | Source |
| --- | --- | --- |
| `API_ORIGIN` | `https://api-nucleus.raghuenggcollege.com` | `VITE_API_URL` |
| `S3_ORIGIN` | `https://raghu-nucleus.s3.ap-south-1.amazonaws.com` | `VITE_STORAGE_ORIGIN` |
| `<INLINE_SCRIPT_HASH>` | computed at build time | the inline script in `index.html` |

**There is deliberately no `wss:` here.** Unlike nucleus-ui, the admin app has no
Socket.IO client — `socket.io-client` is not even a dependency. Adding a
WebSocket source would widen the policy for nothing.

### Why each non-obvious source is there

- **`S3_ORIGIN` in `img-src`.** The admin app renders student photos and company
  logos from presigned S3 URLs. Omit it and every photo in the directory is
  blocked.
- **`accounts.google.com` in three directives.** `@react-oauth/google` loads
  Google Identity Services as a script, renders it in an iframe, and lets it make
  its own requests — so `script-src`, `frame-src` and `connect-src` all need it.
  Without them the "Continue with Google" button silently does nothing.
- **The inline script hash.** `index.html` runs a small anti-flash script before
  first paint. Under a strict `script-src 'self'` the browser refuses to run it
  and every load flashes the wrong theme. The hash is computed from the
  **emitted** `index.html`, so it always matches what ships; the build fails if
  no inline script is found rather than shipping a policy that would block it.
- **`style-src 'unsafe-inline'`.** Radix and `@tanstack/react-table` set inline
  `style=""` for measured sizes, and static hosting has no nonce mechanism. It is
  the weakest line in the policy, and it is why `script-src` being strict matters.
- **`frame-ancestors 'none'`** makes `X-Frame-Options` redundant.

## Companion headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

## Applying it

**CloudFront (this deployment)** — `_headers` is inert on S3. Create a **Response
Headers Policy** with the custom headers above, copying the values out of the
generated `dist/_headers` after a build. Re-copy whenever `VITE_API_URL`,
`VITE_STORAGE_ORIGIN` or the inline script changes — a stale hash blocks the
theme script.

**Netlify / Cloudflare Pages** — `_headers` and `_redirects` are picked up as-is.

## Rolling it out

Ship `Content-Security-Policy-Report-Only` for one release first. Exercise: login
(including Google), the students and employees tables, a bulk upload (which
dynamically imports `exceljs`), and a screen showing student photos. Then switch
the header name to enforce.
