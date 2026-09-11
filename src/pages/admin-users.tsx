import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
  Power,
  PowerOff,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  activateAdminUser,
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  updateAdminUser,
  type AdminUser,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter,
  type AdminUsersSortField,
  type AdminUsersSortOrder,
  type ListAdminUsersParams,
} from "@/lib/admin-users"
import { useAuthStore } from "@/store/auth-store"

declare module "@tanstack/react-table" {
  // Allow columns to declare per-column horizontal alignment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    align?: "left" | "right" | "center"
  }
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; user: AdminUser }

export function AdminUsersPage() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null)
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<AdminUser | null>(null)

  // Server-driven table state: sorting, pagination.
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Toolbar toggles.
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [searchRowOpen, setSearchRowOpen] = React.useState(false)

  // Filter panel: pending = what the user has selected inside the panel;
  // applied = what's actually sent to the server. Apply commits pending →
  // applied. Reset clears both so the panel and the table match again.
  const [pendingStatus, setPendingStatus] = React.useState<
    AdminUserStatusFilter | undefined
  >(undefined)
  const [pendingRole, setPendingRole] = React.useState<
    AdminUserRoleFilter | undefined
  >(undefined)
  const [status, setStatus] = React.useState<AdminUserStatusFilter | undefined>(
    undefined,
  )
  const [role, setRole] = React.useState<AdminUserRoleFilter | undefined>(
    undefined,
  )

  // Per-column search: same pending vs applied split. Inputs only commit when
  // the user clicks "Apply search" (or presses Enter inside an input).
  type ColumnSearchState = {
    name: string
    email: string
    username: string
  }
  const emptyColumnSearch: ColumnSearchState = {
    name: "",
    email: "",
    username: "",
  }
  const [columnSearch, setColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const [appliedColumnSearch, setAppliedColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const initialLoadDoneRef = React.useRef(false)

  // Whenever the filter panel opens, sync the pending dropdowns with what's
  // currently applied so the user starts from the live state.
  React.useEffect(() => {
    if (filterPanelOpen) {
      setPendingStatus(status)
      setPendingRole(role)
    }
  }, [filterPanelOpen, status, role])

  // When the search row is hidden, drop any active column filters so the
  // table reverts to an unfiltered view.
  React.useEffect(() => {
    if (!searchRowOpen) {
      setColumnSearch(emptyColumnSearch)
      setAppliedColumnSearch(emptyColumnSearch)
    }
  }, [searchRowOpen])

  const handleColumnSearchChange = React.useCallback(
    (column: keyof ColumnSearchState, value: string) => {
      setColumnSearch((prev) => ({ ...prev, [column]: value }))
    },
    [],
  )

  const applyColumnSearch = () => {
    const next: ColumnSearchState = {
      name: columnSearch.name.trim(),
      email: columnSearch.email.trim(),
      username: columnSearch.username.trim(),
    }
    setColumnSearch(next)
    setAppliedColumnSearch(next)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetColumnSearch = () => {
    setColumnSearch(emptyColumnSearch)
    setAppliedColumnSearch(emptyColumnSearch)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const applyFilters = () => {
    setStatus(pendingStatus)
    setRole(pendingRole)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setPendingRole(undefined)
    setStatus(undefined)
    setRole(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty = pendingStatus !== status || pendingRole !== role
  const columnSearchDirty =
    columnSearch.name.trim() !== appliedColumnSearch.name ||
    columnSearch.email.trim() !== appliedColumnSearch.email ||
    columnSearch.username.trim() !== appliedColumnSearch.username
  const columnSearchHasInput =
    !!columnSearch.name || !!columnSearch.email || !!columnSearch.username

  const activeFilterCount =
    (status ? 1 : 0) +
    (role ? 1 : 0) +
    (appliedColumnSearch.name ? 1 : 0) +
    (appliedColumnSearch.email ? 1 : 0) +
    (appliedColumnSearch.username ? 1 : 0)

  const queryParams = React.useMemo<ListAdminUsersParams>(() => {
    const head = sorting[0]
    const sortBy: AdminUsersSortField =
      (head?.id as AdminUsersSortField | undefined) ?? "created_at"
    const sortOrder: AdminUsersSortOrder = head ? (head.desc ? "desc" : "asc") : "desc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      nameSearch: appliedColumnSearch.name || undefined,
      emailSearch: appliedColumnSearch.email || undefined,
      usernameSearch: appliedColumnSearch.username || undefined,
      status,
      role,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    appliedColumnSearch.name,
    appliedColumnSearch.email,
    appliedColumnSearch.username,
    status,
    role,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    // Every call gets a monotonically increasing id. Only the most recent
    // call is allowed to commit state — this dedupes StrictMode's double
    // effect invocation in dev, and any rapid-fire re-fetches in prod.
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listAdminUsers(queryParams)
      if (!isLatest()) return
      setUsers(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load admin users", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      if (isLatest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [queryParams])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((prev) => (typeof updater === "function" ? updater(prev) : updater))
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      return next.pageSize !== prev.pageSize ? { ...next, pageIndex: 0 } : next
    })
  }

  const requestToggleActive = (user: AdminUser) => setConfirmTarget(user)

  const handleToggleActive = async (user: AdminUser) => {
    setBusyId(user.id)
    try {
      const updated = user.is_active
        ? await deactivateAdminUser(user.id)
        : await activateAdminUser(user.id)
      toast.success(
        `${displayLabel(updated)} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      // Refetch so the row's position and status are authoritative.
      await load()
    } catch (err) {
      toast.error("Couldn't update admin status", {
        description:
          err instanceof ApiError
            ? err.message
            : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: AdminUser, kind: "create" | "edit") => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create"
        ? `${displayLabel(updated)} created.`
        : `${displayLabel(updated)} updated.`,
    )
    // Refetch so the new/edited row lands in the right place under the
    // current sort/filter/page.
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <h1 className="text-base font-semibold tracking-tight">Admin users</h1>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New admin
          </Button>
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <ToolbarIconToggle
            label="Filters"
            active={filterPanelOpen}
            onClick={() => setFilterPanelOpen((v) => !v)}
            badge={activeFilterCount > 0 ? activeFilterCount : undefined}
          >
            <Filter />
          </ToolbarIconToggle>
          <ToolbarIconToggle
            label="Search columns"
            active={searchRowOpen}
            onClick={() => setSearchRowOpen((v) => !v)}
          >
            <Search />
          </ToolbarIconToggle>
        </div>
      </div>

      <Sheet
        open={mode.kind !== "list"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "list" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind === "create" && (
            <AdminUserForm
              mode="create"
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(u) => handleSaved(u, "create")}
            />
          )}

          {mode.kind === "edit" && (
            <AdminUserForm
              mode="edit"
              user={mode.user}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(u) => handleSaved(u, "edit")}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            pendingStatus={pendingStatus}
            pendingRole={pendingRole}
            onPendingStatusChange={setPendingStatus}
            onPendingRoleChange={setPendingRole}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={!status && !role && !pendingStatus && !pendingRole}
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <UsersTable
            users={users}
            total={total}
            pageCount={pageCount}
            currentUserId={currentUserId}
            busyId={busyId}
            formOpen={mode.kind !== "list"}
            loading={loading}
            refreshing={refreshing}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            searchRowOpen={searchRowOpen}
            columnSearch={columnSearch}
            onColumnSearchChange={handleColumnSearchChange}
            onApplyColumnSearch={applyColumnSearch}
            onResetColumnSearch={resetColumnSearch}
            columnSearchApplyDisabled={!columnSearchDirty}
            columnSearchResetDisabled={
              !columnSearchHasInput &&
              !appliedColumnSearch.name &&
              !appliedColumnSearch.email &&
              !appliedColumnSearch.username
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(u) => setMode({ kind: "edit", user: u })}
            onToggleActive={requestToggleActive}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={
          confirmTarget?.is_active
            ? "Deactivate admin user?"
            : "Activate admin user?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated admins can't sign in. Existing access tokens remain valid until they expire."
                : "Reactivated admins will be able to sign in again."}
              <div className="mt-2 font-medium text-foreground">
                {displayLabel(confirmTarget)}
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
    </div>
  )
}

function ToolbarIconToggle({
  label,
  active,
  onClick,
  badge,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "relative inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-input bg-background",
      )}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}

function FilterPanel({
  pendingStatus,
  pendingRole,
  onPendingStatusChange,
  onPendingRoleChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: AdminUserStatusFilter | undefined
  pendingRole: AdminUserRoleFilter | undefined
  onPendingStatusChange: (v: AdminUserStatusFilter | undefined) => void
  onPendingRoleChange: (v: AdminUserRoleFilter | undefined) => void
  onApply: () => void
  onReset: () => void
  onClose: () => void
  applyDisabled: boolean
  resetDisabled: boolean
}) {
  return (
    <aside className="flex w-64 flex-none flex-col rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={onClose}
          aria-label="Close filters"
        >
          <X />
        </Button>
      </div>
      <div className="flex-1 space-y-5 px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            value={pendingStatus ?? ""}
            onChange={(e) =>
              onPendingStatusChange(
                e.target.value === ""
                  ? undefined
                  : (e.target.value as AdminUserStatusFilter),
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-role">Role</Label>
          <select
            id="filter-role"
            value={pendingRole ?? ""}
            onChange={(e) =>
              onPendingRoleChange(
                e.target.value === ""
                  ? undefined
                  : (e.target.value as AdminUserRoleFilter),
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <option value="">All roles</option>
            <option value="master">Master admin</option>
            <option value="admin">Standard admin</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={resetDisabled}
        >
          Reset
        </Button>
        <Button size="sm" onClick={onApply} disabled={applyDisabled}>
          Apply
        </Button>
      </div>
    </aside>
  )
}

type ColumnSearchValues = {
  name: string
  email: string
  username: string
}

function UsersTable({
  users,
  total,
  pageCount,
  currentUserId,
  busyId,
  formOpen,
  loading,
  refreshing,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  searchRowOpen,
  columnSearch,
  onColumnSearchChange,
  onApplyColumnSearch,
  onResetColumnSearch,
  columnSearchApplyDisabled,
  columnSearchResetDisabled,
  hasActiveFilters,
  onOpenFilters,
  onResetFilters,
  loadFailed,
  onRetry,
  onEdit,
  onToggleActive,
}: {
  users: AdminUser[]
  total: number
  pageCount: number
  currentUserId: string | null
  busyId: string | null
  formOpen: boolean
  loading: boolean
  refreshing: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  searchRowOpen: boolean
  columnSearch: ColumnSearchValues
  onColumnSearchChange: (column: keyof ColumnSearchValues, value: string) => void
  onApplyColumnSearch: () => void
  onResetColumnSearch: () => void
  columnSearchApplyDisabled: boolean
  columnSearchResetDisabled: boolean
  hasActiveFilters: boolean
  onOpenFilters: () => void
  onResetFilters: () => void
  loadFailed: boolean
  onRetry: () => void
  onEdit: (u: AdminUser) => void
  onToggleActive: (u: AdminUser) => void
}) {
  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (u) => u.display_name ?? "",
        cell: ({ row }) => {
          const u = row.original
          const isSelf = u.id === currentUserId
          return (
            <div className="font-medium">
              {u.display_name ?? "—"}
              {isSelf && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  you
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: "email",
        header: "Email",
        accessorKey: "email",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? "")}</span>
        ),
      },
      {
        id: "username",
        header: "Username",
        accessorKey: "username",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (u) => (u.is_master_admin ? "master" : "admin"),
        cell: ({ row }) =>
          row.original.is_master_admin ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <ShieldCheck className="size-3" /> Master
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Admin</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (u) => (u.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const u = row.original
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                u.is_active
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  u.is_active ? "bg-success" : "bg-destructive",
                )}
              />
              {u.is_active ? "Active" : "Inactive"}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { align: "right" as const },
        cell: ({ row }) => {
          const u = row.original
          const isSelf = u.id === currentUserId
          const isBusy = busyId === u.id
          const toggleLabel = isSelf
            ? "You cannot change your own status"
            : u.is_active
              ? "Deactivate"
              : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(u)}
                disabled={formOpen || isBusy}
                title="Edit"
                aria-label="Edit"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  u.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(u)}
                disabled={isSelf || isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {u.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, currentUserId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableMultiSort: false,
    pageCount,
    rowCount: total,
    getCoreRowModel: getCoreRowModel(),
  })

  const { pageIndex, pageSize } = pagination
  const firstRow = total === 0 ? 0 : pageIndex * pageSize + 1
  const lastRow = Math.min(total, (pageIndex + 1) * pageSize)

  return (
    <div className="relative">
      <Table containerClassName="h-[36rem] overflow-y-auto thin-scrollbar">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const align = header.column.columnDef.meta?.align
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      align === "right" && "text-right",
                      align === "center" && "text-center",
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "-ml-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-accent hover:text-accent-foreground",
                          sorted && "text-foreground",
                        )}
                        aria-label={`Sort by ${String(header.column.id)}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
          {searchRowOpen && (
            <TableRow className="hover:bg-transparent">
              {table.getAllLeafColumns().map((column) => {
                const id = column.id
                const searchable: Record<string, keyof ColumnSearchValues> = {
                  name: "name",
                  email: "email",
                  username: "username",
                }
                const key = searchable[id]
                return (
                  <TableHead
                    key={`search-${id}`}
                    className="bg-card py-2"
                  >
                    {key ? (
                      <Input
                        value={columnSearch[key]}
                        onChange={(e) => onColumnSearchChange(key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            if (!columnSearchApplyDisabled) onApplyColumnSearch()
                          }
                        }}
                        placeholder={`Search ${id}…`}
                        className="h-8 text-xs"
                        aria-label={`Search by ${id}`}
                      />
                    ) : id === "actions" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-8",
                            columnSearchResetDisabled
                              ? "text-muted-foreground"
                              : "text-destructive hover:bg-destructive/10 hover:text-destructive",
                          )}
                          onClick={onResetColumnSearch}
                          disabled={columnSearchResetDisabled}
                          title="Clear search"
                          aria-label="Clear search"
                        >
                          <X />
                        </Button>
                        <Button
                          size="icon"
                          variant={columnSearchApplyDisabled ? "ghost" : "default"}
                          className={cn(
                            "size-8",
                            columnSearchApplyDisabled && "text-muted-foreground",
                          )}
                          onClick={onApplyColumnSearch}
                          disabled={columnSearchApplyDisabled}
                          title="Apply search"
                          aria-label="Apply search"
                        >
                          <Search />
                        </Button>
                      </div>
                    ) : null}
                  </TableHead>
                )
              })}
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {loading || refreshing ? (
            Array.from({ length: pageSize }).map((_, rowIdx) => (
              <TableRow key={`s-${rowIdx}`} className="hover:bg-transparent">
                {table.getAllLeafColumns().map((column) => {
                  const id = column.id
                  // Vary skeleton widths per column so the rows feel like real data.
                  const widths: Record<string, string> = {
                    name: "w-40",
                    email: "w-56",
                    username: "w-24",
                    role: "w-16",
                    status: "w-16",
                    actions: "w-16",
                  }
                  const widthCls = widths[id] ?? "w-24"
                  const align = column.columnDef.meta?.align
                  return (
                    <TableCell
                      key={`s-${rowIdx}-${id}`}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      <Skeleton
                        className={cn(
                          "h-4 inline-block align-middle",
                          widthCls,
                          id === "status" || id === "role"
                            ? "rounded-full"
                            : undefined,
                        )}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="p-0"
              >
                {loadFailed ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load admin users"
                    description="There was a problem reaching the server."
                    action={
                      <Button size="sm" onClick={onRetry}>
                        <RefreshCw />
                        Try again
                      </Button>
                    }
                  />
                ) : hasActiveFilters ? (
                  <EmptyState
                    icon={SearchX}
                    title="No matches found"
                    description="No admin users match the current filters."
                    action={
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={onOpenFilters}>
                          <Filter />
                          Adjust filters
                        </Button>
                        <Button size="sm" onClick={onResetFilters}>
                          Reset filters
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={UserPlus}
                    title="No admin users yet"
                    description="Create the first admin account to get started."
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/20 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor="rows-per-page" className="text-muted-foreground">
              Number of Rows:
            </label>
            <select
              id="rows-per-page"
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 pr-7 text-xs font-medium shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {[10, 25, 50, 100].map((size) => (
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
          pageIndex={pageIndex}
          pageCount={pageCount}
          onFirst={() => table.setPageIndex(0)}
          onPrev={() => table.previousPage()}
          onNext={() => table.nextPage()}
          onLast={() => table.setPageIndex(Math.max(0, pageCount - 1))}
          onPage={(p) => table.setPageIndex(p - 1)}
        />
      </div>
    </div>
  )
}

function Pagination({
  pageIndex,
  pageCount,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPage,
}: {
  pageIndex: number
  pageCount: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onPage: (page: number) => void
}) {
  const current = pageCount === 0 ? 0 : pageIndex + 1
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1
  const items = getPageRange(current, pageCount)

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
            variant={item === current ? "outline" : "ghost"}
            size="icon"
            className={cn(
              "size-8 text-xs font-medium tabular-nums",
              item === current
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onPage(item)}
            aria-label={`Page ${item}`}
            aria-current={item === current ? "page" : undefined}
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

function getPageRange(current: number, totalPages: number): (number | "ellipsis")[] {
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

const createSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(64, "Too long")
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, underscore, or dash"),
  email: z.email("Enter a valid email").max(255, "Too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Too long"),
  first_name: z.string().max(64, "Too long").transform((v) => v.trim()),
  last_name: z.string().max(64, "Too long").transform((v) => v.trim()),
  mobile_local: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || v.length === 10, "Enter exactly 10 digits")
    .refine(
      (v) => v.length === 0 || /^[6-9]\d{9}$/.test(v),
      "Indian mobile must start with 6-9",
    ),
})

const editSchema = z.object({
  email: z.email("Enter a valid email").max(255, "Too long"),
  first_name: z.string().max(64, "Too long").transform((v) => v.trim()),
  last_name: z.string().max(64, "Too long").transform((v) => v.trim()),
  mobile_local: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || v.length === 10, "Enter exactly 10 digits")
    .refine(
      (v) => v.length === 0 || /^[6-9]\d{9}$/.test(v),
      "Indian mobile must start with 6-9",
    ),
  new_password: z
    .string()
    .max(128, "Too long")
    .refine((v) => v.length === 0 || v.length >= 8, "At least 8 characters"),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

const INDIA_DIAL_CODE = "91"
const INDIA_PREFIX_DISPLAY = "+91"

function toLocal(stored: string | null | undefined): string {
  return (stored ?? "").replace(/\D/g, "").slice(0, 10)
}

function AdminUserForm(
  props:
    | { mode: "create"; onCancel: () => void; onSaved: (u: AdminUser) => void }
    | {
        mode: "edit"
        user: AdminUser
        onCancel: () => void
        onSaved: (u: AdminUser) => void
      },
) {
  if (props.mode === "edit") {
    const defaults: EditValues = {
      email: props.user.email,
      first_name: props.user.first_name ?? "",
      last_name: props.user.last_name ?? "",
      mobile_local: toLocal(props.user.mobile_number),
      new_password: "",
    }
    return (
      <EditForm
        defaults={defaults}
        user={props.user}
        onCancel={props.onCancel}
        onSaved={props.onSaved}
      />
    )
  }

  return <CreateForm onCancel={props.onCancel} onSaved={props.onSaved} />
}

function CreateForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: (u: AdminUser) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      mobile_local: "",
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const hasMobile = values.mobile_local !== ""
      const created = await createAdminUser({
        username: values.username,
        email: values.email,
        password: values.password,
        first_name: values.first_name === "" ? null : values.first_name,
        last_name: values.last_name === "" ? null : values.last_name,
        country_code: hasMobile ? INDIA_DIAL_CODE : null,
        mobile_number: hasMobile ? values.mobile_local : null,
      })
      onSaved(created)
    } catch (err) {
      toast.error("Couldn't create admin user", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Create admin user</SheetTitle>
        <SheetDescription>
          Add a new admin to Nucleus. They'll set up 2FA on first sign-in.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 hd:grid-cols-2">
          <Field label="Username" error={errors.username?.message} htmlFor="cu-username" required>
            <Input id="cu-username" autoComplete="off" {...register("username")} />
          </Field>
          <Field label="Email" error={errors.email?.message} htmlFor="cu-email" required>
            <Input id="cu-email" type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label="First name" error={errors.first_name?.message} htmlFor="cu-first">
            <Input id="cu-first" autoComplete="off" {...register("first_name")} />
          </Field>
          <Field label="Last name" error={errors.last_name?.message} htmlFor="cu-last">
            <Input id="cu-last" autoComplete="off" {...register("last_name")} />
          </Field>
          <Field label="Mobile" error={errors.mobile_local?.message} htmlFor="cu-mobile">
            <MobileInput
              id="cu-mobile"
              register={register("mobile_local", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                  if (digits !== e.target.value) e.target.value = digits
                },
              })}
              invalid={!!errors.mobile_local}
            />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="cu-password" required>
            <Input
              id="cu-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          New admins are created as standard admins. Master-admin privileges
          are managed in the database, not from this screen.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create admin"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function EditForm({
  defaults,
  user,
  onCancel,
  onSaved,
}: {
  defaults: EditValues
  user: AdminUser
  onCancel: () => void
  onSaved: (u: AdminUser) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const hasMobile = values.mobile_local !== ""
      const updated = await updateAdminUser(user.id, {
        email: values.email,
        first_name: values.first_name === "" ? null : values.first_name,
        last_name: values.last_name === "" ? null : values.last_name,
        country_code: hasMobile ? INDIA_DIAL_CODE : null,
        mobile_number: hasMobile ? values.mobile_local : null,
        password: values.new_password === "" ? undefined : values.new_password,
      })
      onSaved(updated)
    } catch (err) {
      toast.error("Couldn't update admin user", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Edit {user.display_name ?? user.username}</SheetTitle>
        <SheetDescription>{user.email}</SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 hd:grid-cols-2">
          <Field label="Email" error={errors.email?.message} htmlFor="eu-email" required>
            <Input id="eu-email" type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label="Username" htmlFor="eu-username">
            <Input id="eu-username" value={user.username} readOnly disabled />
          </Field>
          <Field label="First name" error={errors.first_name?.message} htmlFor="eu-first">
            <Input id="eu-first" autoComplete="off" {...register("first_name")} />
          </Field>
          <Field label="Last name" error={errors.last_name?.message} htmlFor="eu-last">
            <Input id="eu-last" autoComplete="off" {...register("last_name")} />
          </Field>
          <Field label="Mobile" error={errors.mobile_local?.message} htmlFor="eu-mobile">
            <MobileInput
              id="eu-mobile"
              register={register("mobile_local", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                  if (digits !== e.target.value) e.target.value = digits
                },
              })}
              invalid={!!errors.mobile_local}
            />
          </Field>
          <Field
            label="New password"
            error={errors.new_password?.message}
            htmlFor="eu-password"
            hint="Leave blank to keep the current password"
          >
            <Input
              id="eu-password"
              type="password"
              autoComplete="new-password"
              {...register("new_password")}
            />
          </Field>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Master-admin privileges are managed in the database and cannot be
          changed from this screen.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function MobileInput({
  id,
  register,
  invalid,
}: {
  id: string
  register: ReturnType<ReturnType<typeof useForm>["register"]>
  invalid: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-stretch rounded-md border border-input bg-background text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
        invalid && "border-destructive",
      )}
    >
      <span className="grid select-none place-items-center border-r border-input bg-muted px-3 text-muted-foreground">
        {INDIA_PREFIX_DISPLAY}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        aria-invalid={invalid}
        className="w-full rounded-r-md bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        {...register}
      />
    </div>
  )
}

function displayLabel(u: AdminUser): string {
  return u.display_name ?? u.username ?? u.email
}
