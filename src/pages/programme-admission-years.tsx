import * as React from "react"
import { Controller, useForm } from "react-hook-form"
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
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ScrollText,
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
import { listAdmissionYears, type AdmissionYear } from "@/lib/admission-years"
import {
  activateProgrammeAdmissionYear,
  createProgrammeAdmissionYear,
  deactivateProgrammeAdmissionYear,
  listProgrammeAdmissionYears,
  updateProgrammeAdmissionYear,
  type ListProgrammeAdmissionYearsParams,
  type ProgrammeAdmissionYear,
  type ProgrammeAdmissionYearStatusFilter,
  type ProgrammeAdmissionYearsSortField,
  type ProgrammeAdmissionYearsSortOrder,
} from "@/lib/programme-admission-years"
import { listProgrammes, type Programme } from "@/lib/programmes"
import { listRegulations, type Regulation } from "@/lib/regulations"

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
  | { kind: "edit"; link: ProgrammeAdmissionYear }

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

// Sticky Actions column — same recipe as the other tables.
const STICKY_ACTIONS_HEAD = "sticky right-0 z-20"
const STICKY_ACTIONS_SHADOW = "shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.08)]"
const STICKY_ACTIONS_CELL = cn(
  "sticky right-0 z-[1] bg-card",
  "group-hover:bg-[color-mix(in_oklab,_var(--muted)_40%,_var(--card))]",
  STICKY_ACTIONS_SHADOW,
)
const STICKY_ACTIONS_SKELETON_CELL = cn(
  "sticky right-0 z-[1] bg-card",
  STICKY_ACTIONS_SHADOW,
)

