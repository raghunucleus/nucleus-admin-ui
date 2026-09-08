import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A production build with no `VITE_API_URL` is a silent, SELF-MASKING failure —
 * the worst kind — so it's a build failure instead.
 *
 * `src/lib/api.ts` falls back to the relative `/api`, which on a static host
 * points at the CDN itself. Because SPA routing requires a catch-all rewrite to
 * /index.html, `GET /api/health/live` then returns **HTTP 200 with HTML** — and
 * `pingServer` only checks `res.ok`. So the ConnectivityMonitor concludes the
 * server is healthy while every real call throws JSON parse errors on HTML. The
 * offline screen that exists to explain an outage is disabled by the very
 * misconfiguration it should be catching.
 *
 * The `/api` fallback is a dev-only convenience for the `server.proxy` below,
 * which does not exist in a built bundle.
 */
function assertApiUrl(env: Record<string, string>): void {
  if (env.VITE_API_URL?.trim()) return
  throw new Error(
    [
      'VITE_API_URL is not set for a production build.',
      '',
      'Without it src/lib/api.ts falls back to the relative /api, which only works behind',
      'the Vite dev-server proxy. On a static host that path hits the SPA rewrite and',
      'returns 200 + HTML, so the connectivity monitor reports the server as healthy while',
      'every API call fails — you get confusing per-page errors instead of the offline screen.',
      '',
      'Set it in .env.production (see .env.production.example) or in the build environment:',
      '  VITE_API_URL=https://api-nucleus.raghuenggcollege.com',
      '',
      'If the API genuinely is same-origin behind a proxy that strips the /api prefix',
      '(mirroring the dev proxy rewrite), say so explicitly:',
      '  VITE_API_URL=/api',
    ].join('\n'),
  )
}

/**
 * CSP source list for the inline `<script>` blocks in index.html.
 *
 * index.html carries an inline anti-flash theme script. Under a strict
 * `script-src 'self'` the browser refuses to run it and every load flashes the
 * wrong theme. Hashing is the right fix; `'unsafe-inline'` would void the
 * strongest line in the whole policy.
 *
 * Hashed from the EMITTED html, so what we allow is exactly what ships.
 */
function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  // Inline blocks only — anything with a src= attribute is covered by 'self'.
  const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const body = match[1]
    if (!body.trim()) continue
    hashes.push(
      `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
    )
  }
  return hashes
}

/**
 * Emits the static host's config next to the build: the CSP + companion headers
 * from SECURITY-HEADERS.md, and the SPA rewrite.
 *
 * Generated rather than committed to `public/`, because `public/` is copied
 * byte-for-byte with no substitution — a checked-in policy would still say
 * `API_ORIGIN`, which CSP happily parses as a hostname that matches nothing,
 * blocking every API call. Worse than no CSP.
 *
 * Runs in `writeBundle` and writes with fs: index.html is produced by Vite's own
 * html plugin and is not reliably in the bundle object during a third-party
 * plugin's `generateBundle`, which would silently drop the script hash.
 */
function emitHostConfig(env: Record<string, string>): Plugin {
  return {
    name: 'nucleus-admin-host-config',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist')
      const api = env.VITE_API_URL?.trim() ?? ''
      let apiOrigin = ''
      try {
        apiOrigin = new URL(api).origin
      } catch {
        /* relative base (/api) — same origin, 'self' covers it */
      }
      // Presigned S3 URLs: the admin app renders student photos and company logos.
      const storage = env.VITE_STORAGE_ORIGIN?.trim() ?? ''
      // Google Identity Services: a script, an iframe, and its own XHRs.
      const google = 'https://accounts.google.com'

      const html = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      const hashes = inlineScriptHashes(html)
      if (hashes.length === 0) {
        this.error(
          'No inline <script> found in the emitted index.html. The CSP script-src hash ' +
            'could not be computed, and shipping without it would block the anti-flash ' +
            'theme script. Check emitHostConfig in vite.config.ts.',
        )
      }
      const scriptHashes = hashes.join(' ')

      const sources = (...parts: string[]) => parts.filter(Boolean).join(' ')

      // No wss: here — unlike nucleus-ui, the admin app has no Socket.IO client.
      const csp = [
        `default-src 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `form-action 'self'`,
        `script-src ${sources("'self'", scriptHashes, google)}`,
        // Radix and @tanstack/react-table set inline style="" for measured
        // sizes, and static hosting has no nonce mechanism.
        `style-src 'self' 'unsafe-inline'`,
        `img-src ${sources("'self'", 'data:', 'blob:', storage)}`,
        `font-src 'self' data:`,
        `connect-src ${sources("'self'", apiOrigin, storage, google)}`,
        `frame-src ${google}`,
        `worker-src 'self' blob:`,
        `upgrade-insecure-requests`,
      ].join('; ')

      const headers = [
        '/*',
        `  Content-Security-Policy: ${csp}`,
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: no-referrer',
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
        '',
      ].join('\n')

      const base = env.BASE_PATH || '/'
      writeFileSync(path.join(outDir, '_headers'), headers, 'utf8')
      writeFileSync(
        path.join(outDir, '_redirects'),
        `/*  ${base}index.html  200\n`,
        'utf8',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: BASE_PATH and VITE_STORAGE_ORIGIN are build inputs, not client
  // values, so they can live in .env.production alongside VITE_API_URL. Only
  // VITE_-prefixed keys are ever exposed to the bundle (envPrefix is untouched),
  // and this object must never be spread into `define`.
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production') assertApiUrl(env)

  return {
    base: env.BASE_PATH || '/',
    plugins: [react(), tailwindcss(), emitHostConfig(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Both are used only by the bulk-upload and enrollment screens, which
          // already import them dynamically — keep them out of the entry chunk.
          manualChunks: (id: string) => {
            if (id.includes('node_modules/exceljs')) return 'exceljs'
            if (id.includes('node_modules/xlsx')) return 'xlsx'
            return undefined
          },
        },
      },
    },
    server: {
      port: 5001,
      proxy: {
        // Dev only. Unset VITE_API_URL to route /api through this proxy to the
        // backend; `vite build` has no proxy, which is why assertApiUrl exists.
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
