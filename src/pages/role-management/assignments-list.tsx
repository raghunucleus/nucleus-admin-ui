import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { listEmployees, type Employee } from "@/lib/employees"
import {
  listAssignments,
  listRoles,
  revokeAssignment,
  type AssignmentDetail,
  type AssignmentSortField,
  type RoleDetail,
} from "@/lib/rbac"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

// Sticky column shims — same pattern as roles-list.tsx so the two tables
// behave identically when horizontally scrolled.
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

export function AssignmentsListPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    employee_id?: number
    role_id?: number
  }

  const [assignments, setAssignments] = React.useState<AssignmentDetail[]>([])
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [roles, setRoles] = React.useState<RoleDetail[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [confirmTarget, setConfirmTarget] =
    React.useState<AssignmentDetail | null>(null)

  const employeeId = search.employee_id
  const roleId = search.role_id

  // Local-only state for the new server-driven controls. Employee/role filters
  // still live in the URL (so deep links from the roles page survive reloads);
  // search/sort/page are transient.
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [sortBy, setSortBy] =
    React.useState<AssignmentSortField>("created_at")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE)

  // Debounce the search box so we don't refetch on every keystroke. Reset to
  // page 1 inside the same tick so the page change and the search change
  // collapse into a single refetch.
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

  // Fetch the employee/role pickers once — they only feed the filter combos
  // and don't need to refresh on every page change.
  React.useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [empRes, roleRes] = await Promise.all([
          listEmployees({ page: 1, pageSize: 100, status: "active" }),
          listRoles({ page: 1, pageSize: 100 }),
        ])
        if (!alive) return
        setEmployees(empRes.rows)
        setRoles(roleRes.rows)
      } catch {
        // Picker failures aren't fatal — the table can still render and the
        // assignments-load toast (below) surfaces any real outage.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const assignmentRes = await listAssignments({
        employee_id: employeeId,
        role_id: roleId,
        q: debouncedQuery || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      })
      setAssignments(assignmentRes.rows)
      setTotal(assignmentRes.total)
      setPageCount(assignmentRes.pageCount)
      setLoadFailed(false)
    } catch (err) {
      setLoadFailed(true)
      toast.error("Couldn't load assignments", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [
    employeeId,
    roleId,
    debouncedQuery,
    page,
    pageSize,
    sortBy,
    sortOrder,
  ])

  React.useEffect(() => {
    void load()
  }, [load])

  const employeeOptions: ComboboxOption[] = React.useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: e.emp_display_name,
        sublabel: e.emp_code,
      })),
    [employees],
  )

  const roleOptions: ComboboxOption[] = React.useMemo(
    () =>
      roles.map((r) => ({
        value: r.id,
        label: r.name,
        // Code is the unique identifier admins recognise; show it as a sublabel
        // (with "inactive" appended when applicable) so it's always visible
        // alongside the display name in the filter dropdown.
        sublabel: r.is_active ? r.code : `${r.code} · inactive`,
      })),
    [roles],
  )

  const setFilter = (next: {
    employee_id?: number
    role_id?: number
  }) => {
    setPage(1)
    navigate({
      to: "/role-management/assignments",
      search: () => ({
        employee_id: next.employee_id,
        role_id: next.role_id,
      }),
    })
  }

  /**
   * Toggle the sort for a given column. Resets to page 1 because the previous
   * offset is meaningless under a new ordering.
   */
  const requestSort = (field: AssignmentSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      // Sensible default direction per column: newest-first for dates,
      // alphabetical for names, active-first for status.
      setSortOrder(
        field === "created_at" || field === "updated_at" ? "desc" : "asc",
      )
    }
    setPage(1)
  }

  const handlePageSizeChange = (next: number) => {
    setPageSize(next)
    setPage(1)
  }

  const handleRevoke = async (assignment: AssignmentDetail) => {
    setBusyId(assignment.id)
    try {
      await revokeAssignment(assignment.id)
      toast.success("Assignment revoked.")
      await load()
    } catch (err) {
      toast.error("Couldn't revoke assignment", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const hasFilters = employeeId !== undefined || roleId !== undefined
  const hasActiveFilters = hasFilters || debouncedQuery.length > 0
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total)

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Role assignments
          </h1>
          <p className="text-xs text-muted-foreground">
            Which employees hold which composed roles, with their per-screen
            attribute scope.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
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
          <Link
            to="/role-management/assignments/$assignmentId"
            params={{ assignmentId: "new" }}
            search={{
              employee_id: employeeId,
              role_id: roleId,
            }}
          >
            <Button size="sm">
              <Plus />
              New assignment
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
        {/* Top row: free-text search + status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by employee name/code or role name/code…"
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
        </div>

        {/* Bottom row: employee + role comboboxes + clear */}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Filter by employee</Label>
            <Combobox
              value={employeeId ?? null}
              options={employeeOptions}
              onChange={(v) =>
                setFilter({
                  employee_id: v ?? undefined,
                  role_id: roleId,
                })
              }
              placeholder="All employees"
              clearLabel="All employees"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Filter by role</Label>
            <Combobox
              value={roleId ?? null}
              options={roleOptions}
              onChange={(v) =>
                setFilter({
                  employee_id: employeeId,
                  role_id: v ?? undefined,
                })
              }
              placeholder="All roles"
              clearLabel="All roles"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("")
              setFilter({})
            }}
            disabled={!hasActiveFilters}
            className="text-muted-foreground"
          >
            <X />
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={STICKY_LEFT_HEAD}>
                  <SortHeader
                    field="employee"
                    label="Employee"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={requestSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    field="role"
                    label="Role"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={requestSort}
                  />
                </TableHead>
                <TableHead className="text-right">Attributes</TableHead>
                <TableHead>
                  <SortHeader
                    field="created_at"
                    label="Assigned"
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
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : assignments.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    {loadFailed ? (
                      <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load assignments"
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
                        icon={Filter}
                        title="No matches"
                        description="No assignments match the current filters."
                        action={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setQuery("")
                              setFilter({})
                            }}
                          >
                            Clear filters
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="No assignments yet"
                        description="Assign a role to an employee to start gating access."
                        action={
                          <Link
                            to="/role-management/assignments/$assignmentId"
                            params={{ assignmentId: "new" }}
                            search={{
                              employee_id: undefined,
                              role_id: undefined,
                            }}
                          >
                            <Button size="sm">
                              <Plus />
                              New assignment
                            </Button>
                          </Link>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => {
                  const isBusy = busyId === a.id
                  return (
                    <TableRow key={a.id}>
                      <TableCell
                        className={cn(STICKY_LEFT_CELL, "max-w-[220px]")}
                      >
                        <div
                          className="truncate font-medium"
                          title={a.employee_display_name}
                        >
                          {a.employee_display_name}
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {a.employee_emp_code}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <Link
                          to="/role-management/roles/$roleId"
                          params={{ roleId: String(a.role_id) }}
                          title={a.role_name}
                          className="block truncate font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {a.role_name}
                        </Link>
                        {a.role_code && (
                          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {a.role_code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.attributes.length}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(a.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(a.updated_at)}
                        </span>
                      </TableCell>
                      <TableCell className={STICKY_RIGHT_CELL}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            to="/role-management/assignments/$assignmentId"
                            params={{ assignmentId: String(a.id) }}
                            search={{
                              employee_id: undefined,
                              role_id: undefined,
                            }}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirmTarget(a)}
                            disabled={isBusy}
                            title="Revoke"
                            aria-label="Revoke"
                          >
                            <Undo2 />
                          </Button>
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
        {assignments.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/20 px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="assignments-rows-per-page"
                  className="text-muted-foreground"
                >
                  Rows per page:
                </label>
                <select
                  id="assignments-rows-per-page"
                  value={pageSize}
                  onChange={(e) =>
                    handlePageSizeChange(Number(e.target.value))
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 pr-7 text-xs font-medium shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        title="Revoke this assignment?"
        description={
          confirmTarget ? (
            <>
              The employee will immediately lose effective access granted by
              this role.
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.employee_display_name} —{" "}
                {confirmTarget.role_name}
              </div>
            </>
          ) : undefined
        }
        confirmLabel="Revoke"
        tone="destructive"
        loading={busyId === confirmTarget?.id}
        onConfirm={async () => {
          if (!confirmTarget) return
          const target = confirmTarget
          await handleRevoke(target)
          setConfirmTarget(null)
        }}
      />
    </div>
  )
}

/**
 * Header cell wrapper that turns the column into a clickable sort toggle.
 * Inactive columns show a neutral up/down icon; the active column shows the
 * direction arrow.
 */
function SortHeader({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
}: {
  field: AssignmentSortField
  label: string
  sortBy: AssignmentSortField
  sortOrder: "asc" | "desc"
  onSort: (field: AssignmentSortField) => void
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
      aria-sort={
        active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <span>{label}</span>
      <Icon className="size-3" aria-hidden="true" />
    </button>
  )
}

/**
 * Numbered pagination control. Same layout as roles-list — first / prev /
 * numbered range with ellipsis past 7 pages / next / last.
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
