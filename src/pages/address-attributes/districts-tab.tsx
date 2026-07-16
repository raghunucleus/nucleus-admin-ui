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
  MapPin,
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
  activateDistrict,
  createDistrict,
  deactivateDistrict,
  listCountries,
  listDistricts,
  listStates,
  updateDistrict,
  type Country,
  type District,
  type DistrictsSortField,
  type ListDistrictsParams,
  type SortOrder,
  type State,
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

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; district: District }

// Districts under one state max out at 75 (Uttar Pradesh), and countries at 36
// states for India, so a single 100-row page covers every real picker. A country
// with more than 100 states would silently truncate here; the fix would be a
// dedicated unpaginated options endpoint, not a bigger number.
const PICKER_PAGE_SIZE = 100

export function DistrictsTab() {
  const [districts, setDistricts] = React.useState<District[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<District | null>(null)

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
  const [pendingStateId, setPendingStateId] = React.useState<number | null>(null)
  const [stateId, setStateId] = React.useState<number | null>(null)

  type ColumnSearchState = { name: string; lgd_code: string }
  const emptyColumnSearch: ColumnSearchState = { name: "", lgd_code: "" }
  const [columnSearch, setColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const [appliedColumnSearch, setAppliedColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    listCountries({ pageSize: PICKER_PAGE_SIZE, sortBy: "name", sortOrder: "asc" })
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
      setPendingStateId(stateId)
    }
  }, [filterPanelOpen, status, countryId, stateId])

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
    setStateId(pendingStateId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setStatus(undefined)
    setPendingCountryId(null)
    setCountryId(null)
    setPendingStateId(null)
    setStateId(null)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty =
    pendingStatus !== status ||
    pendingCountryId !== countryId ||
    pendingStateId !== stateId
  const columnSearchDirty =
    columnSearch.name.trim() !== appliedColumnSearch.name ||
    columnSearch.lgd_code.trim() !== appliedColumnSearch.lgd_code
  const columnSearchHasInput = !!columnSearch.name || !!columnSearch.lgd_code

  const activeFilterCount =
    (status ? 1 : 0) +
    (countryId !== null ? 1 : 0) +
    (stateId !== null ? 1 : 0) +
    (appliedColumnSearch.name ? 1 : 0) +
    (appliedColumnSearch.lgd_code ? 1 : 0)

  const queryParams = React.useMemo<ListDistrictsParams>(() => {
    const head = sorting[0]
    const sortBy: DistrictsSortField =
      (head?.id as DistrictsSortField | undefined) ?? "name"
    const sortOrder: SortOrder = head ? (head.desc ? "desc" : "asc") : "asc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      countryId: countryId ?? undefined,
      stateId: stateId ?? undefined,
      nameSearch: appliedColumnSearch.name || undefined,
      lgdCodeSearch: appliedColumnSearch.lgd_code || undefined,
      // The row's own flag. The chain filter (effectiveActive) is deliberately
      // NOT used here: a management screen must still show districts whose
      // state or country is switched off, or they'd be unreachable.
      status,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    countryId,
    stateId,
    appliedColumnSearch.name,
    appliedColumnSearch.lgd_code,
    status,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listDistricts(queryParams)
      if (!isLatest()) return
      setDistricts(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load districts", {
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

  const handleToggleActive = async (district: District) => {
    setBusyId(district.id)
    try {
      const updated = district.is_active
        ? await deactivateDistrict(district.id)
        : await activateDistrict(district.id)
      toast.success(
        `${updated.name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update district status", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: District, kind: "create" | "edit") => {
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
          Districts, each belonging to a state. Filter by country and state to
          narrow the list.
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New district
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
            <DistrictForm
              mode="create"
              countries={countries}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(d) => handleSaved(d, "create")}
            />
          )}
          {mode.kind === "edit" && (
            <DistrictForm
              mode="edit"
              district={mode.district}
              countries={countries}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(d) => handleSaved(d, "edit")}
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
            pendingStateId={pendingStateId}
            onPendingStateChange={setPendingStateId}
            pendingStatus={pendingStatus}
            onPendingStatusChange={setPendingStatus}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status &&
              !pendingStatus &&
              countryId === null &&
              pendingCountryId === null &&
              stateId === null &&
              pendingStateId === null
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <DistrictsTable
            districts={districts}
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
              !appliedColumnSearch.lgd_code
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(d) => setMode({ kind: "edit", district: d })}
            onToggleActive={(d) => setConfirmTarget(d)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={
          confirmTarget?.is_active ? "Deactivate district?" : "Activate district?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated districts won't be selectable in dependent records."
                : "Reactivated districts become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.name}{" "}
                <span className="text-muted-foreground">
                  ({confirmTarget.state.name})
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

// Country -> State cascade, shared by the filter panel and the form.
// Returns every state of `countryId` (no status filter): the filter must be able
// to reach states of a deactivated country, and the form merges the current
// parent back in separately.
function useStatesOfCountry(countryId: number | null) {
  const [states, setStates] = React.useState<State[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (countryId === null) {
      setStates([])
      return
    }
    let cancelled = false
    setLoading(true)
    listStates({
      countryId,
      pageSize: PICKER_PAGE_SIZE,
      sortBy: "name",
      sortOrder: "asc",
    })
      .then((r) => {
        if (!cancelled) setStates(r.rows)
      })
      .catch((err) => {
        if (cancelled) return
        setStates([])
        toast.error("Couldn't load states", {
          description: err instanceof ApiError ? err.message : "Please try again.",
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [countryId])

  return { states, loading }
}

function FilterPanel({
  countries,
  pendingCountryId,
  onPendingCountryChange,
  pendingStateId,
  onPendingStateChange,
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
  pendingStateId: number | null
  onPendingStateChange: (v: number | null) => void
  pendingStatus: StatusFilter | undefined
  onPendingStatusChange: (v: StatusFilter | undefined) => void
  onApply: () => void
  onReset: () => void
  onClose: () => void
  applyDisabled: boolean
  resetDisabled: boolean
}) {
  const { states, loading: statesLoading } = useStatesOfCountry(pendingCountryId)

  const countryOptions = React.useMemo<ComboboxOption[]>(
    () =>
      countries.map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: c.is_active ? (c.iso2 ?? undefined) : "inactive",
      })),
    [countries],
  )

  const stateOptions = React.useMemo<ComboboxOption[]>(
    () =>
      states.map((s) => ({
        value: s.id,
        label: s.name,
        sublabel: s.is_active ? (s.iso_code ?? undefined) : "inactive",
      })),
    [states],
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
          <Label htmlFor="district-filter-country">Country</Label>
          <Combobox
            id="district-filter-country"
            value={pendingCountryId}
            options={countryOptions}
            onChange={(v) => {
              onPendingCountryChange(v)
              // Clear the state alongside the country, in the same handler
              // rather than a useEffect. A stale state id from the previous
              // country would filter on a state that isn't in the selected one
              // and silently return zero rows.
              onPendingStateChange(null)
            }}
            placeholder="All countries"
            clearLabel="All countries"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district-filter-state">State</Label>
          <Combobox
            id="district-filter-state"
            value={pendingStateId}
            options={stateOptions}
            onChange={onPendingStateChange}
            disabled={pendingCountryId === null || statesLoading}
            placeholder={
              pendingCountryId === null
                ? "Select a country first"
                : statesLoading
                  ? "Loading…"
                  : "All states"
            }
            clearLabel="All states"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district-filter-status">Status</Label>
          <select
            id="district-filter-status"
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

type ColumnSearchValues = { name: string; lgd_code: string }

function DistrictsTable({
  districts,
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
  districts: District[]
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
  onEdit: (d: District) => void
  onToggleActive: (d: District) => void
}) {
  const columns = React.useMemo<ColumnDef<District>[]>(
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
        id: "state",
        header: "State",
        accessorFn: (d) => d.state.name,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.state.name}
          </span>
        ),
      },
      {
        id: "country",
        header: "Country",
        accessorFn: (d) => d.state.country.name,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.state.country.name}
          </span>
        ),
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
        accessorFn: (d) => (d.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const d = row.original
          // is_active is independent per level, so an active district can sit
          // under a deactivated state or country. Show why it won't be
          // selectable downstream rather than hiding the row.
          const via = !d.state.country.is_active
            ? "country"
            : !d.state.is_active
              ? "state"
              : null
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge active={d.is_active} />
              {d.is_active && via && <InheritedInactiveBadge via={via} />}
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
          const d = row.original
          const isBusy = busyId === d.id
          const toggleLabel = d.is_active ? "Deactivate" : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(d)}
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
                  d.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(d)}
                disabled={isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {d.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: districts,
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
                    state: "w-28",
                    country: "w-20",
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
                    title="Couldn't load districts"
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
                    description="No districts match the current filters."
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
                    icon={MapPin}
                    title="No districts yet"
                    description="Create a district under a state to get started."
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

const districtSchema = z.object({
  state_id: z.number({ error: "State is required" }).int().positive("State is required"),
  name: z.string().trim().min(1, "Name is required").max(128, "Too long"),
  lgd_code: z
    .string()
    .refine((v) => v.trim() === "" || /^[0-9]{1,16}$/.test(v.trim()), "Digits only"),
})

type DistrictFormValues = z.infer<typeof districtSchema>

function DistrictForm(
  props:
    | {
        mode: "create"
        countries: Country[]
        onCancel: () => void
        onSaved: (d: District) => void
      }
    | {
        mode: "edit"
        district: District
        countries: Country[]
        onCancel: () => void
        onSaved: (d: District) => void
      },
) {
  const defaults: DistrictFormValues =
    props.mode === "edit"
      ? {
          state_id: props.district.state_id,
          name: props.district.name,
          lgd_code: props.district.lgd_code ?? "",
        }
      : { state_id: 0, name: "", lgd_code: "" }

  // Country is a UI control only — it narrows the state list and is not part of
  // the payload (a district's country is implied by its state). On edit it is
  // prefilled from the eager-loaded state.country chain.
  const [countryId, setCountryId] = React.useState<number | null>(
    props.mode === "edit" ? props.district.state.country_id : null,
  )
  const { states, loading: statesLoading } = useStatesOfCountry(countryId)

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DistrictFormValues>({
    resolver: zodResolver(districtSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const countryOptions = React.useMemo<ComboboxOption[]>(() => {
    const pool = props.countries.filter((c) => c.is_active)
    if (
      props.mode === "edit" &&
      !pool.some((c) => c.id === props.district.state.country_id)
    ) {
      pool.push(props.district.state.country)
    }
    return pool
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: c.is_active ? (c.iso2 ?? undefined) : "inactive",
      }))
  }, [props])

  // Active states only for a new district, plus the current parent on edit —
  // otherwise a district under a deactivated state would show a blank picker
  // and a careless save would re-parent it or fail validation.
  const stateOptions = React.useMemo<ComboboxOption[]>(() => {
    const pool = states.filter((s) => s.is_active)
    if (
      props.mode === "edit" &&
      props.district.state.country_id === countryId &&
      !pool.some((s) => s.id === props.district.state_id)
    ) {
      pool.push(props.district.state)
    }
    return pool
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        value: s.id,
        label: s.name,
        sublabel: s.is_active ? (s.iso_code ?? undefined) : "inactive",
      }))
  }, [states, props, countryId])

  const onSubmit = handleSubmit(async (values) => {
    const nullIfBlank = (v: string) => (v.trim() === "" ? null : v.trim())
    const payload = {
      state_id: values.state_id,
      name: values.name,
      lgd_code: nullIfBlank(values.lgd_code),
    }
    try {
      if (props.mode === "create") {
        props.onSaved(await createDistrict(payload))
      } else {
        props.onSaved(await updateDistrict(props.district.id, payload))
      }
    } catch (err) {
      toast.error(
        props.mode === "create"
          ? "Couldn't create district"
          : "Couldn't update district",
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
          {props.mode === "create" ? "Create district" : `Edit ${props.district.name}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a district under a state."
            : "Update the district details, or move it to another state."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <Field label="Country" htmlFor="di-country" required hint="Narrows the state list.">
          <Combobox
            id="di-country"
            value={countryId}
            options={countryOptions}
            onChange={(v) => {
              setCountryId(v)
              // Clear the chosen state in the same handler as the country —
              // a stale state from the previous country would submit a district
              // into the wrong country.
              setValue("state_id", 0, { shouldDirty: true, shouldValidate: false })
            }}
            placeholder="Select a country"
          />
        </Field>

        <Field label="State" error={errors.state_id?.message} htmlFor="di-state" required>
          <Controller
            control={control}
            name="state_id"
            render={({ field }) => (
              <Combobox
                id="di-state"
                value={field.value || null}
                options={stateOptions}
                onChange={(v) => field.onChange(v ?? 0)}
                disabled={countryId === null || statesLoading}
                placeholder={
                  countryId === null
                    ? "Select a country first"
                    : statesLoading
                      ? "Loading…"
                      : "Select a state"
                }
                invalid={!!errors.state_id}
              />
            )}
          />
        </Field>

        <Field label="Name" error={errors.name?.message} htmlFor="di-name" required>
          <Input id="di-name" autoComplete="off" {...register("name")} />
        </Field>

        <Field
          label="LGD code"
          error={errors.lgd_code?.message}
          htmlFor="di-lgd"
          hint="Optional. Local Government Directory district code."
        >
          <Input id="di-lgd" autoComplete="off" inputMode="numeric" {...register("lgd_code")} />
        </Field>

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
              ? "Create district"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}
