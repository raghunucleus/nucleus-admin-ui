import * as React from "react"
import { Link, useSearch } from "@tanstack/react-router"
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
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  LayoutGrid,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Scissors,
  SearchX,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { EmptyState } from "@/components/ui/empty-state"
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
  activateProgrammeSemester,
  bulkCreateProgrammeSemesters,
  completeProgrammeSemester,
  deactivateProgrammeSemester,
  listProgrammeSemesters,
  setProgrammeSemesterDates,
  startProgrammeSemester,
  trimProgrammeSemesterSessions,
  type ListProgrammeSemestersParams,
  type ProgrammeSemester,
  type ProgrammeSemesterStatusFilter,
  type ProgrammeSemestersSortField,
  type ProgrammeSemestersSortOrder,
} from "@/lib/programme-semesters"
import { listProgrammes, type Programme } from "@/lib/programmes"
import { listSemesters, type Semester } from "@/lib/semesters"

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
  | { kind: "manage"; row: ProgrammeSemester }

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

// Sticky Actions column — same recipe as Programmes. Body cell uses an
// opaque color-mix on hover (not bg-muted/40) so scrolled-under columns
// can't bleed through.
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

export function ProgrammeSemestersPage() {
  // Honor `?programmeId=N` so this screen can be opened scoped to a single
  // programme from the Programmes row "Configure semesters" action.
  const search = useSearch({ strict: false }) as { programmeId?: number }
  const urlProgrammeId = search.programmeId

  const [rows, setRows] = React.useState<ProgrammeSemester[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] =
    React.useState<ProgrammeSemester | null>(null)

  // Active-only option lists for filters + bulk-add form. Loaded once on mount.
  const [programmeOptions, setProgrammeOptions] = React.useState<Programme[]>([])
  const [yearOptions, setYearOptions] = React.useState<AdmissionYear[]>([])
  const [semesterOptions, setSemesterOptions] = React.useState<Semester[]>([])
  const [optionsLoading, setOptionsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      setOptionsLoading(true)
      try {
        const [p, y, s] = await Promise.all([
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
          listSemesters({
            status: "active",
            pageSize: 100,
            sortBy: "sem_number",
            sortOrder: "asc",
          }),
        ])
        if (cancelled) return
        setProgrammeOptions(p.rows)
        setYearOptions(y.rows)
        setSemesterOptions(s.rows)
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

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Open by default — programme / semester filters are the primary way to
  // narrow this screen, so surface them upfront rather than hiding behind a
  // toggle. The user can still close it.
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(true)

  const [pendingStatus, setPendingStatus] = React.useState<
    ProgrammeSemesterStatusFilter | undefined
  >(undefined)
  const [pendingProgrammeId, setPendingProgrammeId] = React.useState<
    number | undefined
  >(undefined)
  const [pendingSemesterId, setPendingSemesterId] = React.useState<
    number | undefined
  >(undefined)
  const [status, setStatus] = React.useState<
    ProgrammeSemesterStatusFilter | undefined
  >(undefined)
  const [programmeId, setProgrammeId] = React.useState<number | undefined>(
    urlProgrammeId,
  )
  // Admission year is a mandatory primary axis of this page — there is no
  // "All years" view. Initialized below once options load (most recent first).
  const [yearId, setYearId] = React.useState<number | undefined>(undefined)
  const [semesterId, setSemesterId] = React.useState<number | undefined>(undefined)

  // Auto-pick the most recent active admission year once options arrive, but
  // only if the user hasn't picked one already. yearOptions is sorted desc by
  // year in the load effect, so [0] is the latest.
  React.useEffect(() => {
    if (yearId === undefined && yearOptions.length > 0) {
      setYearId(yearOptions[0].id)
    }
  }, [yearId, yearOptions])

  // Re-navigation to this page with a different `?programmeId` reuses the
  // same component instance; sync local state so the filter follows the URL.
  // Doesn't fight manual filter changes — only fires when the URL value
  // itself changes between renders.
  React.useEffect(() => {
    setProgrammeId(urlProgrammeId)
  }, [urlProgrammeId])

  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    if (filterPanelOpen) {
      setPendingStatus(status)
      setPendingProgrammeId(programmeId)
      setPendingSemesterId(semesterId)
    }
  }, [filterPanelOpen, status, programmeId, semesterId])

  const applyFilters = () => {
    setStatus(pendingStatus)
    setProgrammeId(pendingProgrammeId)
    setSemesterId(pendingSemesterId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setPendingProgrammeId(undefined)
    setPendingSemesterId(undefined)
    setStatus(undefined)
    setProgrammeId(undefined)
    setSemesterId(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
    // yearId is intentionally not reset — it's a mandatory primary axis.
  }

  const filtersDirty =
    pendingStatus !== status ||
    pendingProgrammeId !== programmeId ||
    pendingSemesterId !== semesterId

  // Admission year is not counted here — it's always set and not a "filter"
  // in the user's mental model on this page.
  const activeFilterCount =
    (status ? 1 : 0) +
    (programmeId !== undefined ? 1 : 0) +
    (semesterId !== undefined ? 1 : 0)

  const queryParams = React.useMemo<ListProgrammeSemestersParams>(() => {
    const head = sorting[0]
    const sortBy: ProgrammeSemestersSortField =
      (head?.id as ProgrammeSemestersSortField | undefined) ?? "created_at"
    const sortOrder: ProgrammeSemestersSortOrder = head
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
      semesterId,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    status,
    programmeId,
    yearId,
    semesterId,
  ])

  const loadIdRef = React.useRef(0)
  const load = React.useCallback(async () => {
    // Don't fire until the mandatory year has resolved (first render before
    // options arrive, or before the auto-pick effect runs).
    if (yearId === undefined) return

    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listProgrammeSemesters(queryParams)
      if (!isLatest()) return
      setRows(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load programme semesters", {
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

  const requestToggleActive = (row: ProgrammeSemester) => setConfirmTarget(row)

  const handleToggleActive = async (row: ProgrammeSemester) => {
    setBusyId(row.id)
    try {
      const updated = row.is_active
        ? await deactivateProgrammeSemester(row.id)
        : await activateProgrammeSemester(row.id)
      toast.success(
        `${updated.programme.code} • ${updated.semester.code} ${
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

  const handleCreated = async (
    created: number,
    skipped: number,
  ) => {
    setMode({ kind: "list" })
    if (created > 0 && skipped > 0) {
      toast.success(`Linked ${created} semester(s).`, {
        description: `${skipped} already existed and were skipped.`,
      })
    } else if (created > 0) {
      toast.success(`Linked ${created} semester(s).`)
    } else {
      toast.info("Nothing to link", {
        description: `All ${skipped} selected semester(s) were already linked.`,
      })
    }
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex min-w-0 flex-col gap-0.5">
          {urlProgrammeId !== undefined && (
            <Link
              to="/masters/programmes"
              className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to programmes
            </Link>
          )}
          <h1 className="text-base font-semibold tracking-tight">
            Programme semesters
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="page-year" className="text-xs text-muted-foreground">
              Year
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
                  // Year is mandatory — ignore an unexpected null clear.
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
            Link semesters
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
          {mode.kind === "create" && (
            <BulkLinkForm
              programmeOptions={programmeOptions}
              yearOptions={yearOptions}
              semesterOptions={semesterOptions}
              defaultProgrammeId={urlProgrammeId}
              defaultAdmissionYearId={yearId}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={handleCreated}
            />
          )}
          {mode.kind === "manage" && (
            <ManageSemesterForm
              row={mode.row}
              onClose={() => setMode({ kind: "list" })}
              onChanged={async () => {
                await load()
                // Keep the sheet open so the admin can chain actions —
                // refresh `row` from the latest list by id.
                setMode((m) => {
                  if (m.kind !== "manage") return m
                  const fresh = rows.find((r) => r.id === m.row.id)
                  return fresh ? { kind: "manage", row: fresh } : { kind: "list" }
                })
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            pendingStatus={pendingStatus}
            pendingProgrammeId={pendingProgrammeId}
            pendingSemesterId={pendingSemesterId}
            programmeOptions={programmeOptions}
            semesterOptions={semesterOptions}
            onPendingStatusChange={setPendingStatus}
            onPendingProgrammeChange={setPendingProgrammeId}
            onPendingSemesterChange={setPendingSemesterId}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status &&
              programmeId === undefined &&
              semesterId === undefined &&
              !pendingStatus &&
              pendingProgrammeId === undefined &&
              pendingSemesterId === undefined
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <ProgrammeSemestersTable
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
            onToggleActive={requestToggleActive}
            onManage={(r) => setMode({ kind: "manage", row: r })}
            canCreate={!optionsLoading}
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
            ? "Deactivate programme semester?"
            : "Activate programme semester?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated programme semesters won't be selectable in dependent records."
                : "Reactivated programme semesters become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.programme.code} •{" "}
                {confirmTarget.admission_year.display_year} •{" "}
                {confirmTarget.semester.code}
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
  pendingSemesterId,
  programmeOptions,
  semesterOptions,
  onPendingStatusChange,
  onPendingProgrammeChange,
  onPendingSemesterChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: ProgrammeSemesterStatusFilter | undefined
  pendingProgrammeId: number | undefined
  pendingSemesterId: number | undefined
  programmeOptions: Programme[]
  semesterOptions: Semester[]
  onPendingStatusChange: (v: ProgrammeSemesterStatusFilter | undefined) => void
  onPendingProgrammeChange: (v: number | undefined) => void
  onPendingSemesterChange: (v: number | undefined) => void
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
                  : (e.target.value as ProgrammeSemesterStatusFilter),
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
          <Label htmlFor="filter-semester">Semester</Label>
          <Combobox
            id="filter-semester"
            value={pendingSemesterId ?? null}
            options={semesterOptions.map((s) => ({
              value: s.id,
              label: s.code,
              sublabel: s.name,
            }))}
            onChange={(v) => onPendingSemesterChange(v ?? undefined)}
            placeholder="All semesters"
            searchPlaceholder="Search semesters…"
            emptyMessage="No semesters match"
            clearLabel="All semesters"
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

function ProgrammeSemestersTable({
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
  onToggleActive,
  onManage,
  canCreate,
  onCreate,
}: {
  rows: ProgrammeSemester[]
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
  onToggleActive: (r: ProgrammeSemester) => void
  onManage: (r: ProgrammeSemester) => void
  canCreate: boolean
  onCreate: () => void
}) {
  const columns = React.useMemo<ColumnDef<ProgrammeSemester>[]>(
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
        id: "admission_year",
        header: "Admission year",
        accessorFn: (r) => r.admission_year?.display_year ?? "",
        cell: ({ row }) => {
          const y = row.original.admission_year
          if (!y) return <span className="text-muted-foreground">—</span>
          return (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {y.display_year}
            </span>
          )
        },
      },
      {
        id: "semester",
        header: "Semester",
        accessorFn: (r) => r.semester?.sem_number ?? 0,
        cell: ({ row }) => {
          const s = row.original.semester
          if (!s) return <span className="text-muted-foreground">—</span>
          return (
            <div className="min-w-0">
              <div className="font-medium">{s.code}</div>
              <div className="text-xs text-muted-foreground">
                {s.roman_format} · {s.year_sem_format}
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
                className="size-8 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onManage(r)}
                disabled={isBusy || formOpen}
                title="Lifecycle & dates"
                aria-label="Lifecycle & dates"
              >
                <CalendarRange />
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
    [busyId, formOpen, onToggleActive, onManage],
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
                    admission_year: "w-24",
                    semester: "w-24",
                    status: "w-16",
                    created_at: "w-32",
                    updated_at: "w-32",
                    actions: "w-12",
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
                    title="Couldn't load programme semesters"
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
                    description="No programme semesters match the current filters."
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
                    icon={LayoutGrid}
                    title="No programme semesters yet"
                    description="Link semesters to a programme & admission year to get started."
                    action={
                      <Button size="sm" onClick={onCreate} disabled={!canCreate}>
                        <Plus />
                        Link semesters
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

const bulkLinkSchema = z.object({
  programme_id: z
    .number({ message: "Select a programme" })
    .int()
    .positive("Select a programme"),
  admission_year_id: z
    .number({ message: "Select an admission year" })
    .int()
    .positive("Select an admission year"),
  semester_ids: z
    .array(z.number().int().positive())
    .min(1, "Pick at least one semester"),
})

type BulkLinkFormValues = z.infer<typeof bulkLinkSchema>

function BulkLinkForm({
  programmeOptions,
  yearOptions,
  semesterOptions,
  defaultProgrammeId,
  defaultAdmissionYearId,
  onCancel,
  onSaved,
}: {
  programmeOptions: Programme[]
  yearOptions: AdmissionYear[]
  semesterOptions: Semester[]
  defaultProgrammeId?: number
  defaultAdmissionYearId?: number
  onCancel: () => void
  onSaved: (created: number, skipped: number) => void
}) {
  // Pre-select the programme when the screen is opened scoped to one (via
  // the Programme row "Configure semesters" action). Fall back to the first
  // option otherwise so the form is never in a zero-id state.
  const initialProgrammeId =
    defaultProgrammeId &&
    programmeOptions.some((p) => p.id === defaultProgrammeId)
      ? defaultProgrammeId
      : (programmeOptions[0]?.id ?? 0)

  // The page now has a mandatory year selector — opening the form should
  // start with that same year so the admin doesn't have to re-pick.
  const initialAdmissionYearId =
    defaultAdmissionYearId &&
    yearOptions.some((y) => y.id === defaultAdmissionYearId)
      ? defaultAdmissionYearId
      : (yearOptions[0]?.id ?? 0)

  const defaults: BulkLinkFormValues = {
    programme_id: initialProgrammeId,
    admission_year_id: initialAdmissionYearId,
    semester_ids: [],
  }

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BulkLinkFormValues>({
    resolver: zodResolver(bulkLinkSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const programmeId = watch("programme_id")
  const admissionYearId = watch("admission_year_id")
  const semesterIds = watch("semester_ids")

  const programmeComboOptions: ComboboxOption[] = React.useMemo(
    () =>
      programmeOptions.map((p) => ({
        value: p.id,
        label: p.code,
        sublabel: p.display_name,
      })),
    [programmeOptions],
  )
  const yearComboOptions: ComboboxOption[] = React.useMemo(
    () =>
      yearOptions.map((y) => ({
        value: y.id,
        label: y.display_year,
        sublabel: String(y.year),
      })),
    [yearOptions],
  )

  const selectedProgramme = programmeOptions.find((p) => p.id === programmeId)
  // A degree's `duration_years` maps directly to the number of semesters in
  // the programme: 4 years × 2 = 8 semesters, 2 years × 2 = 4 semesters.
  // When the programme's degree doesn't carry a duration (legacy data),
  // fall back to all semesters.
  const expectedSemesters =
    selectedProgramme?.degree?.duration_years !== undefined
      ? selectedProgramme.degree.duration_years * 2
      : undefined

  // The list of semesters the user is allowed to link for the chosen
  // programme — first N by sem_number, where N comes from the duration.
  // Sorting up-front means everything downstream (display + auto-select)
  // sees them in canonical order.
  const visibleSemesters = React.useMemo(() => {
    const sorted = semesterOptions
      .slice()
      .sort((a, b) => a.sem_number - b.sem_number)
    return expectedSemesters === undefined
      ? sorted
      : sorted.slice(0, expectedSemesters)
  }, [semesterOptions, expectedSemesters])

  // Auto-check every visible semester whenever the programme changes (and on
  // the very first render). Keyed off `programmeId` only — the user can
  // uncheck individual rows after this fires; we don't run it again until
  // they pick a different programme. visibleSemesters is derived from
  // programmeId so it's stable across the same selection.
  const autoSelectKey = `${programmeId}:${expectedSemesters ?? "all"}:${semesterOptions.length}`
  const lastAutoSelectKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (lastAutoSelectKeyRef.current === autoSelectKey) return
    lastAutoSelectKeyRef.current = autoSelectKey
    setValue(
      "semester_ids",
      visibleSemesters.map((s) => s.id),
      { shouldDirty: true, shouldValidate: true },
    )
  }, [autoSelectKey, visibleSemesters, setValue])

  const toggleSemester = (id: number) => {
    const current = semesterIds ?? []
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id]
    setValue("semester_ids", next, { shouldDirty: true, shouldValidate: true })
  }

  const selectAllVisible = () => {
    setValue(
      "semester_ids",
      visibleSemesters.map((s) => s.id),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  const clearSemesters = () => {
    setValue("semester_ids", [], { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await bulkCreateProgrammeSemesters({
        programme_id: values.programme_id,
        admission_year_id: values.admission_year_id,
        semester_ids: values.semester_ids,
      })
      onSaved(result.created.length, result.skipped.length)
    } catch (err) {
      toast.error("Couldn't link semesters", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    }
  })

  const noProgrammes = programmeOptions.length === 0
  const noYears = yearOptions.length === 0
  const noSemesters = semesterOptions.length === 0
  const cantSubmit = noProgrammes || noYears || noSemesters

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Link semesters to a batch</SheetTitle>
        <SheetDescription>
          Pick a programme and admission year, then check the semesters to link.
          Existing combinations are skipped automatically.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {(noProgrammes || noYears || noSemesters) && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {noProgrammes
              ? "No active programmes. Create one first."
              : noYears
                ? "No active admission years. Create one first."
                : "No active semesters. Create one first."}
          </p>
        )}

        <div className="grid gap-4 hd:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bls-programme">Programme</Label>
            <Combobox
              id="bls-programme"
              value={programmeId || null}
              options={programmeComboOptions}
              onChange={(v) =>
                setValue("programme_id", v ?? 0, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Select a programme"
              searchPlaceholder="Search programmes…"
              emptyMessage="No programmes match"
              disabled={noProgrammes}
              invalid={!!errors.programme_id}
            />
            {errors.programme_id?.message && (
              <p className="text-xs text-destructive">
                {errors.programme_id.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bls-year">Admission year</Label>
            <Combobox
              id="bls-year"
              value={admissionYearId || null}
              options={yearComboOptions}
              onChange={(v) =>
                setValue("admission_year_id", v ?? 0, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Select an admission year"
              searchPlaceholder="Search years…"
              emptyMessage="No years match"
              disabled={noYears}
              invalid={!!errors.admission_year_id}
            />
            {errors.admission_year_id?.message && (
              <p className="text-xs text-destructive">
                {errors.admission_year_id.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Semesters</Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                disabled={visibleSemesters.length === 0}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSemesters}
                disabled={(semesterIds?.length ?? 0) === 0}
              >
                Clear
              </Button>
            </div>
          </div>

          {expectedSemesters !== undefined && selectedProgramme ? (
            <p className="text-xs text-muted-foreground">
              {selectedProgramme.code} runs for{" "}
              {selectedProgramme.degree?.duration_years} year(s) — showing
              semesters 1–{expectedSemesters}. All selected by default.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Showing all semesters. All selected by default.
            </p>
          )}

          <div className="rounded-md border bg-background">
            {visibleSemesters.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {noSemesters
                  ? "No active semesters available."
                  : "No semesters available for the selected programme's duration."}
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto thin-scrollbar divide-y">
                {visibleSemesters.map((s) => {
                  const checked = (semesterIds ?? []).includes(s.id)
                  return (
                    <li key={s.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors",
                          "hover:bg-accent/40",
                          checked && "bg-primary/5",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSemester(s.id)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="font-medium tabular-nums">
                            {s.sem_number}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {s.code}
                          </span>
                          <span className="truncate text-muted-foreground">
                            · {s.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {s.roman_format} · {s.year_sem_format}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {errors.semester_ids?.message && (
            <p className="text-xs text-destructive">
              {errors.semester_ids.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {(semesterIds?.length ?? 0)} of {visibleSemesters.length} selected.
          </p>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Combinations of (programme, admission year, semester) already in the
          system will be skipped without error — the form is safe to retry.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            cantSubmit ||
            (semesterIds?.length ?? 0) === 0
          }
        >
          {isSubmitting ? "Linking…" : "Link semesters"}
        </Button>
      </SheetFooter>
    </form>
  )
}

// --- Manage sheet (lifecycle + planned dates + trim) ---------------------

function ManageSemesterForm({
  row,
  onClose,
  onChanged,
}: {
  row: ProgrammeSemester
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const [busy, setBusy] = React.useState<
    "start" | "complete" | "dates" | "trim" | null
  >(null)
  const [confirmTrim, setConfirmTrim] = React.useState(false)
  const [start, setStart] = React.useState<string>(
    row.planned_start_date ?? "",
  )
  const [end, setEnd] = React.useState<string>(row.planned_end_date ?? "")

  const datesDirty =
    (row.planned_start_date ?? "") !== start ||
    (row.planned_end_date ?? "") !== end
  const datesValid = !start || !end || end >= start

  const doStart = async () => {
    setBusy("start")
    try {
      await startProgrammeSemester(row.id)
      toast.success("Semester started.", {
        description:
          "Sessions for the next two weeks are being seeded for every published timetable.",
      })
      await onChanged()
    } catch (err) {
      toast.error("Couldn't start semester", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  const doComplete = async () => {
    setBusy("complete")
    try {
      await completeProgrammeSemester(row.id)
      toast.success("Semester completed.", {
        description: "Future scheduled sessions cancelled, timetables archived.",
      })
      await onChanged()
    } catch (err) {
      toast.error("Couldn't complete semester", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  const doSaveDates = async () => {
    setBusy("dates")
    try {
      await setProgrammeSemesterDates(row.id, {
        planned_start_date: start || null,
        planned_end_date: end || null,
      })
      toast.success("Planned dates saved.")
      await onChanged()
    } catch (err) {
      toast.error("Couldn't save dates", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  const doTrim = async () => {
    setBusy("trim")
    try {
      const res = await trimProgrammeSemesterSessions(row.id)
      toast.success(`Trimmed ${res.deleted} session${res.deleted === 1 ? "" : "s"}.`, {
        description:
          res.deleted === 0
            ? "Nothing past the planned end date."
            : "Future scheduled sessions past the end date were removed.",
      })
      await onChanged()
    } catch (err) {
      toast.error("Couldn't trim", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
      setConfirmTrim(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {row.programme.code} · {row.semester.code} · {row.admission_year.display_year}
        </SheetTitle>
        <SheetDescription>
          Lifecycle, planned dates, and session cleanup for this batch's
          semester. The seeder uses the planned dates as a hard upper bound.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-6">
        {/* Lifecycle */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                row.status === "ongoing"
                  ? "bg-success/10 text-success"
                  : row.status === "completed"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/10 text-amber-700",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {row.status[0].toUpperCase() + row.status.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.status === "upcoming" &&
                "Sessions seed when you start the semester."}
              {row.status === "ongoing" &&
                "Sessions seed weekly; mark/edit allowed."}
              {row.status === "completed" && "Read-only. Cannot be re-opened."}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {row.status === "upcoming" && (
              <Button size="sm" onClick={doStart} disabled={busy !== null}>
                Start semester
              </Button>
            )}
            {row.status === "ongoing" && (
              <Button
                size="sm"
                variant="outline"
                onClick={doComplete}
                disabled={busy !== null}
              >
                Complete semester
              </Button>
            )}
          </div>
        </section>

        {/* Planned dates */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Planned dates
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="planned-start" className="text-xs">
                Start
              </Label>
              <DatePicker
                id="planned-start"
                value={start}
                onChange={setStart}
                allowClear
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planned-end" className="text-xs">
                End
              </Label>
              <DatePicker
                id="planned-end"
                value={end}
                onChange={setEnd}
                allowClear
                invalid={!datesValid}
              />
              {!datesValid && (
                <p className="text-xs text-destructive">
                  End must be on or after start.
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sessions never seed past the end date. Used as the cap by the
            publish action and the Sunday rollover cron.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={doSaveDates}
              disabled={busy !== null || !datesDirty || !datesValid}
            >
              Save dates
            </Button>
            {row.planned_end_date && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmTrim(true)}
                disabled={busy !== null}
                title="Delete still-scheduled sessions past the planned end date"
              >
                <Scissors className="size-4" />
                Trim past sessions
              </Button>
            )}
          </div>
        </section>
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>

      <ConfirmDialog
        open={confirmTrim}
        onOpenChange={setConfirmTrim}
        title="Trim future scheduled sessions?"
        description={
          <>
            Sessions still in <span className="font-medium">scheduled</span>{" "}
            status past{" "}
            <span className="font-medium text-foreground">
              {row.planned_end_date}
            </span>{" "}
            will be deleted. Completed sessions (already marked) are left
            untouched.
          </>
        }
        confirmLabel="Trim"
        tone="destructive"
        loading={busy === "trim"}
        onConfirm={doTrim}
      />
    </div>
  )
}
