import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
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
  Eye,
  Filter,
  GraduationCap,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SearchX,
  Users,
  X,
} from "lucide-react"

import { AccountStatusBadge } from "@/components/account-status-badge"
import {
  SendInvitesDialog,
  type SendInvitesTarget,
} from "@/components/send-invites-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { AccountStatusView } from "@/lib/account-invites"
import { ApiError } from "@/lib/api"
import { listAdmissionYears, type AdmissionYear } from "@/lib/admission-years"
import { listProgrammes, type Programme } from "@/lib/programmes"
import {
  BLOOD_GROUPS,
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  GENDERS,
  GENDER_LABELS,
  activateStudent,
  createStudent,
  deactivateStudent,
  listStudents,
  updateStudent,
  type BloodGroup,
  type EntryType,
  type Gender,
  type ListStudentsParams,
  type Student,
  type StudentStatusFilter,
  type StudentsSortField,
  type StudentsSortOrder,
} from "@/lib/students"

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
  | { kind: "edit"; student: Student }

export function StudentsPage() {
  const [students, setStudents] = React.useState<Student[]>([])
  const [accountStatus, setAccountStatus] = React.useState<
    Record<number, AccountStatusView>
  >({})
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })
  const [confirmTarget, setConfirmTarget] = React.useState<Student | null>(null)
  const navigate = useNavigate()

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [searchRowOpen, setSearchRowOpen] = React.useState(false)

  // Row selection lives here rather than in the table so the toolbar can show
  // the count. Reset on every reload — see the note in load().
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [inviteTarget, setInviteTarget] =
    React.useState<SendInvitesTarget | null>(null)

  const [pendingStatus, setPendingStatus] = React.useState<
    StudentStatusFilter | undefined
  >(undefined)
  const [pendingGender, setPendingGender] = React.useState<Gender | undefined>(
    undefined,
  )
  const [pendingEntryType, setPendingEntryType] = React.useState<
    EntryType | undefined
  >(undefined)
  const [pendingBloodGroup, setPendingBloodGroup] = React.useState<
    BloodGroup | undefined
  >(undefined)
  const [pendingProgrammeId, setPendingProgrammeId] = React.useState<
    number | undefined
  >(undefined)
  const [pendingAdmissionYearId, setPendingAdmissionYearId] = React.useState<
    number | undefined
  >(undefined)

  const [status, setStatus] = React.useState<StudentStatusFilter | undefined>(
    undefined,
  )
  const [gender, setGender] = React.useState<Gender | undefined>(undefined)
  const [entryType, setEntryType] = React.useState<EntryType | undefined>(
    undefined,
  )
  const [bloodGroup, setBloodGroup] = React.useState<BloodGroup | undefined>(
    undefined,
  )
  const [programmeId, setProgrammeId] = React.useState<number | undefined>(
    undefined,
  )
  const [admissionYearId, setAdmissionYearId] = React.useState<
    number | undefined
  >(undefined)

  type ColumnSearchState = {
    student_id: string
    display_name: string
    email: string
    mobile_number: string
    abc_id: string
  }
  const emptyColumnSearch: ColumnSearchState = {
    student_id: "",
    display_name: "",
    email: "",
    mobile_number: "",
    abc_id: "",
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
      setPendingEntryType(entryType)
      setPendingBloodGroup(bloodGroup)
      setPendingProgrammeId(programmeId)
      setPendingAdmissionYearId(admissionYearId)
    }
  }, [
    filterPanelOpen,
    status,
    gender,
    entryType,
    bloodGroup,
    programmeId,
    admissionYearId,
  ])

  React.useEffect(() => {
    if (!searchRowOpen) {
      setColumnSearch(emptyColumnSearch)
      setAppliedColumnSearch(emptyColumnSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRowOpen])

  const handleColumnSearchChange = React.useCallback(
    (column: keyof ColumnSearchState, value: string) => {
      setColumnSearch((prev) => ({ ...prev, [column]: value }))
    },
    [],
  )

  const applyColumnSearch = () => {
    const next: ColumnSearchState = {
      student_id: columnSearch.student_id.trim(),
      display_name: columnSearch.display_name.trim(),
      email: columnSearch.email.trim(),
      mobile_number: columnSearch.mobile_number.trim(),
      abc_id: columnSearch.abc_id.trim(),
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
    setEntryType(pendingEntryType)
    setBloodGroup(pendingBloodGroup)
    setProgrammeId(pendingProgrammeId)
    setAdmissionYearId(pendingAdmissionYearId)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const resetFilters = () => {
    setPendingStatus(undefined)
    setPendingGender(undefined)
    setPendingEntryType(undefined)
    setPendingBloodGroup(undefined)
    setPendingProgrammeId(undefined)
    setPendingAdmissionYearId(undefined)
    setStatus(undefined)
    setGender(undefined)
    setEntryType(undefined)
    setBloodGroup(undefined)
    setProgrammeId(undefined)
    setAdmissionYearId(undefined)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filtersDirty =
    pendingStatus !== status ||
    pendingGender !== gender ||
    pendingEntryType !== entryType ||
    pendingBloodGroup !== bloodGroup ||
    pendingProgrammeId !== programmeId ||
    pendingAdmissionYearId !== admissionYearId
  const columnSearchDirty =
    columnSearch.student_id.trim() !== appliedColumnSearch.student_id ||
    columnSearch.display_name.trim() !== appliedColumnSearch.display_name ||
    columnSearch.email.trim() !== appliedColumnSearch.email ||
    columnSearch.mobile_number.trim() !== appliedColumnSearch.mobile_number ||
    columnSearch.abc_id.trim() !== appliedColumnSearch.abc_id
  const columnSearchHasInput =
    !!columnSearch.student_id ||
    !!columnSearch.display_name ||
    !!columnSearch.email ||
    !!columnSearch.mobile_number ||
    !!columnSearch.abc_id

  const activeFilterCount =
    (status ? 1 : 0) +
    (gender ? 1 : 0) +
    (entryType ? 1 : 0) +
    (bloodGroup ? 1 : 0) +
    (programmeId ? 1 : 0) +
    (admissionYearId ? 1 : 0) +
    (appliedColumnSearch.student_id ? 1 : 0) +
    (appliedColumnSearch.display_name ? 1 : 0) +
    (appliedColumnSearch.email ? 1 : 0) +
    (appliedColumnSearch.mobile_number ? 1 : 0) +
    (appliedColumnSearch.abc_id ? 1 : 0)

  const queryParams = React.useMemo<ListStudentsParams>(() => {
    const head = sorting[0]
    const sortBy: StudentsSortField =
      (head?.id as StudentsSortField | undefined) ?? "created_at"
    const sortOrder: StudentsSortOrder = head
      ? head.desc
        ? "desc"
        : "asc"
      : "desc"
    return {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      studentIdSearch: appliedColumnSearch.student_id || undefined,
      displayNameSearch: appliedColumnSearch.display_name || undefined,
      emailSearch: appliedColumnSearch.email || undefined,
      mobileSearch: appliedColumnSearch.mobile_number || undefined,
      abcIdSearch: appliedColumnSearch.abc_id || undefined,
      status,
      gender,
      entryType,
      bloodGroup,
      programmeId,
      admissionYearId,
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    appliedColumnSearch,
    status,
    gender,
    entryType,
    bloodGroup,
    programmeId,
    admissionYearId,
  ])

  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await listStudents(queryParams)
      if (!isLatest()) return
      setStudents(result.rows)
      setAccountStatus(result.account_status ?? {})
      // Selection is dropped on every reload — a filter, sort or page change.
      // Carrying it across would mean the admin can send to rows they can no
      // longer see, and the header checkbox only ever covers the visible page,
      // so the count would stop matching what is on screen. "Invite whole
      // batch" is the deliberate path for anything larger than one page.
      setSelectedIds(new Set())
      setTotal(result.total)
      setPageCount(result.pageCount)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load students", {
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

  const [programmes, setProgrammes] = React.useState<Programme[]>([])
  const [admissionYears, setAdmissionYears] = React.useState<AdmissionYear[]>([])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [progs, years] = await Promise.all([
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
        ])
        if (cancelled) return
        setProgrammes(progs.rows)
        setAdmissionYears(years.rows)
      } catch {
        // Non-fatal: filter/form selects will just be empty.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const requestToggleActive = (student: Student) => setConfirmTarget(student)

  const handleToggleActive = async (student: Student) => {
    setBusyId(student.id)
    try {
      const updated = student.is_active
        ? await deactivateStudent(student.id)
        : await activateStudent(student.id)
      toast.success(
        `${updated.display_name} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update student status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const toggleRow = React.useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleAllOnPage = React.useCallback(
    (ids: number[], checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (checked) next.add(id)
          else next.delete(id)
        }
        return next
      })
    },
    [],
  )

  // A whole-batch send needs both filters applied; the server keys the batch on
  // exactly this pair.
  const batchReady = programmeId !== undefined && admissionYearId !== undefined
  const batchLabel = React.useMemo(() => {
    const p = programmes.find((x) => x.id === programmeId)
    const y = admissionYears.find((x) => x.id === admissionYearId)
    return [p?.code ?? p?.name, y?.display_year].filter(Boolean).join(" · ")
  }, [programmes, admissionYears, programmeId, admissionYearId])

  const handleSaved = async (updated: Student, kind: "create" | "edit") => {
    setMode({ kind: "list" })
    toast.success(
      kind === "create"
        ? `${updated.display_name} created.`
        : `${updated.display_name} updated.`,
    )
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <h1 className="text-base font-semibold tracking-tight">Students</h1>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={mode.kind !== "list"}
          >
            <Plus />
            New student
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Mail />
                Invites
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onSelect={() =>
                  setInviteTarget({
                    kind: "ids",
                    ids: [...selectedIds],
                    resend: false,
                  })
                }
              >
                <Mail />
                Send invites ({selectedIds.size})
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onSelect={() =>
                  setInviteTarget({
                    kind: "ids",
                    ids: [...selectedIds],
                    resend: true,
                  })
                }
              >
                <RefreshCw />
                Resend to selected ({selectedIds.size})
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!batchReady}
                title={
                  batchReady
                    ? undefined
                    : "Pick a programme and admission year in Filters first"
                }
                onSelect={() => {
                  if (programmeId === undefined) return
                  if (admissionYearId === undefined) return
                  setInviteTarget({
                    kind: "batch",
                    filter: {
                      programme_id: programmeId,
                      admission_year_id: admissionYearId,
                    },
                    label: batchLabel,
                  })
                }}
              >
                <Users />
                Invite whole batch…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <StudentForm
              mode="create"
              programmes={programmes}
              admissionYears={admissionYears}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(s) => handleSaved(s, "create")}
            />
          )}

          {mode.kind === "edit" && (
            <StudentForm
              mode="edit"
              student={mode.student}
              programmes={programmes}
              admissionYears={admissionYears}
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
            pendingGender={pendingGender}
            pendingEntryType={pendingEntryType}
            pendingBloodGroup={pendingBloodGroup}
            pendingProgrammeId={pendingProgrammeId}
            pendingAdmissionYearId={pendingAdmissionYearId}
            programmes={programmes}
            admissionYears={admissionYears}
            onPendingStatusChange={setPendingStatus}
            onPendingGenderChange={setPendingGender}
            onPendingEntryTypeChange={setPendingEntryType}
            onPendingBloodGroupChange={setPendingBloodGroup}
            onPendingProgrammeIdChange={setPendingProgrammeId}
            onPendingAdmissionYearIdChange={setPendingAdmissionYearId}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setFilterPanelOpen(false)}
            applyDisabled={!filtersDirty}
            resetDisabled={
              !status &&
              !gender &&
              !entryType &&
              !bloodGroup &&
              !programmeId &&
              !admissionYearId &&
              !pendingStatus &&
              !pendingGender &&
              !pendingEntryType &&
              !pendingBloodGroup &&
              !pendingProgrammeId &&
              !pendingAdmissionYearId
            }
          />
        )}

        <div className="min-w-0 flex-1 rounded-lg border bg-card text-card-foreground">
          <StudentsTable
            students={students}
            accountStatus={accountStatus}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAllOnPage={toggleAllOnPage}
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
              !appliedColumnSearch.student_id &&
              !appliedColumnSearch.display_name &&
              !appliedColumnSearch.email &&
              !appliedColumnSearch.mobile_number &&
              !appliedColumnSearch.abc_id
            }
            hasActiveFilters={activeFilterCount > 0}
            onOpenFilters={() => setFilterPanelOpen(true)}
            onResetFilters={resetFilters}
            loadFailed={loadFailed}
            onRetry={() => void load()}
            onEdit={(s) => setMode({ kind: "edit", student: s })}
            onToggleActive={requestToggleActive}
            onViewDetails={(s) =>
              navigate({
                to: "/students/$studentId",
                params: { studentId: String(s.id) },
              })
            }
          />
        </div>
      </div>

      <SendInvitesDialog
        open={!!inviteTarget}
        onOpenChange={(open) => {
          if (!open) setInviteTarget(null)
        }}
        subjectType="student"
        target={inviteTarget}
        onSent={() => void load()}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={
          confirmTarget?.is_active
            ? "Deactivate student?"
            : "Activate student?"
        }
        description={
          confirmTarget ? (
            <>
              {confirmTarget.is_active
                ? "Deactivated students won't be selectable in dependent records."
                : "Reactivated students become available again."}
              <div className="mt-2 font-medium text-foreground">
                {confirmTarget.display_name}{" "}
                <span className="text-muted-foreground">
                  ({confirmTarget.student_id})
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
  pendingEntryType,
  pendingBloodGroup,
  pendingProgrammeId,
  pendingAdmissionYearId,
  programmes,
  admissionYears,
  onPendingStatusChange,
  onPendingGenderChange,
  onPendingEntryTypeChange,
  onPendingBloodGroupChange,
  onPendingProgrammeIdChange,
  onPendingAdmissionYearIdChange,
  onApply,
  onReset,
  onClose,
  applyDisabled,
  resetDisabled,
}: {
  pendingStatus: StudentStatusFilter | undefined
  pendingGender: Gender | undefined
  pendingEntryType: EntryType | undefined
  pendingBloodGroup: BloodGroup | undefined
  pendingProgrammeId: number | undefined
  pendingAdmissionYearId: number | undefined
  programmes: Programme[]
  admissionYears: AdmissionYear[]
  onPendingStatusChange: (v: StudentStatusFilter | undefined) => void
  onPendingGenderChange: (v: Gender | undefined) => void
  onPendingEntryTypeChange: (v: EntryType | undefined) => void
  onPendingBloodGroupChange: (v: BloodGroup | undefined) => void
  onPendingProgrammeIdChange: (v: number | undefined) => void
  onPendingAdmissionYearIdChange: (v: number | undefined) => void
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
        {/* Programme and admission year lead: together they identify a cohort,
            which is how admins actually narrow this list. */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-programme">Programme</Label>
          <Combobox
            id="filter-programme"
            value={pendingProgrammeId ?? null}
            options={programmes.map((p) => ({
              value: p.id,
              label: p.name,
              sublabel: p.code,
            }))}
            onChange={(v) => onPendingProgrammeIdChange(v ?? undefined)}
            placeholder="All programmes"
            searchPlaceholder="Search programmes…"
            emptyMessage="No programmes match"
            clearLabel="All programmes"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-admission-year">Admission year</Label>
          <Combobox
            id="filter-admission-year"
            value={pendingAdmissionYearId ?? null}
            options={admissionYears.map((y) => ({
              value: y.id,
              label: y.display_year,
              sublabel: String(y.year),
            }))}
            onChange={(v) => onPendingAdmissionYearIdChange(v ?? undefined)}
            placeholder="All admission years"
            searchPlaceholder="Search years…"
            emptyMessage="No years match"
            clearLabel="All admission years"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            value={pendingStatus ?? ""}
            onChange={(e) =>
              onPendingStatusChange(
                e.target.value === ""
                  ? undefined
                  : (e.target.value as StudentStatusFilter),
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
          <Label htmlFor="filter-entry-type">Entry type</Label>
          <select
            id="filter-entry-type"
            value={pendingEntryType ?? ""}
            onChange={(e) =>
              onPendingEntryTypeChange(
                e.target.value === ""
                  ? undefined
                  : (Number(e.target.value) as EntryType),
              )
            }
            className={selectClass}
          >
            <option value="">All</option>
            {ENTRY_TYPES.map((et) => (
              <option key={et} value={et}>
                {ENTRY_TYPE_LABELS[et]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-blood-group">Blood group</Label>
          <select
            id="filter-blood-group"
            value={pendingBloodGroup ?? ""}
            onChange={(e) =>
              onPendingBloodGroupChange(
                e.target.value === ""
                  ? undefined
                  : (e.target.value as BloodGroup),
              )
            }
            className={selectClass}
          >
            <option value="">All</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
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
  student_id: string
  display_name: string
  email: string
  mobile_number: string
  abc_id: string
}

function StudentsTable({
  students,
  accountStatus,
  selectedIds,
  onToggleRow,
  onToggleAllOnPage,
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
  onViewDetails,
}: {
  students: Student[]
  accountStatus: Record<number, AccountStatusView>
  selectedIds: Set<number>
  onToggleRow: (id: number, checked: boolean) => void
  onToggleAllOnPage: (ids: number[], checked: boolean) => void
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
  onEdit: (s: Student) => void
  onToggleActive: (s: Student) => void
  onViewDetails: (s: Student) => void
}) {
  const pageIds = React.useMemo(() => students.map((s) => s.id), [students])
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length

  const columns = React.useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        // The only sticky-left column: STICKY_LEFT_CELL pins with a bare
        // `left-0`, so a second one would sit on top of this. The checkbox is
        // the better thing to keep in view while scrolling sideways.
        meta: { sticky: "left" as const },
        header: () => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={pageIds.length > 0 && selectedOnPage === pageIds.length}
            indeterminate={
              selectedOnPage > 0 && selectedOnPage < pageIds.length
            }
            disabled={pageIds.length === 0}
            onChange={(e) => onToggleAllOnPage(pageIds, e.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.display_name}`}
            checked={selectedIds.has(row.original.id)}
            onChange={(e) => onToggleRow(row.original.id, e.target.checked)}
          />
        ),
      },
      {
        id: "student_id",
        header: "Student ID",
        accessorKey: "student_id",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "display_name",
        header: "Name",
        accessorKey: "display_name",
        cell: ({ getValue }) => (
          <div className="font-medium">{String(getValue() ?? "")}</div>
        ),
      },
      {
        id: "programme",
        header: "Programme",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.programme?.code ?? "—"}
          </span>
        ),
      },
      {
        id: "admission_year",
        header: "Admission",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.admission_year?.display_year ?? "—"}
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
        id: "entry_type",
        header: "Entry type",
        accessorKey: "entry_type",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {ENTRY_TYPE_LABELS[row.original.entry_type] ?? "—"}
          </span>
        ),
      },
      {
        id: "mobile_number",
        header: "Mobile",
        accessorKey: "mobile_number",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {row.original.mobile_number}
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
        id: "abc_id",
        header: "ABC ID",
        accessorKey: "abc_id",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {v ?? "—"}
            </span>
          )
        },
      },
      {
        id: "dob",
        header: "DOB",
        accessorKey: "dob",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {v ?? "—"}
            </span>
          )
        },
      },
      {
        id: "account_status",
        header: "Account",
        // Sorting would need the server to ORDER BY across the invite join —
        // out of scope for the column.
        enableSorting: false,
        cell: ({ row }) => (
          <AccountStatusBadge status={accountStatus[row.original.id]} />
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
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: { align: "right" as const, sticky: "right" as const },
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    disabled={formOpen || isBusy}
                    title="More actions"
                    aria-label="More actions"
                  >
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => onViewDetails(s)}>
                    <Eye />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onToggleActive(s)}
                    className={cn(
                      s.is_active
                        ? "text-destructive data-[highlighted]:text-destructive"
                        : "text-success data-[highlighted]:text-success",
                    )}
                  >
                    {s.is_active ? <PowerOff /> : <Power />}
                    {toggleLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [
      busyId,
      formOpen,
      onEdit,
      onToggleActive,
      onViewDetails,
      accountStatus,
      selectedIds,
      pageIds,
      selectedOnPage,
      onToggleRow,
      onToggleAllOnPage,
    ],
  )

  const table = useReactTable({
    data: students,
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
    student_id: "student_id",
    display_name: "display_name",
    email: "email",
    mobile_number: "mobile_number",
    abc_id: "abc_id",
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
                    student_id: "w-24",
                    display_name: "w-40",
                    programme: "w-24",
                    admission_year: "w-20",
                    gender: "w-16",
                    entry_type: "w-20",
                    mobile_number: "w-28",
                    email: "w-48",
                    abc_id: "w-28",
                    dob: "w-24",
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
                          id === "status" ||
                            id === "gender" ||
                            id === "entry_type"
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
                    title="Couldn't load students"
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
                    description="No students match the current filters."
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
                    icon={GraduationCap}
                    title="No students yet"
                    description="Create the first student to get started."
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

const studentIdField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(32, "Too long")
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]+$/, "Use letters and numbers only"),
  )

