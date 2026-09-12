import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  LayoutGrid,
  Monitor,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  SquareStack,
  Users,
  X,
  Zap,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  activateRole,
  deactivateRole,
  getCatalog,
  listRoles,
  type Catalog,
  type ModuleDef,
  type RoleDetail,
  type RoleSortField,
  type RoleTypeDef,
  type ScreenDef,
} from "@/lib/rbac"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

// Sticky column shims. Each pair uses a card-coloured background so scrolling
// content doesn't bleed through, and a border on the inner edge so the user
// sees the seam where the table starts scrolling under the pinned column.
const STICKY_LEFT_HEAD = "sticky left-0 z-20 bg-card border-r"
const STICKY_LEFT_CELL = "sticky left-0 z-10 bg-card border-r"
const STICKY_RIGHT_HEAD = "sticky right-0 z-20 bg-card border-l"
const STICKY_RIGHT_CELL = "sticky right-0 z-10 bg-card border-l"

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return dateTimeFormatter.format(d)
}

/** Same palette as the role builder — keeps role-type identity consistent. */
const ROLE_TYPE_TONES = [
  "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300",
  "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  "bg-teal-500/10 text-teal-700 border-teal-500/30 dark:text-teal-300",
  "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300",
  "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/30 dark:text-fuchsia-300",
  "bg-cyan-500/10 text-cyan-700 border-cyan-500/30 dark:text-cyan-300",
]

function roleTypeTone(index: number): string {
  return ROLE_TYPE_TONES[index % ROLE_TYPE_TONES.length]
}

