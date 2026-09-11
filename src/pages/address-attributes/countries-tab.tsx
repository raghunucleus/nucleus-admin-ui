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
  Filter,
  Globe,
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
  activateCountry,
  createCountry,
  deactivateCountry,
  listCountries,
  updateCountry,
  type CountriesSortField,
  type Country,
  type ListCountriesParams,
  type SortOrder,
  type StatusFilter,
} from "@/lib/address-attributes"
import {
  Field,
  Pagination,
  StatusBadge,
  ToolbarIconToggle,
  formatDateTime,
} from "./shared"

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; country: Country }

export function CountriesTab() {
  const [countries, setCountries] = React.useState<Country[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<Country | null>(null)

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

  type ColumnSearchState = { name: string; iso2: string }
  const emptyColumnSearch: ColumnSearchState = { name: "", iso2: "" }
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
      name: columnSearch.name.trim(),
      iso2: columnSearch.iso2.trim(),
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
    columnSearch.name.trim() !== appliedColumnSearch.name ||
    columnSearch.iso2.trim() !== appliedColumnSearch.iso2
  const columnSearchHasInput = !!columnSearch.name || !!columnSearch.iso2

  const activeFilterCount =
    (status ? 1 : 0) +
    (appliedColumnSearch.name ? 1 : 0) +
    (appliedColumnSearch.iso2 ? 1 : 0)

  const queryParams = React.useMemo<ListCountriesParams>(() => {
    const head = sorting[0]
    const sortBy: CountriesSortField =
      (head?.id as CountriesSortField | undefined) ?? "name"
    const sortOrder: SortOrder = head ? (head.desc ? "desc" : "asc") : "asc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      nameSearch: appliedColumnSearch.name || undefined,
      iso2Search: appliedColumnSearch.iso2 || undefined,
      status,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    appliedColumnSearch.name,
    appliedColumnSearch.iso2,
    status,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listCountries(queryParams)
      if (!isLatest()) return
      setCountries(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load countries", {
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

  const handleToggleActive = async (country: Country) => {
    setBusyId(country.id)
    try {
      const updated = country.is_active
        ? await deactivateCountry(country.id)
        : await activateCountry(country.id)
      toast.success(
        `${updated.name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update country status", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: Country, kind: "create" | "edit") => {
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
          Countries available for addresses. India ships seeded from official
          data; add others as needed.
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New country
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
            <CountryForm
              mode="create"
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(c) => handleSaved(c, "create")}
            />
          )}
          {mode.kind === "edit" && (
            <CountryForm
              mode="edit"
              country={mode.country}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(c) => handleSaved(c, "edit")}
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
          <CountriesTable
            countries={countries}
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
              !appliedColumnSearch.iso2
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(c) => setMode({ kind: "edit", country: c })}
            onToggleActive={(c) => setConfirmTarget(c)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={
          confirmTarget?.is_active ? "Deactivate country?" : "Activate country?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Its states and districts keep their own status, but none of them will be selectable while the country is inactive."
                : "Reactivated countries become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.name}
                {confirmTarget.iso2 ? (
                  <span className="text-muted-foreground"> ({confirmTarget.iso2})</span>
                ) : null}
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
  pendingStatus,
  onPendingStatusChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: StatusFilter | undefined
  onPendingStatusChange: (v: StatusFilter | undefined) => void
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
          <Label htmlFor="country-filter-status">Status</Label>
          <select
            id="country-filter-status"
            value={pendingStatus ?? ""}
            onChange={(e) =>
              onPendingStatusChange(
                e.target.value === "" ? undefined : (e.target.value as StatusFilter),
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

type ColumnSearchValues = { name: string; iso2: string }

function CountriesTable({
  countries,
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
  countries: Country[]
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
  onEdit: (c: Country) => void
  onToggleActive: (c: Country) => void
}) {
  const columns = React.useMemo<ColumnDef<Country>[]>(
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
        id: "iso2",
        header: "ISO-2",
        accessorKey: "iso2",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs text-muted-foreground">{v}</span>
        },
      },
      {
        id: "iso3",
        header: "ISO-3",
        accessorKey: "iso3",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs text-muted-foreground">{v}</span>
        },
      },
      {
        id: "dial_code",
        header: "Dial code",
        accessorKey: "dial_code",
        enableSorting: false,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs text-muted-foreground">{v}</span>
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (c) => (c.is_active ? "active" : "inactive"),
        cell: ({ row }) => <StatusBadge active={row.original.is_active} />,
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
          const c = row.original
          const isBusy = busyId === c.id
          const toggleLabel = c.is_active ? "Deactivate" : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(c)}
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
                  c.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(c)}
                disabled={isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {c.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: countries,
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
                  iso2: "iso2",
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
                    iso2: "w-10",
                    iso3: "w-12",
                    dial_code: "w-12",
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
                    title="Couldn't load countries"
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
                    description="No countries match the current filters."
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
                    icon={Globe}
                    title="No countries yet"
                    description="Create a country to start building the address tree."
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

const countrySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(128, "Too long"),
  // Optional fields are plain strings in the form; "" normalises to null on
  // submit. Each check passes on "" — a blank optional box is not an error.
  iso2: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^[A-Za-z]{2}$/.test(v.trim()),
      "Must be exactly 2 letters, e.g. IN",
    ),
  iso3: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^[A-Za-z]{3}$/.test(v.trim()),
      "Must be exactly 3 letters, e.g. IND",
    ),
  dial_code: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^\+[0-9]{1,6}$/.test(v.trim()),
      "Must start with + followed by digits, e.g. +91",
    ),
})

type CountryFormValues = z.infer<typeof countrySchema>

function CountryForm(
  props:
    | { mode: "create"; onCancel: () => void; onSaved: (c: Country) => void }
    | {
        mode: "edit"
        country: Country
        onCancel: () => void
        onSaved: (c: Country) => void
      },
) {
  const defaults: CountryFormValues =
    props.mode === "edit"
      ? {
          name: props.country.name,
          iso2: props.country.iso2 ?? "",
          iso3: props.country.iso3 ?? "",
          dial_code: props.country.dial_code ?? "",
        }
      : { name: "", iso2: "", iso3: "", dial_code: "" }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CountryFormValues>({
    resolver: zodResolver(countrySchema),
    defaultValues: defaults,
    values: defaults,
  })

  const onSubmit = handleSubmit(async (values) => {
    const nullIfBlank = (v: string) => (v.trim() === "" ? null : v.trim())
    const payload = {
      name: values.name,
      iso2: nullIfBlank(values.iso2.toUpperCase()),
      iso3: nullIfBlank(values.iso3.toUpperCase()),
      dial_code: nullIfBlank(values.dial_code),
    }
    try {
      if (props.mode === "create") {
        props.onSaved(await createCountry(payload))
      } else {
        props.onSaved(await updateCountry(props.country.id, payload))
      }
    } catch (err) {
      toast.error(
        props.mode === "create" ? "Couldn't create country" : "Couldn't update country",
        {
          description: err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    }
  })

  const upperOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase()
    if (upper !== e.target.value) e.target.value = upper
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {props.mode === "create" ? "Create country" : `Edit ${props.country.name}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a country to the address tree."
            : "Update the country details."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <Field label="Name" error={errors.name?.message} htmlFor="co-name" required>
          <Input id="co-name" autoComplete="off" {...register("name")} />
        </Field>

        <div className="grid gap-4 hd:grid-cols-2">
          <Field
            label="ISO alpha-2"
            error={errors.iso2?.message}
            htmlFor="co-iso2"
            hint="Optional. e.g. IN"
          >
            <Input
              id="co-iso2"
              autoComplete="off"
              className="uppercase"
              {...register("iso2", { onChange: upperOnChange })}
            />
          </Field>
          <Field
            label="ISO alpha-3"
            error={errors.iso3?.message}
            htmlFor="co-iso3"
            hint="Optional. e.g. IND"
          >
            <Input
              id="co-iso3"
              autoComplete="off"
              className="uppercase"
              {...register("iso3", { onChange: upperOnChange })}
            />
          </Field>
        </div>

        <Field
          label="Dial code"
          error={errors.dial_code?.message}
          htmlFor="co-dial"
          hint="Optional. e.g. +91. Not unique — several countries share one."
        >
          <Input
            id="co-dial"
            autoComplete="off"
            {...register("dial_code")}
          />
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
              ? "Create country"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}