export function ProgrammeAdmissionYearsPage() {
  const [rows, setRows] = React.useState<ProgrammeAdmissionYear[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] =
    React.useState<ProgrammeAdmissionYear | null>(null)

  // Active-only option lists for filters + create/edit form.
  const [programmeOptions, setProgrammeOptions] = React.useState<Programme[]>([])
  const [yearOptions, setYearOptions] = React.useState<AdmissionYear[]>([])
  const [regulationOptions, setRegulationOptions] = React.useState<Regulation[]>([])
  const [optionsLoading, setOptionsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      setOptionsLoading(true)
      try {
        const [p, y, r] = await Promise.all([
          listProgrammes({
            status: "active",
            pageSize: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
          listAdmissionYears({
            status: "active",
            pageSize: 100,
            sortBy: "year",
            sortOrder: "desc",
          }),
          listRegulations({
            status: "active",
            pageSize: 100,
            sortBy: "created_at",
            sortOrder: "desc",
          }),
        ])
        if (cancelled) return
        setProgrammeOptions(p.rows)
        setYearOptions(y.rows)
        setRegulationOptions(r.rows)
      } catch (err) {
        if (cancelled) return
        toast.error("Couldn't load option lists", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }
    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [])

  // Admission year is a mandatory primary axis. Initialized below.
  const [yearId, setYearId] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    if (yearId === undefined && yearOptions.length > 0) {
      setYearId(yearOptions[0].id)
    }
  }, [yearId, yearOptions])

  const selectedYear = yearOptions.find((y) => y.id === yearId)

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Open by default — programme + regulation filters are the primary way to
  // narrow this screen.
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(true)

  const [pendingStatus, setPendingStatus] = React.useState<
    ProgrammeAdmissionYearStatusFilter | undefined
  >(undefined)
  const [pendingProgrammeId, setPendingProgrammeId] = React.useState<
    number | undefined
  >(undefined)
  const [pendingRegulationId, setPendingRegulationId] = React.useState<
    number | undefined
  >(undefined)
  const [status, setStatus] = React.useState<
    ProgrammeAdmissionYearStatusFilter | undefined
  >(undefined)
  const [programmeId, setProgrammeId] = React.useState<number | undefined>(
    undefined,
  )
  const [regulationId, setRegulationId] = React.useState<number | undefined>(
    undefined,
  )

  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    if (filterPanelOpen) {
      setPendingStatus(status)
      setPendingProgrammeId(programmeId)
      setPendingRegulationId(regulationId)
    }
  }, [filterPanelOpen, status, programmeId, regulationId])

  const applyFilters = () => {
    setStatus(pendingStatus)
    setProgrammeId(pendingProgrammeId)
    setRegulationId(pendingRegulationId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setPendingProgrammeId(undefined)
    setPendingRegulationId(undefined)
    setStatus(undefined)
    setProgrammeId(undefined)
    setRegulationId(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty =
    pendingStatus !== status ||
    pendingProgrammeId !== programmeId ||
    pendingRegulationId !== regulationId

  const activeFilterCount =
    (status ? 1 : 0) +
    (programmeId !== undefined ? 1 : 0) +
    (regulationId !== undefined ? 1 : 0)

  const queryParams = React.useMemo<ListProgrammeAdmissionYearsParams>(() => {
    const head = sorting[0]
    const sortBy: ProgrammeAdmissionYearsSortField =
      (head?.id as ProgrammeAdmissionYearsSortField | undefined) ?? "created_at"
    const sortOrder: ProgrammeAdmissionYearsSortOrder = head
      ? head.desc
        ? "desc"
        : "asc"
      : "desc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      status,
      programmeId,
      admissionYearId: yearId,
      regulationId,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    status,
    programmeId,
    yearId,
    regulationId,
  ])

  const loadIdRef = React.useRef(0)
  const load = React.useCallback(async () => {
    if (yearId === undefined) return

    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listProgrammeAdmissionYears(queryParams)
      if (!isLatest()) return
      setRows(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load programme regulations", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      if (isLatest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [queryParams, yearId])

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

  const requestToggleActive = (row: ProgrammeAdmissionYear) => setConfirmTarget(row)

  const handleToggleActive = async (row: ProgrammeAdmissionYear) => {
    setBusyId(row.id)
    try {
      const updated = row.is_active
        ? await deactivateProgrammeAdmissionYear(row.id)
        : await activateProgrammeAdmissionYear(row.id)
      toast.success(
        `${updated.programme.code} • ${updated.regulation.code} ${
          updated.is_active ? "activated" : "deactivated"
        }.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (
    updated: ProgrammeAdmissionYear,
    kind: "create" | "edit",
  ) => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create"
        ? `Assigned ${updated.regulation.code} to ${updated.programme.code}.`
        : `Updated ${updated.programme.code} → ${updated.regulation.code}.`,
    )
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <h1 className="text-base font-semibold tracking-tight">
          Programme regulations
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="page-year" className="text-xs text-muted-foreground">
              Admission year
            </Label>
            <div className="w-48">
              <Combobox
                id="page-year"
                value={yearId ?? null}
                options={yearOptions.map((y) => ({
                  value: y.id,
                  label: y.display_year,
                  sublabel: String(y.year),
                }))}
                onChange={(v) => {
                  if (v == null) return
                  setYearId(v)
                  setPagination((p) => ({ ...p, pageIndex: 0 }))
                }}
                placeholder={optionsLoading ? "Loading…" : "Select a year"}
                searchPlaceholder="Search years…"
                emptyMessage="No years available"
                disabled={optionsLoading || yearOptions.length === 0}
              />
            </div>
          </div>
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={
              mode.kind !== "list" || optionsLoading || yearId === undefined
            }
            title={optionsLoading ? "Loading options…" : undefined}
          >
            <Plus />
            Assign regulation
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
        </div>
      </div>

      <Sheet
        open={mode.kind !== "list"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "list" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind === "create" && selectedYear && (
            <AssignRegulationForm
              mode="create"
              admissionYear={selectedYear}
              programmeOptions={programmeOptions}
              regulationOptions={regulationOptions}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(r) => handleSaved(r, "create")}
            />
          )}

          {mode.kind === "edit" && (
            <AssignRegulationForm
              mode="edit"
              link={mode.link}
              regulationOptions={regulationOptions}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(r) => handleSaved(r, "edit")}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            pendingStatus={pendingStatus}
            pendingProgrammeId={pendingProgrammeId}
            pendingRegulationId={pendingRegulationId}
            programmeOptions={programmeOptions}
            regulationOptions={regulationOptions}
            onPendingStatusChange={setPendingStatus}
            onPendingProgrammeChange={setPendingProgrammeId}
            onPendingRegulationChange={setPendingRegulationId}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status &&
              programmeId === undefined &&
              regulationId === undefined &&
              !pendingStatus &&
              pendingProgrammeId === undefined &&
              pendingRegulationId === undefined
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <ProgrammeAdmissionYearsTable
            rows={rows}
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
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(r) => setMode({ kind: "edit", link: r })}
            onToggleActive={requestToggleActive}
            yearLabel={selectedYear?.display_year}
            canCreate={yearId !== undefined}
            onCreate={() => setMode({ kind: "create" })}
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
            ? "Deactivate assignment?"
            : "Activate assignment?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated assignments won't be selectable in dependent records."
                : "Reactivated assignments become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.programme.code} →{" "}
                {confirmTarget.regulation.code}{" "}
                <span className="text-muted-foreground">
                  ({confirmTarget.admission_year.display_year})
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
  pendingProgrammeId,
  pendingRegulationId,
  programmeOptions,
  regulationOptions,
  onPendingStatusChange,
  onPendingProgrammeChange,
  onPendingRegulationChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: ProgrammeAdmissionYearStatusFilter | undefined
  pendingProgrammeId: number | undefined
  pendingRegulationId: number | undefined
  programmeOptions: Programme[]
  regulationOptions: Regulation[]
  onPendingStatusChange: (v: ProgrammeAdmissionYearStatusFilter | undefined) => void
  onPendingProgrammeChange: (v: number | undefined) => void
  onPendingRegulationChange: (v: number | undefined) => void
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
                  : (e.target.value as ProgrammeAdmissionYearStatusFilter),
              )
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-programme">Programme</Label>
          <Combobox
            id="filter-programme"
            value={pendingProgrammeId ?? null}
            options={programmeOptions.map((p) => ({
              value: p.id,
              label: p.code,
              sublabel: p.display_name,
            }))}
            onChange={(v) => onPendingProgrammeChange(v ?? undefined)}
            placeholder="All programmes"
            searchPlaceholder="Search programmes…"
            emptyMessage="No programmes match"
            clearLabel="All programmes"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-regulation">Regulation</Label>
          <Combobox
            id="filter-regulation"
            value={pendingRegulationId ?? null}
            options={regulationOptions.map((r) => ({
              value: r.id,
              label: r.code,
              sublabel: r.name,
            }))}
            onChange={(v) => onPendingRegulationChange(v ?? undefined)}
            placeholder="All regulations"
            searchPlaceholder="Search regulations…"
            emptyMessage="No regulations match"
            clearLabel="All regulations"
          />
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

function ProgrammeAdmissionYearsTable({
  rows,
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
  hasActiveFilters,
  onOpenFilters,
  onResetFilters,
  loadFailed,
  onRetry,
  onEdit,
  onToggleActive,
  yearLabel,
  canCreate,
  onCreate,
}: {
  rows: ProgrammeAdmissionYear[]
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
  hasActiveFilters: boolean
  onOpenFilters: () => void
  onResetFilters: () => void
  loadFailed: boolean
  onRetry: () => void
  onEdit: (r: ProgrammeAdmissionYear) => void
  onToggleActive: (r: ProgrammeAdmissionYear) => void
  yearLabel: string | undefined
  canCreate: boolean
  onCreate: () => void
}) {
  const columns = React.useMemo<ColumnDef<ProgrammeAdmissionYear>[]>(
    () => [
      {
        id: "programme",
        header: "Programme",
        accessorFn: (r) => r.programme?.code ?? "",
        cell: ({ row }) => {
          const p = row.original.programme
          if (!p) return <span className="text-muted-foreground">—</span>
          return (
            <div className="min-w-0">
              <div className="font-medium" title={p.name}>
                {p.code}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {p.display_name}
              </div>
            </div>
          )
        },
      },
      {
        id: "regulation",
        header: "Regulation",
        accessorFn: (r) => r.regulation?.code ?? "",
        cell: ({ row }) => {
          const r = row.original.regulation
          if (!r) return <span className="text-muted-foreground">—</span>
          return (
            <div className="min-w-0">
              <div className="font-medium" title={r.name}>
                {r.code}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.name}
              </div>
            </div>
          )
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const r = row.original
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                r.is_active
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  r.is_active ? "bg-success" : "bg-destructive",
                )}
              />
              {r.is_active ? "Active" : "Inactive"}
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
          const r = row.original
          const isBusy = busyId === r.id
          const toggleLabel = r.is_active ? "Deactivate" : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(r)}
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
                  r.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(r)}
                disabled={isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {r.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: rows,
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
                      header.column.id === "actions" && STICKY_ACTIONS_HEAD,
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
        </TableHeader>
        <TableBody>
          {loading || refreshing ? (
            Array.from({ length: pageSize }).map((_, rowIdx) => (
              <TableRow key={`s-${rowIdx}`} className="hover:bg-transparent">
                {table.getAllLeafColumns().map((column) => {
                  const id = column.id
                  const widths: Record<string, string> = {
                    programme: "w-48",
                    regulation: "w-32",
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
                        id === "actions" && STICKY_ACTIONS_SKELETON_CELL,
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
                    title="Couldn't load programme regulations"
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
                    description="No assignments match the current filters."
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
                    icon={ScrollText}
                    title={
                      yearLabel
                        ? `No regulations assigned for ${yearLabel}`
                        : "No programme regulations yet"
                    }
                    description="Assign a regulation to a programme for this admission year."
                    action={
                      <Button size="sm" onClick={onCreate} disabled={!canCreate}>
                        <Plus />
                        Assign regulation
                      </Button>
                    }
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="group">
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        cell.column.id === "actions" && STICKY_ACTIONS_CELL,
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

const assignmentSchema = z.object({
  programme_id: z
    .number({ message: "Select a programme" })
    .int()
    .positive("Select a programme"),
  regulation_id: z
    .number({ message: "Select a regulation" })
    .int()
    .positive("Select a regulation"),
})

type AssignmentFormValues = z.infer<typeof assignmentSchema>

function AssignRegulationForm(
  props:
    | {
        mode: "create"
        admissionYear: AdmissionYear
        programmeOptions: Programme[]
        regulationOptions: Regulation[]
        onCancel: () => void
        onSaved: (r: ProgrammeAdmissionYear) => void
      }
    | {
        mode: "edit"
        link: ProgrammeAdmissionYear
        regulationOptions: Regulation[]
        onCancel: () => void
        onSaved: (r: ProgrammeAdmissionYear) => void
      },
) {
  // For edit mode, programme + admission year are display-only; only
  // regulation_id is wired to the form.
  const isCreate = props.mode === "create"

  const programmeOptions =
    isCreate ? props.programmeOptions : [props.link.programme]

  // Inject the currently-assigned regulation at the top of the edit form's
  // options in case it's been deactivated since assignment — keeps the form
  // from silently switching to a different value.
  const regulationOptions = React.useMemo(() => {
    if (isCreate) return props.regulationOptions
    const linked = props.link.regulation
    return props.regulationOptions.some((r) => r.id === linked.id)
      ? props.regulationOptions
      : [linked, ...props.regulationOptions]
  }, [isCreate, props])

  const defaults: AssignmentFormValues = isCreate
    ? {
        programme_id: programmeOptions[0]?.id ?? 0,
        regulation_id: regulationOptions[0]?.id ?? 0,
      }
    : {
        programme_id: props.link.programme_id,
        regulation_id: props.link.regulation_id,
      }

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const programmeComboOptions: ComboboxOption[] = React.useMemo(
    () =>
      programmeOptions.map((p) => ({
        value: p.id,
        label: p.code,
        sublabel: p.display_name,
      })),
    [programmeOptions],
  )
  const regulationComboOptions: ComboboxOption[] = React.useMemo(
    () =>
      regulationOptions.map((r) => ({
        value: r.id,
        label: r.code,
        sublabel: r.name,
      })),
    [regulationOptions],
  )

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isCreate) {
        const created = await createProgrammeAdmissionYear({
          programme_id: values.programme_id,
          admission_year_id: props.admissionYear.id,
          regulation_id: values.regulation_id,
        })
        props.onSaved(created)
      } else {
        const updated = await updateProgrammeAdmissionYear(props.link.id, {
          regulation_id: values.regulation_id,
        })
        props.onSaved(updated)
      }
    } catch (err) {
      toast.error(
        isCreate
          ? "Couldn't assign regulation"
          : "Couldn't update assignment",
        {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    }
  })

  const noProgrammes = isCreate && programmeOptions.length === 0
  const noRegulations = regulationOptions.length === 0
  const cantSubmit = noProgrammes || noRegulations

  const yearForHeader = isCreate
    ? props.admissionYear
    : props.link.admission_year

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {isCreate
            ? `Assign regulation for ${yearForHeader.display_year}`
            : `Edit ${props.link.programme.code} → ${yearForHeader.display_year}`}
        </SheetTitle>
        <SheetDescription>
          {isCreate
            ? "Pick a programme and the regulation that applies to it for this admission year."
            : "Change the regulation that applies to this programme for this admission year."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {(noProgrammes || noRegulations) && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {noProgrammes
              ? "No active programmes. Create one first."
              : "No active regulations. Create one first."}
          </p>
        )}

        <div className="grid gap-4 hd:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pra-year">Admission year</Label>
            <Input
              id="pra-year"
              readOnly
              disabled
              value={yearForHeader.display_year}
            />
            <p className="text-xs text-muted-foreground">
              Fixed by the page's selected year.
            </p>
          </div>

          {isCreate ? (
            <div className="space-y-1.5">
              <Label htmlFor="pra-programme">Programme</Label>
              <Controller
                control={control}
                name="programme_id"
                render={({ field, fieldState }) => (
                  <Combobox
                    id="pra-programme"
                    value={field.value || null}
                    options={programmeComboOptions}
                    onChange={(v) => field.onChange(v ?? 0)}
                    placeholder="Select a programme"
                    searchPlaceholder="Search programmes…"
                    emptyMessage="No programmes match"
                    disabled={noProgrammes}
                    invalid={!!fieldState.error}
                  />
                )}
              />
              {errors.programme_id?.message && (
                <p className="text-xs text-destructive">
                  {errors.programme_id.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pra-programme-readonly">Programme</Label>
              <Input
                id="pra-programme-readonly"
                readOnly
                disabled
                value={`${props.link.programme.code} — ${props.link.programme.display_name}`}
              />
              <p className="text-xs text-muted-foreground">
                Programme is fixed at assignment.
              </p>
            </div>
          )}

          <div className="space-y-1.5 hd:col-span-2">
            <Label htmlFor="pra-regulation">Regulation</Label>
            <Controller
              control={control}
              name="regulation_id"
              render={({ field, fieldState }) => (
                <Combobox
                  id="pra-regulation"
                  value={field.value || null}
                  options={regulationComboOptions}
                  onChange={(v) => field.onChange(v ?? 0)}
                  placeholder="Select a regulation"
                  searchPlaceholder="Search regulations…"
                  emptyMessage="No regulations match"
                  disabled={noRegulations}
                  invalid={!!fieldState.error}
                />
              )}
            />
            {errors.regulation_id?.message && (
              <p className="text-xs text-destructive">
                {errors.regulation_id.message}
              </p>
            )}
          </div>
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
          disabled={isSubmitting || cantSubmit || (!isCreate && !isDirty)}
        >
          {isSubmitting
            ? isCreate
              ? "Saving…"
              : "Saving…"
            : isCreate
              ? "Assign regulation"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}