export function RolesListPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = React.useState<RoleDetail[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [confirmTarget, setConfirmTarget] = React.useState<RoleDetail | null>(
    null,
  )
  const [viewingRole, setViewingRole] = React.useState<RoleDetail | null>(null)

  // Search + filters + sort + paging — all server-driven so the table works
  // identically once the dataset outgrows what's reasonable to ship to the
  // browser in one shot.
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all")
  const [sortBy, setSortBy] = React.useState<RoleSortField>("name")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE)

  // Catalog only changes when role types are introduced — fetch once.
  React.useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cat = await getCatalog()
        if (alive) setCatalog(cat)
      } catch {
        // Catalog failure surfaces via the role-load toast below; the page
        // can still render usable rows without role-type labels.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Debounce the search box so we don't refetch on every keystroke. Reset to
  // page 1 inside the same tick the debounced value lands so the page change
  // and the search change collapse into a single refetch (no double request).
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery((prev) => {
        const next = query.trim()
        if (next !== prev) setPage(1)
        return next
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [query])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listRoles({
        page,
        pageSize,
        name: debouncedQuery || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        sortBy,
        sortOrder,
      })
      setRoles(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
    } catch (err) {
      setLoadFailed(true)
      toast.error("Couldn't load roles", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedQuery, statusFilter, sortBy, sortOrder])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleToggleActive = async (role: RoleDetail) => {
    setBusyId(role.id)
    try {
      const updated = role.is_active
        ? await deactivateRole(role.id)
        : await activateRole(role.id)
      toast.success(
        `${updated.name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update role status", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Toggle the sort for a given column. Clicking a non-active column starts at
   * ascending; clicking the active column flips the order. Always resets to
   * page 1 since the previous offset is meaningless under a new ordering.
   */
  const requestSort = (field: RoleSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setPage(1)
  }

  const handleStatusFilterChange = (next: "all" | "active" | "inactive") => {
    setStatusFilter(next)
    setPage(1)
  }

  const handlePageSizeChange = (next: number) => {
    setPageSize(next)
    setPage(1)
  }

  // Catalog lookups — keyed for O(1) reads from the row renderers.
  const roleTypeByKey = React.useMemo(() => {
    const map = new Map<string, RoleTypeDef>()
    if (catalog) for (const rt of catalog.role_types) map.set(rt.key, rt)
    return map
  }, [catalog])

  const roleTypeToneByKey = React.useMemo(() => {
    const map = new Map<string, string>()
    if (catalog) {
      catalog.role_types.forEach((rt, i) => {
        map.set(rt.key, roleTypeTone(i))
      })
    }
    return map
  }, [catalog])

  const screenByKey = React.useMemo(() => {
    const map = new Map<string, ScreenDef>()
    if (catalog) for (const s of catalog.screens) map.set(s.key, s)
    return map
  }, [catalog])

  const moduleByKey = React.useMemo(() => {
    const map = new Map<string, ModuleDef>()
    if (catalog) for (const m of catalog.modules) map.set(m.key, m)
    return map
  }, [catalog])

  const hasActiveFilters =
    debouncedQuery.length > 0 || statusFilter !== "all"
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total)

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader
        title="Roles"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw />
            </Button>
            <Link to="/role-management/roles/$roleId" params={{ roleId: "new" }}>
              <Button size="sm">
                <Plus />
                New role
              </Button>
            </Link>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles by code, name, description, or role type…"
            className="pl-8"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusFilterChange(s)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={STICKY_LEFT_HEAD}>
                <SortHeader
                  field="name"
                  label="Name"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={requestSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  field="code"
                  label="Code"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={requestSort}
                />
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Role types</TableHead>
              <TableHead className="text-right">Screens</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>
                <SortHeader
                  field="is_active"
                  label="Status"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={requestSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  field="updated_at"
                  label="Updated"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={requestSort}
                />
              </TableHead>
              <TableHead className={cn(STICKY_RIGHT_HEAD, "text-right")}>
                Manage
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`s-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : roles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="p-0">
                  {loadFailed ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="Couldn't load roles"
                      description="There was a problem reaching the server."
                      action={
                        <Button size="sm" onClick={() => void load()}>
                          <RefreshCw />
                          Try again
                        </Button>
                      }
                    />
                  ) : hasActiveFilters ? (
                    <EmptyState
                      icon={Search}
                      title="No matches"
                      description="No roles match the current filters."
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQuery("")
                            handleStatusFilterChange("all")
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={ShieldCheck}
                      title="No roles yet"
                      description="Create the first role to start assigning permissions."
                      action={
                        <Link
                          to="/role-management/roles/$roleId"
                          params={{ roleId: "new" }}
                        >
                          <Button size="sm">
                            <Plus />
                            New role
                          </Button>
                        </Link>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const isBusy = busyId === role.id
                const totalActions = role.screens.reduce(
                  (sum, s) => sum + s.allowed_actions.length,
                  0,
                )
                return (
                  <TableRow key={role.id}>
                    <TableCell
                      className={cn(STICKY_LEFT_CELL, "max-w-[220px]")}
                    >
                      <button
                        type="button"
                        title={role.name}
                        className="block w-full truncate text-left font-medium text-foreground underline-offset-4 hover:underline"
                        onClick={() =>
                          navigate({
                            to: "/role-management/roles/$roleId",
                            params: { roleId: String(role.id) },
                          })
                        }
                      >
                        {role.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border border-input bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-foreground">
                        {role.code}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      {role.description ? (
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          title={role.description}
                        >
                          {role.description}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RoleTypeChipList
                        keys={role.role_type_keys}
                        roleTypeByKey={roleTypeByKey}
                        roleTypeToneByKey={roleTypeToneByKey}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {role.screens.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {totalActions}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            role.is_active
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-1.5 rounded-full",
                              role.is_active ? "bg-success" : "bg-destructive",
                            )}
                          />
                          {role.is_active ? "Active" : "Inactive"}
                        </span>
                        {role.active_assignment_count > 0 && (
                          <Link
                            to="/role-management/assignments"
                            search={{
                              role_id: role.id,
                              employee_id: undefined,
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                            title={`${role.active_assignment_count} active assignment${role.active_assignment_count === 1 ? "" : "s"} use this role`}
                          >
                            <Users className="size-3" />
                            <span className="tabular-nums">
                              {role.active_assignment_count}
                            </span>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(role.updated_at)}
                      </span>
                    </TableCell>
                    <TableCell className={STICKY_RIGHT_CELL}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setViewingRole(role)}
                          disabled={isBusy}
                          title="View role"
                          aria-label="View role"
                        >
                          <Eye />
                        </Button>
                        <Link
                          to="/role-management/roles/$roleId"
                          params={{ roleId: String(role.id) }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            disabled={isBusy}
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Pencil />
                          </Button>
                        </Link>
                        {(() => {
                          // Can't deactivate a role with live assignments —
                          // server refuses, so disable the button up front
                          // and explain why via the tooltip.
                          const blockedByAssignments =
                            role.is_active && role.active_assignment_count > 0
                          const toggleTitle = role.is_active
                            ? blockedByAssignments
                              ? `Can't deactivate — ${role.active_assignment_count} active assignment${role.active_assignment_count === 1 ? "" : "s"} use this role. Revoke them first.`
                              : "Deactivate"
                            : "Activate"
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "size-8",
                                role.is_active
                                  ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  : "text-muted-foreground hover:bg-success/10 hover:text-success",
                              )}
                              onClick={() => setConfirmTarget(role)}
                              disabled={isBusy || blockedByAssignments}
                              title={toggleTitle}
                              aria-label={
                                role.is_active ? "Deactivate" : "Activate"
                              }
                            >
                              {role.is_active ? <PowerOff /> : <Power />}
                            </Button>
                          )
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination footer — only meaningful once we have rows. */}
        {roles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/20 px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="roles-rows-per-page"
                  className="text-muted-foreground"
                >
                  Rows per page:
                </label>
                <select
                  id="roles-rows-per-page"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 pr-7 text-xs font-medium shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-muted-foreground">
                Results:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {firstRow} – {lastRow}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {total}
                </span>
              </div>
            </div>

            <Pagination
              page={page}
              pageCount={pageCount}
              onFirst={() => setPage(1)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
              onLast={() => setPage(Math.max(1, pageCount))}
              onPage={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={
          confirmTarget?.is_active ? "Deactivate role?" : "Activate role?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivating revokes effective access for every employee assigned to this role."
                : "Reactivating restores access for every active assignment of this role."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.name}
              </div>
            </>
          ) : undefined
        }
        confirmLabel={confirmTarget?.is_active ? "Deactivate" : "Activate"}
        tone={confirmTarget?.is_active ? "destructive" : "success"}
        loading={busyId === confirmTarget?.id}
        onConfirm={async () => {
          if (!confirmTarget) return
          const target = confirmTarget
          await handleToggleActive(target)
          setConfirmTarget(null)
        }}
      />

      <Sheet
        open={!!viewingRole}
        onOpenChange={(open) => {
          if (!open) setViewingRole(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          {viewingRole && (
            <>
              <SheetHeader className="gap-2">
                <SheetTitle className="truncate pr-8">
                  {viewingRole.name}
                </SheetTitle>
                <SheetDescription>
                  Full composition of this role.
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="inline-flex items-center rounded-md border border-input bg-muted/40 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-foreground">
                    {viewingRole.code}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                      viewingRole.is_active
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        viewingRole.is_active
                          ? "bg-success"
                          : "bg-destructive",
                      )}
                    />
                    {viewingRole.is_active ? "Active" : "Inactive"}
                  </span>
                  {viewingRole.active_assignment_count > 0 && (
                    <Link
                      to="/role-management/assignments"
                      search={{
                        role_id: viewingRole.id,
                        employee_id: undefined,
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Users className="size-3" />
                      <span className="tabular-nums">
                        {viewingRole.active_assignment_count}
                      </span>{" "}
                      assigned
                    </Link>
                  )}
                </div>
              </SheetHeader>
              <SheetBody>
                <RoleDetailPanel
                  role={viewingRole}
                  screenByKey={screenByKey}
                  moduleByKey={moduleByKey}
                  roleTypeByKey={roleTypeByKey}
                  roleTypeToneByKey={roleTypeToneByKey}
                  catalogModules={catalog?.modules ?? []}
                />
              </SheetBody>
              <SheetFooter>
                <Link
                  to="/role-management/roles/$roleId"
                  params={{ roleId: String(viewingRole.id) }}
                >
                  <Button size="sm" variant="outline">
                    <Pencil />
                    Edit role
                  </Button>
                </Link>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/**
 * Body content rendered inside the View sheet for a role. Lays out a stats
 * grid, the contributing role types, and every granted screen grouped by
 * module so admins can audit a role without opening the editor.
 *
 * Spacing: parent ({@link SheetBody}) supplies the outer padding — this
 * component only owns vertical rhythm between its own sections.
 */
function RoleDetailPanel({
  role,
  screenByKey,
  moduleByKey: _moduleByKey,
  roleTypeByKey,
  roleTypeToneByKey,
  catalogModules,
}: {
  role: RoleDetail
  screenByKey: Map<string, ScreenDef>
  moduleByKey: Map<string, ModuleDef>
  roleTypeByKey: Map<string, RoleTypeDef>
  roleTypeToneByKey: Map<string, string>
  catalogModules: ModuleDef[]
}) {
  const roleTypeSet = React.useMemo(
    () => new Set(role.role_type_keys),
    [role.role_type_keys],
  )

  const screensByModule = React.useMemo(() => {
    const map = new Map<
      string,
      { def: ScreenDef; allowed_actions: string[] }[]
    >()
    for (const rs of role.screens) {
      const def = screenByKey.get(rs.screen_key)
      if (!def) continue
      const list = map.get(def.module_key) ?? []
      list.push({ def, allowed_actions: rs.allowed_actions })
      map.set(def.module_key, list)
    }
    return map
  }, [role.screens, screenByKey])

  const screensPerRoleType = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const rs of role.screens) {
      const def = screenByKey.get(rs.screen_key)
      if (!def) continue
      for (const k of def.role_type_keys) {
        if (roleTypeSet.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    return counts
  }, [role.screens, screenByKey, roleTypeSet])

  const orderedModules = catalogModules
    .filter((m) => screensByModule.has(m.key))
    .sort((a, b) => a.order - b.order)

  const totalActions = role.screens.reduce(
    (sum, s) => sum + s.allowed_actions.length,
    0,
  )

  const descriptionBlock = role.description ? (
    <Section label="Description">
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {role.description}
      </p>
    </Section>
  ) : null

  const statsBlock = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat icon={LayoutGrid} label="Screens" value={role.screens.length} />
      <Stat icon={Zap} label="Actions" value={totalActions} />
      <Stat
        icon={SquareStack}
        label="Role types"
        value={role.role_type_keys.length}
      />
      <Stat
        icon={Calendar}
        label="Updated"
        value={formatDateOnly(role.updated_at)}
      />
    </div>
  )

  if (role.screens.length === 0) {
    return (
      <div className="space-y-5">
        {descriptionBlock}
        {statsBlock}
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          This role grants no screens yet.{" "}
          <Link
            to="/role-management/roles/$roleId"
            params={{ roleId: String(role.id) }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Open the editor to add some.
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {descriptionBlock}
      {statsBlock}

      <Section label="Role types">
        <div className="flex flex-wrap gap-1.5">
          {role.role_type_keys.map((k) => {
            const rt = roleTypeByKey.get(k)
            const tone = roleTypeToneByKey.get(k) ?? ""
            const count = screensPerRoleType.get(k) ?? 0
            return (
              <span
                key={k}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                  tone,
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-current opacity-70"
                />
                {rt?.label ?? k}
                <span className="rounded-full bg-background/70 px-1.5 py-px text-[10px] font-semibold tabular-nums">
                  {count}
                </span>
              </span>
            )
          })}
        </div>
      </Section>

      <Section label={`Screens (${role.screens.length})`}>
        <div className="space-y-3">
          {orderedModules.map((mod) => {
            const items = screensByModule.get(mod.key) ?? []
            return (
              <div key={mod.key} className="overflow-hidden rounded-md border">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {mod.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {items.length} screen{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="divide-y bg-card">
                  {items.map(({ def, allowed_actions }) => {
                    const origin = def.role_type_keys.filter((k) =>
                      roleTypeSet.has(k),
                    )
                    return (
                      <li key={def.key} className="space-y-1.5 px-3 py-2.5">
                        {/* Top: label (left) and key (right). justify-between
                            + min-w-0 lets the label truncate when narrow. */}
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                            {def.label}
                          </span>
                          <span
                            className="shrink-0 font-mono text-[10px] text-muted-foreground"
                            title={def.key}
                          >
                            {def.key}
                          </span>
                        </div>

                        {/* Origin role-type chips + platform pills */}
                        {(origin.length > 0 || def.platforms.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1">
                            {origin.map((k) => {
                              const rt = roleTypeByKey.get(k)
                              if (!rt) return null
                              const tone = roleTypeToneByKey.get(k) ?? ""
                              return (
                                <span
                                  key={k}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                    tone,
                                  )}
                                  title={`Contributed by role type "${rt.label}"`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="size-1 rounded-full bg-current opacity-70"
                                  />
                                  {rt.label}
                                </span>
                              )
                            })}
                            {def.platforms.includes("web") && (
                              <PlatformPill icon={Monitor} label="Web" />
                            )}
                            {def.platforms.includes("mobile") && (
                              <PlatformPill icon={Smartphone} label="Mobile" />
                            )}
                          </div>
                        )}

                        {/* Actions: granted first (solid), denied after
                            (muted ghost, no strikethrough — reads cleaner) */}
                        <ActionList
                          actions={def.actions}
                          allowed={allowed_actions}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

/** Stat tile used in the View sheet's stats grid. */
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  )
}

/** Labelled vertical section with consistent header styling. */
function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  )
}

function PlatformPill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="size-3" />
      {label}
    </span>
  )
}

/**
 * Renders an action list with granted actions as solid primary pills and
 * not-granted as muted ghosts. We deliberately avoid `line-through` because
 * it cuts mid-glyph on descenders and looks like a rendering bug.
 */
function ActionList({
  actions,
  allowed,
}: {
  actions: string[]
  allowed: string[]
}) {
  const allowedSet = new Set(allowed)
  const granted = actions.filter((a) => allowedSet.has(a))
  const denied = actions.filter((a) => !allowedSet.has(a))
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Actions
      </span>
      {granted.map((a) => (
        <span
          key={a}
          className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {a}
        </span>
      ))}
      {denied.map((a) => (
        <span
          key={a}
          className="inline-flex items-center rounded-md border border-input bg-muted/30 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/70"
          title="Not granted by this role"
        >
          {a}
        </span>
      ))}
    </div>
  )
}

const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

function formatDateOnly(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return dateOnlyFormatter.format(d)
}

const ROLE_TYPE_PREVIEW_LIMIT = 2

/**
 * Renders the role-type chips for a row, capped at {@link ROLE_TYPE_PREVIEW_LIMIT}.
 * Any remaining types live behind a `+N` dropdown so wide compositions don't
 * blow out the column width.
 */
function RoleTypeChipList({
  keys,
  roleTypeByKey,
  roleTypeToneByKey,
}: {
  keys: string[]
  roleTypeByKey: Map<string, RoleTypeDef>
  roleTypeToneByKey: Map<string, string>
}) {
  const visible = keys.slice(0, ROLE_TYPE_PREVIEW_LIMIT)
  const hidden = keys.slice(ROLE_TYPE_PREVIEW_LIMIT)

  if (keys.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60">—</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((k) => (
        <RoleTypeChip
          key={k}
          k={k}
          roleTypeByKey={roleTypeByKey}
          roleTypeToneByKey={roleTypeToneByKey}
        />
      ))}
      {hidden.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // Don't bubble up to the row's expand handler.
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-input bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              title={`Show ${hidden.length} more role type${hidden.length === 1 ? "" : "s"}`}
              aria-label={`Show ${hidden.length} more role types`}
            >
              +{hidden.length}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[10rem] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              All role types
            </div>
            <div className="flex flex-wrap gap-1">
              {keys.map((k) => (
                <RoleTypeChip
                  key={k}
                  k={k}
                  roleTypeByKey={roleTypeByKey}
                  roleTypeToneByKey={roleTypeToneByKey}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function RoleTypeChip({
  k,
  roleTypeByKey,
  roleTypeToneByKey,
}: {
  k: string
  roleTypeByKey: Map<string, RoleTypeDef>
  roleTypeToneByKey: Map<string, string>
}) {
  const rt = roleTypeByKey.get(k)
  const tone = roleTypeToneByKey.get(k) ?? ""
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
        tone || "bg-muted/40",
      )}
    >
      <span
        aria-hidden="true"
        className="size-1 rounded-full bg-current opacity-70"
      />
      {rt?.label ?? k}
    </span>
  )
}

/**
 * Header cell wrapper that turns the column into a clickable sort toggle.
 * Inactive columns show a neutral up/down icon; the active column shows the
 * direction arrow. Clicking the active column flips direction.
 */
function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
}: {
  field: RoleSortField
  label: string
  sortBy: RoleSortField
  sortOrder: "asc" | "desc"
  onSort: (field: RoleSortField) => void
}) {
  const active = sortBy === field
  const Icon = active ? (sortOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={`Sort by ${label}`}
      aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <span>{label}</span>
      <Icon className="size-3" aria-hidden="true" />
    </button>
  )
}

/**
 * Numbered pagination control. Always renders First / Prev / Next / Last
 * controls; the numeric range collapses to "1 … N-2 N-1 N" once there are
 * more than 7 pages so the bar stays narrow.
 */
function Pagination({
  page,
  pageCount,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPage,
}: {
  page: number
  pageCount: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onPage: (page: number) => void
}) {
  const canPrev = page > 1
  const canNext = page < pageCount
  const items = getPageRange(page, pageCount)

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center gap-1"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onFirst}
        disabled={!canPrev}
        aria-label="First page"
      >
        <ChevronsLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>

      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            aria-hidden="true"
            className="px-1 text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "outline" : "ghost"}
            size="icon"
            className={cn(
              "size-8 text-xs font-medium tabular-nums",
              item === page
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onPage(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onLast}
        disabled={!canNext}
        aria-label="Last page"
      >
        <ChevronsRight />
      </Button>
    </nav>
  )
}

function getPageRange(
  current: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const items: (number | "ellipsis")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) items.push("ellipsis")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < totalPages - 1) items.push("ellipsis")
  items.push(totalPages)
  return items
}
