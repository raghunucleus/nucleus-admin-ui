# nucleus-admin-ui — conventions

## Routing & code splitting

Routing is `@tanstack/react-router`, code-based, all of it in [src/router.tsx](src/router.tsx). The login screen must never download the admin screens, so **every route component is a lazy chunk**:

```ts
const StudentsPage = lazyRouteComponent(() => import("@/pages/students"), "StudentsPage")
```

Pages are named exports, so the export name is always the second argument.

- **Never `import { XPage } from "@/pages/..."` in `router.tsx`.** One static import drags that page, and everything it pulls in, into the entry chunk that the login screen downloads. `import type` is fine — it is erased, which is why the three pages that import their search-param type back from `@/router` create no runtime cycle.
- **Static on purpose, and nothing else:** `AuthLayout`, `LoginPage`, `SetupTwoFactorPage`, `NotFoundPage`. They render before anything lazy is reachable. `AppLayout` is lazy too — it is the signed-in chrome, so it loads with the admin who got past `beforeLoad`, keeping Radix's dropdown/floating-ui and the sidebar's icons out of the login path.
- `createRouter` sets `defaultPendingComponent: RoutePending` and `defaultPreload: "intent"`. The pending component renders inside `AppLayout`'s `<Outlet>`, so the sidebar never unmounts during a chunk wait, and hovering a sidebar link prefetches that page.
- Anything reachable **only** through `import()` must be listed in `optimizeDeps.include` in [vite.config.ts](vite.config.ts) (`xlsx`, `exceljs` today), or the dev server discovers it mid-session and answers the first request with a 504, which the browser reports as "Failed to fetch dynamically imported module".
- Verify with `npm run build`: `dist/index.html` must modulepreload **only** the entry and the Rolldown runtime — no page chunk, no vendor library. Naming a chunk does not make it lazy; only an `import()` boundary does.

## Spreadsheets

- **Reading** uploads: `const XLSX = await loadXlsx()` from [src/lib/xlsx.ts](src/lib/xlsx.ts), inside the handler. Never `import * as XLSX from "xlsx"` at module scope — that is 411 KB in the page's chunk. Where the handler also reads the file, overlap them: `await Promise.all([loadXlsx(), readFileBytes(file)])`.
- **Writing** styled workbooks (column widths, multiple sheets, formulas): `const ExcelJSModule = await import("exceljs")`, likewise inside the handler.
- Don't add a third spreadsheet library.

## Forms

Use `react-hook-form` for every form, with `zod` schemas via `@hookform/resolvers/zod`. Do not hand-roll `useState` for form fields, manual validation, or controlled-input wiring. See [src/pages/profile.tsx](src/pages/profile.tsx) for the canonical pattern (schema → `useForm({ resolver: zodResolver(schema) })` → `register`/`handleSubmit` → field-level `errors`).

## Tables

Use `@tanstack/react-table` for every data table, and every table must include pagination. Do not render raw `<table>` markup with manual `.map()` rows. Use `useReactTable` with `getCoreRowModel()` and `getPaginationRowModel()`, define columns via `ColumnDef<T>[]`, and render the page-size and prev/next controls below the table. See [src/pages/admin-users.tsx](src/pages/admin-users.tsx) for the reference implementation.

## Loading states

Every screen that waits on an API request must render shimmer placeholders (the [`Skeleton`](src/components/ui/skeleton.tsx) component) while the request is in flight — never a blank screen, plain "Loading…" text, or a spinner-only state. Match the skeleton layout to the real content (same column widths, same row count target) so the transition is stable. See [src/pages/migrations.tsx](src/pages/migrations.tsx) and [src/pages/admin-users.tsx](src/pages/admin-users.tsx) for the reference patterns (skeleton rows for lists and tables; skeleton fields for forms hydrating from a fetch).

That rule is about waiting for **data**. Waiting for **code** is the router's job: [`RoutePending`](src/components/route-pending.tsx) is the shared fallback while a page chunk downloads, and it is the one place a bare loader is correct.

## Native scrollbars & `color-scheme`

Native browser UI (scrollbars, native `<select>` popups, form controls) is painted from the CSS `color-scheme` property. This app is light-only, so it is pinned in [src/index.css](src/index.css) as `color-scheme: light` in `:root`.

- **Never set `color-scheme: light dark`** (or leave it unset) — that follows the OS, giving a **dark native scrollbar** on a dark-OS machine even though the app is light.
- When dark mode is enabled (uncomment the `.dark` block in `src/index.css`), add `color-scheme: dark;` there too. The `:root` pin already covers every native scrollbar / `<select>` on containers that don't opt into `.thin-scrollbar`.
