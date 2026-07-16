import * as React from "react"
import { useForm, Controller } from "react-hook-form"
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
  Filter,
  Map as MapIcon,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SearchX,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
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
  activateState,
  createState,
  deactivateState,
  listCountries,
  listStates,
  updateState,
  type Country,
  type ListStatesParams,
  type SortOrder,
  type State,
  type StatesSortField,
  type StatusFilter,
} from "@/lib/address-attributes"
import {
  Field,
  InheritedInactiveBadge,
  Pagination,
  StatusBadge,
  ToolbarIconToggle,
  formatDateTime,
} from "./shared"

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; state: State }

export function StatesTab() {
  const [states, setStates] = React.useState<State[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<State | null>(null)

  // Loaded once for the filter and the form's parent picker. The filter lists
  // every country (an admin must be able to find states of a deactivated
  // country); the form lists only active ones — see StateForm.
  const [countries, setCountries] = React.useState<Country[]>([])

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [searchRowOpen, setSearchRowOpen] = React.useState(false)

  const [pendingStatus, setPendingStatus] = React.useState<StatusFilter | undefined>(
    undefined,
  )
  const [status, setStatus] = React.useState<StatusFilter | undefined>(undefined)
  const [pendingCountryId, setPendingCountryId] = React.useState<number | null>(null)
  const [countryId, setCountryId] = React.useState<number | null>(null)

  type ColumnSearchState = { name: string; lgd_code: string; iso_code: string }
  const emptyColumnSearch: ColumnSearchState = { name: "", lgd_code: "", iso_code: "" }
  const [columnSearch, setColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const [appliedColumnSearch, setAppliedColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    listCountries({ pageSize: 100, sortBy: "name", sortOrder: "asc" })
      .then((r) => {
        if (!cancelled) setCountries(r.rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error("Couldn't load countries", {
          description: err instanceof ApiError ? err.message : "Please try again.",
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (filterPanelOpen) {
      setPendingStatus(status)
      setPendingCountryId(countryId)
    }
  }, [filterPanelOpen, status, countryId])

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
      lgd_code: columnSearch.lgd_code.trim(),
      iso_code: columnSearch.iso_code.trim(),
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
    setCountryId(pendingCountryId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setStatus(undefined)
    setPendingCountryId(null)
    setCountryId(null)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty =
    pendingStatus !== status || pendingCountryId !== countryId
  const columnSearchDirty =
    columnSearch.name.trim() !== appliedColumnSearch.name ||
    columnSearch.lgd_code.trim() !== appliedColumnSearch.lgd_code ||
    columnSearch.iso_code.trim() !== appliedColumnSearch.iso_code
  const columnSearchHasInput =
    !!columnSearch.name || !!columnSearch.lgd_code || !!columnSearch.iso_code

  const activeFilterCount =
    (status ? 1 : 0) +
    (countryId !== null ? 1 : 0) +
    (appliedColumnSearch.name ? 1 : 0) +
    (appliedColumnSearch.lgd_code ? 1 : 0) +
    (appliedColumnSearch.iso_code ? 1 : 0)

  const queryParams = React.useMemo<ListStatesParams>(() => {
    const head = sorting[0]
    const sortBy: StatesSortField = (head?.id as StatesSortField | undefined) ?? "name"
    const sortOrder: SortOrder = head ? (head.desc ? "desc" : "asc") : "asc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      countryId: countryId ?? undefined,
      nameSearch: appliedColumnSearch.name || undefined,
      lgdCodeSearch: appliedColumnSearch.lgd_code || undefined,
      isoCodeSearch: appliedColumnSearch.iso_code || undefined,
      // The row's own flag. The chain filter (effectiveActive) is deliberately
      // NOT used here: a management screen must still show states whose country
      // is switched off, or they'd be unreachable.
      status,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    countryId,
    appliedColumnSearch.name,
    appliedColumnSearch.lgd_code,
    appliedColumnSearch.iso_code,
    status,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listStates(queryParams)
      if (!isLatest()) return
      setStates(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load states", {
        description: err instanceof ApiError ? err.message : "Please try again.",
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

  const handleToggleActive = async (state: State) => {
    setBusyId(state.id)
    try {
      const updated = state.is_active
        ? await deactivateState(state.id)
        : await activateState(state.id)
      toast.success(
        `${updated.name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update state status", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: State, kind: "create" | "edit") => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create" ? `${updated.name} created.` : `${updated.name} updated.`,
    )
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <p className="text-sm text-muted-foreground">
          States and union territories, each belonging to a country.
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New state
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
            <StateForm
              mode="create"
              countries={countries}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(s) => handleSaved(s, "create")}
            />
          )}
          {mode.kind === "edit" && (
            <StateForm
              mode="edit"
              state={mode.state}
              countries={countries}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(s) => handleSaved(s, "edit")}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            countries={countries}
            pendingCountryId={pendingCountryId}
            onPendingCountryChange={setPendingCountryId}
            pendingStatus={pendingStatus}
            onPendingStatusChange={setPendingStatus}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status && !pendingStatus && countryId === null && pendingCountryId === null
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <StatesTable
            states={states}
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
              !appliedColumnSearch.name &&
              !appliedColumnSearch.lgd_code &&
              !appliedColumnSearch.iso_code
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(s) => setMode({ kind: "edit", state: s })}
            onToggleActive={(s) => setConfirmTarget(s)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={confirmTarget?.is_active ? "Deactivate state?" : "Activate state?"}
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Its districts keep their own status and stay editable here, but none of them will be selectable while the state is inactive."
                : "Reactivated states become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.name}{" "}
                <span className="text-muted-foreground">
                  ({confirmTarget.country.name})
                </span>
              </div>
            </>
          ) : undefined
        }
        confirmLabel={confirmTarget?.is_active ? "Deactivate" : "Activate"}
        tone={confirmTarget?.is_active ? "destructive" : "success"}
        loading={busyId === confirmTarget?.id}
        onConfirm={async () => {
          if (!confirmTarget) return
          await handleToggleActive(confirmTarget)
          setConfirmTarget(null)
        }}
      />
    </div>
  )
}

function FilterPanel({
  countries,
  pendingCountryId,
  onPendingCountryChange,
  pendingStatus,
  onPendingStatusChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  countries: Country[]
  pendingCountryId: number | null
  onPendingCountryChange: (v: number | null) => void
  pendingStatus: StatusFilter | undefined
  onPendingStatusChange: (v: StatusFilter | undefined) => void
  onApply: () => void
  onReset: () => void
  onClose: () => void
  applyDisabled: boolean
  resetDisabled: boolean
}) {
  // Every country, not just active ones — an admin must be able to find the
  // states of a country they just deactivated.
  const options = React.useMemo<ComboboxOption[]>(
    () =>
      countries.map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: c.is_active ? (c.iso2 ?? undefined) : "inactive",
      })),
    [countries],
  )

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
          <Label htmlFor="state-filter-country">Country</Label>
          <Combobox
            id="state-filter-country"
            value={pendingCountryId}
            options={options}
            onChange={onPendingCountryChange}
            placeholder="All countries"
            clearLabel="All countries"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state-filter-status">Status</Label>
          <select
            id="state-filter-status"
            value={pendingStatus ?? ""}
            onChange={(e) =>
              onPendingStatusChange(
                e.target.value === "" ? undefined : (e.target.value as StatusFilter),
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button variant="outline" size="sm" onClick={onReset} disabled={resetDisabled}>
          Reset
        </Button>
        <Button size="sm" onClick={onApply} disabled={applyDisabled}>
          Apply
        </Button>
      </div>
    </aside>
  )
}

type ColumnSearchValues = { name: string; lgd_code: string; iso_code: string }

function StatesTable({
  states,
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
  states: State[]
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
  onEdit: (s: State) => void
  onToggleActive: (s: State) => void
}) {
  const columns = React.useMemo<ColumnDef<State>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ getValue }) => (
          <div className="font-medium">{String(getValue() ?? "")}</div>
        ),
      },
      {
        id: "country",
        header: "Country",
        accessorFn: (s) => s.country.name,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.country.name}
          </span>
        ),
      },
      {
        id: "iso_code",
        header: "ISO code",
        accessorKey: "iso_code",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs text-muted-foreground">{v}</span>
        },
      },
      {
        id: "lgd_code",
        header: "LGD code",
        accessorKey: "lgd_code",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs text-muted-foreground">{v}</span>
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (s) => (s.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const s = row.original
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge active={s.is_active} />
              {/* is_active is independent per level, so a state can be active
                  under a deactivated country. Surface that instead of hiding it. */}
              {s.is_active && !s.country.is_active && (
                <InheritedInactiveBadge via="country" />
              )}
            </div>
          )
        },
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
    data: states,
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
                  lgd_code: "lgd_code",
                  iso_code: "iso_code",
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
                    name: "w-40",
                    country: "w-24",
                    iso_code: "w-14",
                    lgd_code: "w-10",
                    status: "w-16",
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
                    title="Couldn't load states"
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
                    description="No states match the current filters."
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
                    icon={MapIcon}
                    title="No states yet"
                    description="Create a state under a country to get started."
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
              className="h-8 rounded-md border border-input bg-background px-2 pr-7 text-xs font-medium shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            <span className="font-medium text-foreground tabular-nums">{total}</span>
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

const stateSchema = z.object({
  country_id: z
    .number({ error: "Country is required" })
    .int()
    .positive("Country is required"),
  name: z.string().trim().min(1, "Name is required").max(128, "Too long"),
  lgd_code: z
    .string()
    .refine((v) => v.trim() === "" || /^[0-9]{1,16}$/.test(v.trim()), "Digits only"),
  iso_code: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^[A-Za-z]{2}-[A-Za-z0-9]{1,4}$/.test(v.trim()),
      "Must look like IN-AP",
    ),
})

type StateFormValues = z.infer<typeof stateSchema>

function StateForm(
  props:
    | {
        mode: "create"
        countries: Country[]
        onCancel: () => void
        onSaved: (s: State) => void
      }
    | {
        mode: "edit"
        state: State
        countries: Country[]
        onCancel: () => void
        onSaved: (s: State) => void
      },
) {
  const defaults: StateFormValues =
    props.mode === "edit"
      ? {
          country_id: props.state.country_id,
          name: props.state.name,
          lgd_code: props.state.lgd_code ?? "",
          iso_code: props.state.iso_code ?? "",
        }
      : { country_id: 0, name: "", lgd_code: "", iso_code: "" }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StateFormValues>({
    resolver: zodResolver(stateSchema),
    defaultValues: defaults,
    values: defaults,
  })

  // Only active countries are offered for a NEW state. On edit, the current
  // parent is merged in even if it's inactive — otherwise the combobox would
  // render blank for a state under a deactivated country and a careless save
  // would silently re-parent or fail validation.
  const countryOptions = React.useMemo<ComboboxOption[]>(() => {
    const pool = props.countries.filter((c) => c.is_active)
    if (props.mode === "edit" && !pool.some((c) => c.id === props.state.country_id)) {
      pool.push(props.state.country)
    }
    return pool
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: c.is_active ? (c.iso2 ?? undefined) : "inactive",
      }))
  }, [props])

  const onSubmit = handleSubmit(async (values) => {
    const nullIfBlank = (v: string) => (v.trim() === "" ? null : v.trim())
    const payload = {
      country_id: values.country_id,
      name: values.name,
      lgd_code: nullIfBlank(values.lgd_code),
      iso_code: nullIfBlank(values.iso_code.toUpperCase()),
    }
    try {
      if (props.mode === "create") {
        props.onSaved(await createState(payload))
      } else {
        props.onSaved(await updateState(props.state.id, payload))
      }
    } catch (err) {
      toast.error(
        props.mode === "create" ? "Couldn't create state" : "Couldn't update state",
        {
          description: err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {props.mode === "create" ? "Create state" : `Edit ${props.state.name}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a state or union territory under a country."
            : "Update the state details, or move it to another country."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <Field
          label="Country"
          error={errors.country_id?.message}
          htmlFor="st-country"
          required
        >
          <Controller
            control={control}
            name="country_id"
            render={({ field }) => (
              <Combobox
                id="st-country"
                value={field.value || null}
                options={countryOptions}
                onChange={(v) => field.onChange(v ?? 0)}
                placeholder="Select a country"
                invalid={!!errors.country_id}
              />
            )}
          />
        </Field>

        <Field label="Name" error={errors.name?.message} htmlFor="st-name" required>
          <Input id="st-name" autoComplete="off" {...register("name")} />
        </Field>

        <div className="grid gap-4 hd:grid-cols-2">
          <Field
            label="ISO code"
            error={errors.iso_code?.message}
            htmlFor="st-iso"
            hint="Optional. ISO 3166-2, e.g. IN-AP."
          >
            <Input
              id="st-iso"
              autoComplete="off"
              className="uppercase"
              placeholder="IN-AP"
              {...register("iso_code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const upper = e.target.value.toUpperCase()
                  if (upper !== e.target.value) e.target.value = upper
                },
              })}
            />
          </Field>
          <Field
            label="LGD code"
            error={errors.lgd_code?.message}
            htmlFor="st-lgd"
            hint="Optional. Local Government Directory state code."
          >
            <Input id="st-lgd" autoComplete="off" inputMode="numeric" {...register("lgd_code")} />
          </Field>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Active status is managed from the row actions on the list page.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={props.onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || (props.mode === "edit" && !isDirty)}>
          {isSubmitting
            ? props.mode === "create"
              ? "Creating…"
              : "Saving…"
            : props.mode === "create"
              ? "Create state"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}
