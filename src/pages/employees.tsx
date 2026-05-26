import * as React from "react"
import { Link } from "@tanstack/react-router"
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
  ShieldCheck,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SearchX,
  Users,
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
import { listDepartments, type Department } from "@/lib/departments"
import { listDesignations, type Designation } from "@/lib/designations"
import {
  GENDERS,
  GENDER_LABELS,
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  listEmployees,
  updateEmployee,
  type Employee,
  type EmployeeStatusFilter,
  type EmployeesSortField,
  type EmployeesSortOrder,
  type Gender,
  type ListEmployeesParams,
} from "@/lib/employees"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    align?: "left" | "right" | "center"
    sticky?: "right" | "left"
  }
}

const STICKY_RIGHT_CELL = "sticky right-0 z-10 bg-card border-l"
const STICKY_RIGHT_HEAD = "sticky right-0 z-20 bg-card border-l"
const STICKY_LEFT_CELL = "sticky left-0 z-10 bg-card border-r"
const STICKY_LEFT_HEAD = "sticky left-0 z-20 bg-card border-r"

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; employee: Employee }

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

export function EmployeesPage() {
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<Employee | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [searchRowOpen, setSearchRowOpen] = React.useState(false)

  const [pendingStatus, setPendingStatus] = React.useState<
    EmployeeStatusFilter | undefined
  >(undefined)
  const [pendingGender, setPendingGender] = React.useState<Gender | undefined>(
    undefined,
  )
  const [pendingDepartmentId, setPendingDepartmentId] = React.useState<
    number | undefined
  >(undefined)
  const [pendingDesignationId, setPendingDesignationId] = React.useState<
    number | undefined
  >(undefined)

  const [status, setStatus] = React.useState<EmployeeStatusFilter | undefined>(
    undefined,
  )
  const [gender, setGender] = React.useState<Gender | undefined>(undefined)
  const [departmentId, setDepartmentId] = React.useState<number | undefined>(
    undefined,
  )
  const [designationId, setDesignationId] = React.useState<number | undefined>(
    undefined,
  )

  type ColumnSearchState = {
    emp_code: string
    emp_display_name: string
    email: string
    mobile_number: string
    rm_emp_code: string
  }
  const emptyColumnSearch: ColumnSearchState = {
    emp_code: "",
    emp_display_name: "",
    email: "",
    mobile_number: "",
    rm_emp_code: "",
  }
  const [columnSearch, setColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const [appliedColumnSearch, setAppliedColumnSearch] =
    React.useState<ColumnSearchState>(emptyColumnSearch)
  const initialLoadDoneRef = React.useRef(false)

  React.useEffect(() => {
    if (filterPanelOpen) {
      setPendingStatus(status)
      setPendingGender(gender)
      setPendingDepartmentId(departmentId)
      setPendingDesignationId(designationId)
    }
  }, [filterPanelOpen, status, gender, departmentId, designationId])

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
      emp_code: columnSearch.emp_code.trim(),
      emp_display_name: columnSearch.emp_display_name.trim(),
      email: columnSearch.email.trim(),
      mobile_number: columnSearch.mobile_number.trim(),
      rm_emp_code: columnSearch.rm_emp_code.trim(),
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
    setGender(pendingGender)
    setDepartmentId(pendingDepartmentId)
    setDesignationId(pendingDesignationId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setPendingGender(undefined)
    setPendingDepartmentId(undefined)
    setPendingDesignationId(undefined)
    setStatus(undefined)
    setGender(undefined)
    setDepartmentId(undefined)
    setDesignationId(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty =
    pendingStatus !== status ||
    pendingGender !== gender ||
    pendingDepartmentId !== departmentId ||
    pendingDesignationId !== designationId
  const columnSearchDirty =
    columnSearch.emp_code.trim() !== appliedColumnSearch.emp_code ||
    columnSearch.emp_display_name.trim() !== appliedColumnSearch.emp_display_name ||
    columnSearch.email.trim() !== appliedColumnSearch.email ||
    columnSearch.mobile_number.trim() !== appliedColumnSearch.mobile_number ||
    columnSearch.rm_emp_code.trim() !== appliedColumnSearch.rm_emp_code
  const columnSearchHasInput =
    !!columnSearch.emp_code ||
    !!columnSearch.emp_display_name ||
    !!columnSearch.email ||
    !!columnSearch.mobile_number ||
    !!columnSearch.rm_emp_code

  const activeFilterCount =
    (status ? 1 : 0) +
    (gender ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (designationId ? 1 : 0) +
    (appliedColumnSearch.emp_code ? 1 : 0) +
    (appliedColumnSearch.emp_display_name ? 1 : 0) +
    (appliedColumnSearch.email ? 1 : 0) +
    (appliedColumnSearch.mobile_number ? 1 : 0) +
    (appliedColumnSearch.rm_emp_code ? 1 : 0)

  const queryParams = React.useMemo<ListEmployeesParams>(() => {
    const head = sorting[0]
    const sortBy: EmployeesSortField =
      (head?.id as EmployeesSortField | undefined) ?? "created_at"
    const sortOrder: EmployeesSortOrder = head
      ? head.desc
        ? "desc"
        : "asc"
      : "desc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      empCodeSearch: appliedColumnSearch.emp_code || undefined,
      displayNameSearch: appliedColumnSearch.emp_display_name || undefined,
      emailSearch: appliedColumnSearch.email || undefined,
      mobileSearch: appliedColumnSearch.mobile_number || undefined,
      rmEmpCodeSearch: appliedColumnSearch.rm_emp_code || undefined,
      status,
      gender,
      departmentId,
      designationId,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    appliedColumnSearch,
    status,
    gender,
    departmentId,
    designationId,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listEmployees(queryParams)
      if (!isLatest()) return
      setEmployees(result.rows)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load employees", {
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

  // Departments, designations, and (potential) managers for filter/form selects.
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [designations, setDesignations] = React.useState<Designation[]>([])
  const [managers, setManagers] = React.useState<Employee[]>([])

  const refreshManagers = React.useCallback(async () => {
    try {
      const result = await listEmployees({
        status: "active",
        pageSize: 100,
        sortBy: "emp_display_name",
        sortOrder: "asc",
      })
      setManagers(result.rows)
    } catch {
      // Non-fatal: manager dropdown will just be empty.
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [deps, des] = await Promise.all([
          listDepartments({ status: "active", pageSize: 100, sortBy: "name", sortOrder: "asc" }),
          listDesignations({ status: "active", pageSize: 100, sortBy: "name", sortOrder: "asc" }),
        ])
        if (cancelled) return
        setDepartments(deps.rows)
        setDesignations(des.rows)
      } catch {
        // Non-fatal: filter/form selects will just be empty.
      }
    })()
    void refreshManagers()
    return () => {
      cancelled = true
    }
  }, [refreshManagers])

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

  const requestToggleActive = (employee: Employee) => setConfirmTarget(employee)

  const handleToggleActive = async (employee: Employee) => {
    setBusyId(employee.id)
    try {
      const updated = employee.is_active
        ? await deactivateEmployee(employee.id)
        : await activateEmployee(employee.id)
      toast.success(
        `${updated.emp_display_name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update employee status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaved = async (updated: Employee, kind: "create" | "edit") => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create"
        ? `${updated.emp_display_name} created.`
        : `${updated.emp_display_name} updated.`,
    )
    await Promise.all([load(), refreshManagers()])
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <h1 className="text-base font-semibold tracking-tight">Employees</h1>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New employee
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
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          {mode.kind === "create" && (
            <EmployeeForm
              mode="create"
              departments={departments}
              designations={designations}
              managers={managers}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(e) => handleSaved(e, "create")}
            />
          )}

          {mode.kind === "edit" && (
            <EmployeeForm
              mode="edit"
              employee={mode.employee}
              departments={departments}
              designations={designations}
              managers={managers}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(e) => handleSaved(e, "edit")}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-start gap-4">
        {filterPanelOpen && (
          <FilterPanel
            pendingStatus={pendingStatus}
            pendingGender={pendingGender}
            pendingDepartmentId={pendingDepartmentId}
            pendingDesignationId={pendingDesignationId}
            departments={departments}
            designations={designations}
            onPendingStatusChange={setPendingStatus}
            onPendingGenderChange={setPendingGender}
            onPendingDepartmentIdChange={setPendingDepartmentId}
            onPendingDesignationIdChange={setPendingDesignationId}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status &&
              !gender &&
              !departmentId &&
              !designationId &&
              !pendingStatus &&
              !pendingGender &&
              !pendingDepartmentId &&
              !pendingDesignationId
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <EmployeesTable
            employees={employees}
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
              !appliedColumnSearch.emp_code &&
              !appliedColumnSearch.emp_display_name &&
              !appliedColumnSearch.email &&
              !appliedColumnSearch.mobile_number &&
              !appliedColumnSearch.rm_emp_code
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(e) => setMode({ kind: "edit", employee: e })}
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
            ? "Deactivate employee?"
            : "Activate employee?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated employees won't be selectable in dependent records."
                : "Reactivated employees become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.emp_display_name}{" "}
                <span className="text-muted-foreground">
                  ({confirmTarget.emp_code})
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
  pendingGender,
  pendingDepartmentId,
  pendingDesignationId,
  departments,
  designations,
  onPendingStatusChange,
  onPendingGenderChange,
  onPendingDepartmentIdChange,
  onPendingDesignationIdChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: EmployeeStatusFilter | undefined
  pendingGender: Gender | undefined
  pendingDepartmentId: number | undefined
  pendingDesignationId: number | undefined
  departments: Department[]
  designations: Designation[]
  onPendingStatusChange: (v: EmployeeStatusFilter | undefined) => void
  onPendingGenderChange: (v: Gender | undefined) => void
  onPendingDepartmentIdChange: (v: number | undefined) => void
  onPendingDesignationIdChange: (v: number | undefined) => void
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
                  : (e.target.value as EmployeeStatusFilter),
              )
            }
            className={selectClass}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-gender">Gender</Label>
          <select
            id="filter-gender"
            value={pendingGender ?? ""}
            onChange={(e) =>
              onPendingGenderChange(
                e.target.value === "" ? undefined : (e.target.value as Gender),
              )
            }
            className={selectClass}
          >
            <option value="">All</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-department">Department</Label>
          <Combobox
            id="filter-department"
            value={pendingDepartmentId ?? null}
            options={departments.map((d) => ({
              value: d.id,
              label: d.name,
              sublabel: d.code,
            }))}
            onChange={(v) => onPendingDepartmentIdChange(v ?? undefined)}
            placeholder="All departments"
            searchPlaceholder="Search departments…"
            emptyMessage="No departments match"
            clearLabel="All departments"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-designation">Designation</Label>
          <Combobox
            id="filter-designation"
            value={pendingDesignationId ?? null}
            options={designations.map((d) => ({
              value: d.id,
              label: d.name,
              sublabel: d.code,
            }))}
            onChange={(v) => onPendingDesignationIdChange(v ?? undefined)}
            placeholder="All designations"
            searchPlaceholder="Search designations…"
            emptyMessage="No designations match"
            clearLabel="All designations"
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

type ColumnSearchValues = {
  emp_code: string
  emp_display_name: string
  email: string
  mobile_number: string
  rm_emp_code: string
}

function EmployeesTable({
  employees,
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
  employees: Employee[]
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
  onEdit: (e: Employee) => void
  onToggleActive: (e: Employee) => void
}) {
  const columns = React.useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        id: "emp_code",
        header: "Emp code",
        accessorKey: "emp_code",
        meta: { sticky: "left" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "emp_display_name",
        header: "Name",
        accessorKey: "emp_display_name",
        cell: ({ getValue }) => (
          <div className="font-medium">{String(getValue() ?? "")}</div>
        ),
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.department?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "designation",
        header: "Designation",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.designation?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "gender",
        header: "Gender",
        accessorKey: "gender",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {GENDER_LABELS[row.original.gender]}
          </span>
        ),
      },
      {
        id: "mobile_number",
        header: "Mobile",
        accessorKey: "mobile_number",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            +{row.original.country_code} {row.original.mobile_number}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessorKey: "email",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "rm_emp_code",
        header: "Reports to",
        accessorKey: "rm_emp_code",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return (
            <span className="font-mono text-xs text-muted-foreground">
              {v ?? "—"}
            </span>
          )
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (e) => (e.is_active ? "active" : "inactive"),
        cell: ({ row }) => {
          const e = row.original
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                e.is_active
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  e.is_active ? "bg-success" : "bg-destructive",
                )}
              />
              {e.is_active ? "Active" : "Inactive"}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { align: "right" as const, sticky: "right" as const },
        cell: ({ row }) => {
          const e = row.original
          const isBusy = busyId === e.id
          const toggleLabel = e.is_active ? "Deactivate" : "Activate"
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Link
                to="/role-management/assignments"
                search={{ employee_id: e.id, role_id: undefined }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  disabled={formOpen || isBusy}
                  title="Roles"
                  aria-label="Manage roles"
                >
                  <ShieldCheck />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(e)}
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
                  e.is_active
                    ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                onClick={() => onToggleActive(e)}
                disabled={isBusy || formOpen}
                title={toggleLabel}
                aria-label={toggleLabel}
              >
                {e.is_active ? <PowerOff /> : <Power />}
              </Button>
            </div>
          )
        },
      },
    ],
    [busyId, formOpen, onEdit, onToggleActive],
  )

  const table = useReactTable({
    data: employees,
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

  const searchableColumns: Record<string, keyof ColumnSearchValues> = {
    emp_code: "emp_code",
    emp_display_name: "emp_display_name",
    email: "email",
    mobile_number: "mobile_number",
    rm_emp_code: "rm_emp_code",
  }

  return (
    <div className="relative">
      <Table containerClassName="h-[36rem] overflow-auto thin-scrollbar">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const align = header.column.columnDef.meta?.align
                const sticky = header.column.columnDef.meta?.sticky
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      align === "right" && "text-right",
                      align === "center" && "text-center",
                      sticky === "right" && STICKY_RIGHT_HEAD,
                      sticky === "left" && STICKY_LEFT_HEAD,
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
                const key = searchableColumns[id]
                const sticky = column.columnDef.meta?.sticky
                return (
                  <TableHead
                    key={`search-${id}`}
                    className={cn(
                      "bg-card py-2",
                      sticky === "right" && STICKY_RIGHT_HEAD,
                      sticky === "left" && STICKY_LEFT_HEAD,
                    )}
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
                        placeholder={`Search ${id.replace(/_/g, " ")}…`}
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
                    emp_code: "w-20",
                    emp_display_name: "w-40",
                    department: "w-32",
                    designation: "w-28",
                    gender: "w-16",
                    mobile_number: "w-28",
                    email: "w-48",
                    rm_emp_code: "w-20",
                    status: "w-16",
                    actions: "w-16",
                  }
                  const widthCls = widths[id] ?? "w-24"
                  const align = column.columnDef.meta?.align
                  const sticky = column.columnDef.meta?.sticky
                  return (
                    <TableCell
                      key={`s-${rowIdx}-${id}`}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        sticky === "right" && STICKY_RIGHT_CELL,
                        sticky === "left" && STICKY_LEFT_CELL,
                      )}
                    >
                      <Skeleton
                        className={cn(
                          "h-4 inline-block align-middle",
                          widthCls,
                          id === "status" || id === "gender"
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
              <TableCell colSpan={table.getAllLeafColumns().length} className="p-0">
                {loadFailed ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load employees"
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
                    description="No employees match the current filters."
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
                    icon={Users}
                    title="No employees yet"
                    description="Create the first employee to get started."
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align
                  const sticky = cell.column.columnDef.meta?.sticky
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        sticky === "right" && STICKY_RIGHT_CELL,
                        sticky === "left" && STICKY_LEFT_CELL,
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

const empCodeField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(32, "Too long")
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9._-]+$/, "Use letters, numbers, dot, underscore, or dash"),
  )

const employeeSchema = z.object({
  emp_code: empCodeField,
  emp_display_name: z.string().trim().min(1, "Name is required").max(128, "Too long"),
  gender: z.enum(GENDERS, { message: "Select a gender" }),
  department_id: z
    .number({ message: "Select a department" })
    .int()
    .positive("Select a department"),
  designation_id: z
    .number({ message: "Select a designation" })
    .int()
    .positive("Select a designation"),
  mobile_number: z
    .string()
    .trim()
    .min(1, "Required")
    .max(20, "Too long")
    .regex(/^[0-9]+$/, "Digits only"),
  country_code: z
    .string()
    .trim()
    .min(1, "Required")
    .max(8, "Too long")
    .regex(/^[0-9]+$/, "Digits only"),
  email: z
    .string()
    .trim()
    .min(1, "Required")
    .max(255, "Too long")
    .email("Enter a valid email")
    .transform((v) => v.toLowerCase()),
  rm_emp_code: z
    .string()
    .trim()
    .max(32, "Too long")
    .transform((v) => v.toUpperCase())
    .refine(
      (v) => v === "" || /^[A-Z0-9._-]+$/.test(v),
      "Use letters, numbers, dot, underscore, or dash",
    ),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>

function EmployeeForm(
  props: (
    | { mode: "create" }
    | { mode: "edit"; employee: Employee }
  ) & {
    departments: Department[]
    designations: Designation[]
    managers: Employee[]
    onCancel: () => void
    onSaved: (e: Employee) => void
  },
) {
  const defaults: EmployeeFormValues =
    props.mode === "edit"
      ? {
          emp_code: props.employee.emp_code,
          emp_display_name: props.employee.emp_display_name,
          gender: props.employee.gender,
          department_id: props.employee.department_id,
          designation_id: props.employee.designation_id,
          mobile_number: props.employee.mobile_number,
          country_code: props.employee.country_code,
          email: props.employee.email,
          rm_emp_code: props.employee.rm_emp_code ?? "",
        }
      : {
          emp_code: "",
          emp_display_name: "",
          gender: "male",
          department_id: 0,
          designation_id: 0,
          mobile_number: "",
          country_code: "91",
          email: "",
          rm_emp_code: "",
        }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const departmentOptions: ComboboxOption[] = React.useMemo(
    () =>
      props.departments.map((d) => ({
        value: d.id,
        label: d.name,
        sublabel: d.code,
      })),
    [props.departments],
  )

  const designationOptions: ComboboxOption[] = React.useMemo(
    () =>
      props.designations.map((d) => ({
        value: d.id,
        label: d.name,
        sublabel: d.code,
      })),
    [props.designations],
  )

  const selfEmpCode = props.mode === "edit" ? props.employee.emp_code : null
  const initialRmEmpCode =
    props.mode === "edit" ? props.employee.rm_emp_code : null

  // Manager options: active employees minus self. If editing and the stored
  // rm_emp_code points to someone not in the active list (e.g. inactive),
  // surface a synthetic row so the current value stays visible & selectable.
  const managerOptions: ComboboxOption[] = React.useMemo(() => {
    const base = props.managers
      .filter((m) => m.emp_code !== selfEmpCode)
      .map((m) => ({
        value: m.id,
        label: m.emp_display_name,
        sublabel: m.emp_code,
      }))
    if (
      initialRmEmpCode &&
      !props.managers.some((m) => m.emp_code === initialRmEmpCode)
    ) {
      base.unshift({
        value: -1,
        label: initialRmEmpCode,
        sublabel: "current",
      })
    }
    return base
  }, [props.managers, selfEmpCode, initialRmEmpCode])

  const rmEmpCodeToId = React.useCallback(
    (empCode: string): number | null => {
      if (!empCode) return null
      const found = props.managers.find((m) => m.emp_code === empCode)
      if (found) return found.id
      if (empCode === initialRmEmpCode) return -1
      return null
    },
    [props.managers, initialRmEmpCode],
  )

  const rmIdToEmpCode = React.useCallback(
    (id: number | null): string => {
      if (id === null) return ""
      if (id === -1) return initialRmEmpCode ?? ""
      return props.managers.find((m) => m.id === id)?.emp_code ?? ""
    },
    [props.managers, initialRmEmpCode],
  )

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      emp_code: values.emp_code,
      emp_display_name: values.emp_display_name,
      gender: values.gender,
      department_id: values.department_id,
      designation_id: values.designation_id,
      mobile_number: values.mobile_number,
      country_code: values.country_code,
      email: values.email,
      rm_emp_code: values.rm_emp_code === "" ? null : values.rm_emp_code,
    }

    try {
      if (props.mode === "create") {
        const created = await createEmployee(payload)
        props.onSaved(created)
      } else {
        const updated = await updateEmployee(props.employee.id, payload)
        props.onSaved(updated)
      }
    } catch (err) {
      toast.error(
        props.mode === "create"
          ? "Couldn't create employee"
          : "Couldn't update employee",
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
            ? "Create employee"
            : `Edit ${props.employee.emp_display_name}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a new employee record."
            : "Update the employee details."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee code" error={errors.emp_code?.message} htmlFor="e-code" required>
            <Input
              id="e-code"
              autoComplete="off"
              className="uppercase font-mono"
              {...register("emp_code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const upper = e.target.value.toUpperCase()
                  if (upper !== e.target.value) e.target.value = upper
                },
              })}
            />
          </Field>

          <Field
            label="Display name"
            error={errors.emp_display_name?.message}
            htmlFor="e-name"
            required
          >
            <Input id="e-name" autoComplete="off" {...register("emp_display_name")} />
          </Field>

          <Field label="Gender" error={errors.gender?.message} htmlFor="e-gender" required>
            <select id="e-gender" {...register("gender")} className={selectClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Department"
            error={errors.department_id?.message}
            htmlFor="e-dept"
            required
          >
            <Controller
              control={control}
              name="department_id"
              render={({ field, fieldState }) => (
                <Combobox
                  id="e-dept"
                  value={field.value || null}
                  options={departmentOptions}
                  onChange={(v) => field.onChange(v ?? 0)}
                  placeholder="Select a department"
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments match"
                  disabled={departmentOptions.length === 0}
                  invalid={!!fieldState.error}
                />
              )}
            />
          </Field>

          <Field
            label="Designation"
            error={errors.designation_id?.message}
            htmlFor="e-desig"
            required
          >
            <Controller
              control={control}
              name="designation_id"
              render={({ field, fieldState }) => (
                <Combobox
                  id="e-desig"
                  value={field.value || null}
                  options={designationOptions}
                  onChange={(v) => field.onChange(v ?? 0)}
                  placeholder="Select a designation"
                  searchPlaceholder="Search designations…"
                  emptyMessage="No designations match"
                  disabled={designationOptions.length === 0}
                  invalid={!!fieldState.error}
                />
              )}
            />
          </Field>

          <Field label="Email" error={errors.email?.message} htmlFor="e-email" required>
            <Input
              id="e-email"
              autoComplete="off"
              type="email"
              {...register("email")}
            />
          </Field>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Mobile
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </Label>
            <div className="flex gap-2">
              <div className="w-24">
                <Input
                  aria-label="Country code"
                  className="font-mono"
                  placeholder="91"
                  {...register("country_code")}
                />
              </div>
              <div className="flex-1">
                <Input
                  aria-label="Mobile number"
                  className="font-mono"
                  inputMode="numeric"
                  {...register("mobile_number")}
                />
              </div>
            </div>
            {(errors.country_code?.message || errors.mobile_number?.message) && (
              <p className="text-xs text-destructive">
                {errors.country_code?.message ?? errors.mobile_number?.message}
              </p>
            )}
          </div>

          <Field
            label="Reporting manager"
            error={errors.rm_emp_code?.message}
            htmlFor="e-rm"
            hint="Leave blank if none."
          >
            <Controller
              control={control}
              name="rm_emp_code"
              render={({ field, fieldState }) => (
                <div className="flex items-center gap-2">
                  <Combobox
                    id="e-rm"
                    value={rmEmpCodeToId(field.value)}
                    options={managerOptions}
                    onChange={(v) => field.onChange(rmIdToEmpCode(v))}
                    placeholder="No reporting manager"
                    searchPlaceholder="Search by name or emp code…"
                    emptyMessage="No employees match"
                    clearLabel="No reporting manager"
                    disabled={managerOptions.length === 0}
                    invalid={!!fieldState.error}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => field.onChange("")}
                    disabled={!field.value}
                    title="Clear reporting manager"
                    aria-label="Clear reporting manager"
                  >
                    <X />
                  </Button>
                </div>
              )}
            />
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
              ? "Create employee"
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

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