const studentSchema = z.object({
  student_id: studentIdField,
  display_name: z.string().trim().min(1, "Name is required").max(128, "Too long"),
  gender: z.enum(GENDERS, { message: "Select a gender" }),
  entry_type: z.coerce
    .number({ message: "Select an entry type" })
    .int()
    .refine(
      (v) => (ENTRY_TYPES as readonly number[]).includes(v),
      "Select an entry type",
    ),
  programme_id: z
    .number({ message: "Select a programme" })
    .int()
    .positive("Select a programme"),
  admission_year_id: z
    .number({ message: "Select an admission year" })
    .int()
    .positive("Select an admission year"),
  email: z
    .string()
    .trim()
    .min(1, "Required")
    .max(255, "Too long")
    .email("Enter a valid email")
    .transform((v) => v.toLowerCase()),
  mobile_number: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  dob: z
    .string()
    .trim()
    .min(1, "Date of birth is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  // Optional fields: keep them as plain strings so RHF + zodResolver stay happy
  // (Zod's z.infer would otherwise split input/output types). The submit
  // handler converts "" → null before sending to the API.
  blood_group: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (BLOOD_GROUPS as readonly string[]).includes(v),
      "Pick a blood group",
    ),
  abc_id: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{12}$/.test(v),
      "ABC ID must be exactly 12 digits",
    ),
})

