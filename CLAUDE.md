# nucleus-admin-ui — conventions

## Forms

Use `react-hook-form` for every form, with `zod` schemas via `@hookform/resolvers/zod`. Do not hand-roll `useState` for form fields, manual validation, or controlled-input wiring. See [src/pages/profile.tsx](src/pages/profile.tsx) for the canonical pattern (schema → `useForm({ resolver: zodResolver(schema) })` → `register`/`handleSubmit` → field-level `errors`).

## Tables

Use `@tanstack/react-table` for every data table, and every table must include pagination. Do not render raw `<table>` markup with manual `.map()` rows. Use `useReactTable` with `getCoreRowModel()` and `getPaginationRowModel()`, define columns via `ColumnDef<T>[]`, and render the page-size and prev/next controls below the table. See [src/pages/admin-users.tsx](src/pages/admin-users.tsx) for the reference implementation.

## Loading states

Every screen that waits on an API request must render shimmer placeholders (the [`Skeleton`](src/components/ui/skeleton.tsx) component) while the request is in flight — never a blank screen, plain "Loading…" text, or a spinner-only state. Match the skeleton layout to the real content (same column widths, same row count target) so the transition is stable. See [src/pages/migrations.tsx](src/pages/migrations.tsx) and [src/pages/admin-users.tsx](src/pages/admin-users.tsx) for the reference patterns (skeleton rows for lists and tables; skeleton fields for forms hydrating from a fetch).

## Native scrollbars & `color-scheme`

Native browser UI (scrollbars, native `<select>` popups, form controls) is painted from the CSS `color-scheme` property. This app is light-only, so it is pinned in [src/index.css](src/index.css) as `color-scheme: light` in `:root`.

- **Never set `color-scheme: light dark`** (or leave it unset) — that follows the OS, giving a **dark native scrollbar** on a dark-OS machine even though the app is light.
- When dark mode is enabled (uncomment the `.dark` block in `src/index.css`), add `color-scheme: dark;` there too. The `:root` pin already covers every native scrollbar / `<select>` on containers that don't opt into `.thin-scrollbar`.
