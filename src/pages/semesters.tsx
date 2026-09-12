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
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SearchX,
  X,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
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
  activateSemester,
  createSemester,
  deactivateSemester,
  listSemesters,
  updateSemester,
  type ListSemestersParams,
  type Semester,
  type SemesterStatusFilter,
  type SemestersSortField,
  type SemestersSortOrder,
} from "@/lib/semesters"

declare module "@tanstack/react-table" {
  // Allow columns to declare per-column horizontal alignment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    align?: "left" | "right" | "center"
  }
}

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; semester: Semester }

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

export function SemestersPage() {
  const [semesters, setSemesters] = React.useState<Semester[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<Semester | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "sem_number", desc: false },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [searchRowOpen, setSearchRowOpen] = React.useState(false)

  const [pendingStatus, setPendingStatus] = React.useState<
    SemesterStatusFilter | undefined
  >(undefined)
  const [status, setStatus] = React.useState<SemesterStatusFilter | undefined>(
    undefined,
  )

  type ColumnSearchState = {
    sem_number: string
    code: string
    name: string
  }
  const emptyColumnSearch: ColumnSearchState = {
    sem_number: "",
    code: "",
    name: "",
  }
  const [columnSearch, setColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const [appliedColumnSearch, setAppliedColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    if (filterPanelOpen) setPendingStatus(status)
  }, [filterPanelOpen, status])

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
      sem_number: columnSearch.sem_number.trim(),
      code: columnSearch.code.trim(),
      name: columnSearch.name.trim(),
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
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setStatus(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty = pendingStatus !== status
  const columnSearchDirty =
    columnSearch.sem_number.trim() !== appliedColumnSearch.sem_number ||
    columnSearch.code.trim() !== appliedColumnSearch.code ||
    columnSearch.name.trim() !== appliedColumnSearch.name
  const columnSearchHasInput =
    !!columnSearch.sem_number || !!columnSearch.code || !!columnSearch.name

  const activeFilterCount =
    (status ? 1 : 0) +
    (appliedColumnSearch.sem_number ? 1 : 0) +
    (appliedColumnSearch.code ? 1 : 0) +
    (appliedColumnSearch.name ? 1 : 0)

  const queryParams = React.useMemo<ListSemestersParams>(() => {
    const head = sorting[0]
    const sortBy: SemestersSortField =
      (head?.id as SemestersSortField | undefined) ?? "sem_number"
    const sortOrder: SemestersSortOrder = head ? (head.desc ? "desc" : "asc") : "asc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      semNumberSearch: appliedColumnSearch.sem_number || undefined,
      codeSearch: appliedColumnSearch.code || undefined,
      nameSearch: appliedColumnSearch.name || undefined,
      status,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    appliedColumnSearch.sem_number,
    appliedColumnSearch.code,
    appliedColumnSearch.name,
    status,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listSemesters(queryParams)
      if (!isLatest()) return
      setSemesters(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load semesters", {
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

  const requestToggleActive = (semester: Semester) => setConfirmTarget(semester)

  const handleToggleActive = async (semester: Semester) => {
    setBusyId(semester.id)
    try {
      const updated = semester.is_active
        ? await deactivateSemester(semester.id)
        : await activateSemester(semester.id)
      toast.success(
        `${updated.code} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update semester status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: Semester, kind: "create" | "edit") => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create" ? `${updated.code} created.` : `${updated.code} updated.`,
    )
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader
        title="Semesters"
        actions={
          <>
            <Button
              size="sm"
              onClick={() => setMode({ kind: "create" })}
              disabled={mode.kind !== "list"}
            >
              <Plus />
              New semester
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
          </>
        }
      />

      <Sheet
        open={mode.kind !== "list"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "list" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind === "create" && (
            <SemesterForm
              mode="create"
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(s) => handleSaved(s, "create")}
            />
          )}

          {mode.kind === "edit" && (
            <SemesterForm
              mode="edit"
              semester={mode.semester}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(s) => handleSaved(s, "edit")}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            pendingStatus={pendingStatus}
            onPendingStatusChange={setPendingStatus}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={!status && !pendingStatus}
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <SemestersTable
            semesters={semesters}
            total={total}
            pageCount={pageCount}
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
              !appliedColumnSearch.sem_number &&
              !appliedColumnSearch.code &&
              !appliedColumnSearch.name
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(s) => setMode({ kind: "edit", semester: s })}
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
          confirmTarget?.is_active ? "Deactivate semester?" : "Activate semester?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated semesters won't be selectable in dependent records."
                : "Reactivated semesters become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.code}{" "}
                <span className="text-muted-foreground">— {confirmTarget.name}</span>
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
  onPendingStatusChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: SemesterStatusFilter | undefined
  onPendingStatusChange: (v: SemesterStatusFilter | undefined) => void
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
                  : (e.target.value as SemesterStatusFilter),
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
  sem_number: string
  code: string
  name: string
}

function SemestersTable({
  semesters,
  total,
  pageCount,
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
  semesters: Semester[]
  total: number
  pageCount: number
  busyId: number | null
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
  onEdit: (s: Semester) => void
  onToggleActive: (s: Semester) => void
}) {
  const columns = React.useMemo<ColumnDef<Semester>[]>(
    () => [
      {
        id: "sem_number",
        header: "Sem #",
        accessorKey: "sem_number",
        cell: ({ getValue }) => (
          <div className="font-medium tabular-nums">{String(getValue() ?? "")}</div>
        ),
      },
      {
        id: "code",
        header: "Code",
        accessorKey: "code",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? "")}</span>
        ),
      },
      {
        id: "year_sem_format",
        header: "Year-sem",
        accessorKey: "year_sem_format",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "roman_format",
        header: "Roman",
        accessorKey: "roman_format",
        cell: ({ getValue }) => (
          <span className="font-medium text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (s) => (s.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                s.is_active
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  s.is_active ? "bg-success" : "bg-destructive",
                )}
              />
              {s.is_active ? "Active" : "Inactive"}
            </span>
          )
        },
      },
      {
        id: "created_at",
        header: "Created at",
        accessorKey: "created_at",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(String(getValue() ?? ""))}
          </span>
        ),
      },
      {
        id: "updated_at",
        header: "Updated at",
        accessorKey: "updated_at",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(String(getValue() ?? ""))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { align: "right" as const },
        cell: ({ row }) => {
          const s = row.original
          const isBusy = busyId === s.id
          const toggleLabel = s.is_active ? "Deactivate" : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(s)}
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
                  s.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(s)}
                disabled={isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {s.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: semesters,
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
                  sem_number: "sem_number",
                  code: "code",
                  name: "name",
                }
                const key = searchable[id]
                return (
                  <TableHead key={`search-${id}`} className="bg-card py-2">
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
                        placeholder={`Search ${id.replace("_", " ")}…`}
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
                  const widths: Record<string, string> = {
                    sem_number: "w-10",
                    code: "w-16",
                    name: "w-32",
                    year_sem_format: "w-12",
                    roman_format: "w-10",
                    status: "w-16",
                    created_at: "w-32",
                    updated_at: "w-32",
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
                          id === "status" ? "rounded-full" : undefined,
                        )}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getAllLeafColumns().length} className="p-0">
                {loadFailed ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load semesters"
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
                    description="No semesters match the current filters."
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
                    icon={CalendarClock}
                    title="No semesters yet"
                    description="Create the first semester to get started."
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
    <nav role="navigation" aria-label="Pagination" className="flex items-center gap-1">
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

// Form keeps sem_number as string so an empty input is representable; we parse
// to a number on submit. Avoids the zod-coerce/useForm type mismatch.
const semesterSchema = z.object({
  sem_number: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a positive whole number")
    .refine((s) => {
      const n = Number(s)
      return n >= 1 && n <= 16
    }, "Sem number must be between 1 and 16"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(16, "Too long")
    .transform((v) => v.toUpperCase())
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9._-]+$/, "Use letters, numbers, dot, underscore, or dash"),
    ),
  name: z.string().trim().min(1, "Name is required").max(64, "Too long"),
  year_sem_format: z
    .string()
    .trim()
    .min(1, "Year-sem format is required")
    .max(16, "Too long"),
  roman_format: z
    .string()
    .trim()
    .min(1, "Roman format is required")
    .max(8, "Too long"),
})

type SemesterFormValues = z.infer<typeof semesterSchema>

function SemesterForm(
  props:
    | { mode: "create"; onCancel: () => void; onSaved: (s: Semester) => void }
    | {
        mode: "edit"
        semester: Semester
        onCancel: () => void
        onSaved: (s: Semester) => void
      },
) {
  const defaults: SemesterFormValues =
    props.mode === "edit"
      ? {
          sem_number: String(props.semester.sem_number),
          code: props.semester.code,
          name: props.semester.name,
          year_sem_format: props.semester.year_sem_format,
          roman_format: props.semester.roman_format,
        }
      : {
          sem_number: "",
          code: "",
          name: "",
          year_sem_format: "",
          roman_format: "",
        }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const onSubmit = handleSubmit(async (values) => {
    const sem_number = Number(values.sem_number)
    try {
      if (props.mode === "create") {
        const created = await createSemester({
          sem_number,
          code: values.code,
          name: values.name,
          year_sem_format: values.year_sem_format,
          roman_format: values.roman_format,
        })
        props.onSaved(created)
      } else {
        const updated = await updateSemester(props.semester.id, {
          sem_number,
          code: values.code,
          name: values.name,
          year_sem_format: values.year_sem_format,
          roman_format: values.roman_format,
        })
        props.onSaved(updated)
      }
    } catch (err) {
      toast.error(
        props.mode === "create"
          ? "Couldn't create semester"
          : "Couldn't update semester",
        {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {props.mode === "create"
            ? "Create semester"
            : `Edit ${props.semester.code}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a new semester definition."
            : "Update the semester details."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 hd:grid-cols-2">
          <Field
            label="Sem number"
            error={errors.sem_number?.message}
            htmlFor="s-num"
            required
            hint="Positive whole number (1–16)"
          >
            <Input
              id="s-num"
              type="number"
              inputMode="numeric"
              min={1}
              max={16}
              autoComplete="off"
              {...register("sem_number")}
            />
          </Field>
          <Field label="Code" error={errors.code?.message} htmlFor="s-code" required>
            <Input
              id="s-code"
              autoComplete="off"
              className="uppercase"
              {...register("code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const upper = e.target.value.toUpperCase()
                  if (upper !== e.target.value) e.target.value = upper
                },
              })}
            />
          </Field>
          <Field label="Name" error={errors.name?.message} htmlFor="s-name" required>
            <Input id="s-name" autoComplete="off" {...register("name")} />
          </Field>
          <Field
            label="Year-sem format"
            error={errors.year_sem_format?.message}
            htmlFor="s-ysf"
            required
            hint="e.g. 1-1, 2-2"
          >
            <Input
              id="s-ysf"
              autoComplete="off"
              {...register("year_sem_format")}
            />
          </Field>
          <Field
            label="Roman format"
            error={errors.roman_format?.message}
            htmlFor="s-roman"
            required
            hint="e.g. I, II, VIII"
          >
            <Input id="s-roman" autoComplete="off" {...register("roman_format")} />
          </Field>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Active status is managed from the row actions on the list page.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || (props.mode === "edit" && !isDirty)}
        >
          {isSubmitting
            ? props.mode === "create"
              ? "Creating…"
              : "Saving…"
            : props.mode === "create"
              ? "Create semester"
              : "Save changes"}
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