// `entry_type` is registered on a <select>, so the form holds the string the DOM
// gives it and the schema coerces. That makes the schema's INPUT type (what the
// form fields hold) genuinely different from its OUTPUT type (what a validated
// submit produces) — `z.coerce.number()` accepts unknown and yields number — so
// the two are named separately and handed to useForm's input/output generics.
// Collapsing them with a single `z.infer` is what broke the production build:
// zodResolver is typed on the input, useForm was typed on the output.
type StudentFormInput = z.input<typeof studentSchema>
type StudentFormValues = z.output<typeof studentSchema>

function StudentForm(
  props: (
    | { mode: "create" }
    | { mode: "edit"; student: Student }
  ) & {
    programmes: Programme[]
    admissionYears: AdmissionYear[]
    onCancel: () => void
    onSaved: (s: Student) => void
  },
) {
  const defaults: StudentFormValues =
    props.mode === "edit"
      ? {
          student_id: props.student.student_id,
          display_name: props.student.display_name,
          gender: props.student.gender,
          entry_type: props.student.entry_type,
          programme_id: props.student.programme_id,
          admission_year_id: props.student.admission_year_id,
          email: props.student.email,
          mobile_number: props.student.mobile_number,
          dob: props.student.dob ?? "",
          blood_group: props.student.blood_group ?? "",
          abc_id: props.student.abc_id ?? "",
        }
      : {
          student_id: "",
          display_name: "",
          gender: "male",
          entry_type: 1,
          programme_id: 0,
          admission_year_id: 0,
          email: "",
          mobile_number: "",
          dob: "",
          blood_group: "",
          abc_id: "",
        }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StudentFormInput, unknown, StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const programmeOptions: ComboboxOption[] = React.useMemo(
    () =>
      props.programmes.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.code,
      })),
    [props.programmes],
  )

  const admissionYearOptions: ComboboxOption[] = React.useMemo(
    () =>
      props.admissionYears.map((y) => ({
        value: y.id,
        label: y.display_year,
        sublabel: String(y.year),
      })),
    [props.admissionYears],
  )

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      student_id: values.student_id,
      programme_id: values.programme_id,
      admission_year_id: values.admission_year_id,
      display_name: values.display_name,
      gender: values.gender,
      entry_type: values.entry_type as EntryType,
      dob: values.dob,
      blood_group:
        values.blood_group === "" ? null : (values.blood_group as BloodGroup),
      abc_id: values.abc_id === "" ? null : values.abc_id,
      mobile_number: values.mobile_number,
      email: values.email,
    }

    try {
      if (props.mode === "create") {
        const created = await createStudent(payload)
        props.onSaved(created)
      } else {
        const updated = await updateStudent(props.student.id, payload)
        props.onSaved(updated)
      }
    } catch (err) {
      toast.error(
        props.mode === "create"
          ? "Couldn't create student"
          : "Couldn't update student",
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
            ? "Create student"
            : `Edit ${props.student.display_name}`}
        </SheetTitle>
        <SheetDescription>
          {props.mode === "create"
            ? "Add a new student record."
            : "Update the student details."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Student ID"
            error={errors.student_id?.message}
            htmlFor="s-id"
            required
          >
            <Input
              id="s-id"
              autoComplete="off"
              className="uppercase font-mono"
              {...register("student_id", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const upper = e.target.value.toUpperCase()
                  if (upper !== e.target.value) e.target.value = upper
                },
              })}
            />
          </Field>

          <Field
            label="Display name"
            error={errors.display_name?.message}
            htmlFor="s-name"
            required
          >
            <Input id="s-name" autoComplete="off" {...register("display_name")} />
          </Field>

          <Field
            label="Programme"
            error={errors.programme_id?.message}
            htmlFor="s-prog"
            required
          >
            <Controller
              control={control}
              name="programme_id"
              render={({ field, fieldState }) => (
                <Combobox
                  id="s-prog"
                  value={field.value || null}
                  options={programmeOptions}
                  onChange={(v) => field.onChange(v ?? 0)}
                  placeholder="Select a programme"
                  searchPlaceholder="Search programmes…"
                  emptyMessage="No programmes match"
                  disabled={programmeOptions.length === 0}
                  invalid={!!fieldState.error}
                />
              )}
            />
          </Field>

          <Field
            label="Admission year"
            error={errors.admission_year_id?.message}
            htmlFor="s-year"
            required
          >
            <Controller
              control={control}
              name="admission_year_id"
              render={({ field, fieldState }) => (
                <Combobox
                  id="s-year"
                  value={field.value || null}
                  options={admissionYearOptions}
                  onChange={(v) => field.onChange(v ?? 0)}
                  placeholder="Select an admission year"
                  searchPlaceholder="Search years…"
                  emptyMessage="No years match"
                  disabled={admissionYearOptions.length === 0}
                  invalid={!!fieldState.error}
                />
              )}
            />
          </Field>

          <Field label="Gender" error={errors.gender?.message} htmlFor="s-gender" required>
            <select id="s-gender" {...register("gender")} className={selectClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Entry type"
            error={errors.entry_type?.message}
            htmlFor="s-entry-type"
            required
          >
            <select
              id="s-entry-type"
              {...register("entry_type")}
              className={selectClass}
            >
              {ENTRY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {ENTRY_TYPE_LABELS[et]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Date of birth"
            error={errors.dob?.message}
            htmlFor="s-dob"
            required
          >
            <Controller
              control={control}
              name="dob"
              render={({ field, fieldState }) => (
                <DatePicker
                  id="s-dob"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select date of birth"
                  invalid={!!fieldState.error}
                />
              )}
            />
          </Field>

          <Field label="Email" error={errors.email?.message} htmlFor="s-email" required>
            <Input
              id="s-email"
              autoComplete="off"
              type="email"
              {...register("email")}
            />
          </Field>

          <Field
            label="Mobile (10-digit)"
            error={errors.mobile_number?.message}
            htmlFor="s-mobile"
            required
          >
            <Input
              id="s-mobile"
              autoComplete="off"
              className="font-mono"
              inputMode="numeric"
              maxLength={10}
              {...register("mobile_number")}
            />
          </Field>

          <Field
            label="Blood group"
            error={errors.blood_group?.message}
            htmlFor="s-bg"
            hint="Optional"
          >
            <select
              id="s-bg"
              {...register("blood_group")}
              className={selectClass}
            >
              <option value="">—</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="ABC ID"
            error={errors.abc_id?.message}
            htmlFor="s-abc"
            hint="Optional · 12-digit Academic Bank of Credits ID"
          >
            <Input
              id="s-abc"
              autoComplete="off"
              className="font-mono tabular-nums"
              inputMode="numeric"
              maxLength={12}
              {...register("abc_id")}
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
              ? "Create student"
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
