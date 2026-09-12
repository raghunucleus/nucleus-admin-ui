import * as React from "react"
import { createPortal } from "react-dom"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, BookMarked, Pencil, Plus, Search, Users, X } from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { AttendanceGroup } from "@/lib/attendance-groups"
import { useEmployeeSearch } from "@/lib/employee-search"
import { type Employee } from "@/lib/employees"
import {
  listProgrammeSemesters,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  getFacultyMatrix,
  listProgrammeSemesterSubjects,
  setProgrammeSemesterSubjectGroupFaculty,
  setProgrammeSemesterSubjectOptionFaculty,
  type FacultyMatrixResult,
  type ProgrammeSemesterSubject,
  type ProgrammeSemesterSubjectGroupFacultyCell,
  type ProgrammeSemesterSubjectOption,
} from "@/lib/programme-semester-subjects"

function cellKey(subjectId: number, groupId: number): string {
  return `${subjectId}-${groupId}`
}

function electiveLabel(e: ProgrammeSemesterSubject): string {
  return e.placeholder_name ?? "(unnamed slot)"
}

function initials(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

// Faculty configuration: a matrix of attendance groups (rows) × real subjects
// (columns), one teacher per cell. Each (subject, group) pair gets a single
// primary teacher; associates / co-teachers are a future addition that will
// live in a separate table. Elective slot candidate faculty is kept here as
// a legacy section — that flow will migrate into student-allocation later.
export function SemesterFacultyPage() {
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const id = Number(params.programmeSemesterId)
  const { programmeId, admissionYearId } = search

  const [semester, setSemester] = React.useState<ProgrammeSemester | null>(null)
  const [shellLoading, setShellLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  const [matrix, setMatrix] = React.useState<FacultyMatrixResult | null>(null)
  const [electiveEntries, setElectiveEntries] = React.useState<
    ProgrammeSemesterSubject[]
  >([])
  const [dataLoading, setDataLoading] = React.useState(true)

  const [savingKeys, setSavingKeys] = React.useState<Set<string>>(new Set())

  const loadShell = React.useCallback(async () => {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      programmeId === undefined ||
      admissionYearId === undefined
    ) {
      setShellLoading(false)
      setFailed(true)
      return
    }
    setShellLoading(true)
    setFailed(false)
    try {
      const res = await listProgrammeSemesters({
        programmeId,
        admissionYearId,
        pageSize: 100,
        sortBy: "semester",
        sortOrder: "asc",
      })
      const row = res.rows.find((r) => r.id === id) ?? null
      if (!row) {
        setFailed(true)
        return
      }
      setSemester(row)
    } catch {
      setFailed(true)
    } finally {
      setShellLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void loadShell()
  }, [loadShell])

  const loadData = React.useCallback(async () => {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      programmeId === undefined ||
      admissionYearId === undefined
    ) {
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    try {
      const [m, all] = await Promise.all([
        getFacultyMatrix({
          programmeSemesterId: id,
          programmeId,
          admissionYearId,
        }),
        listProgrammeSemesterSubjects({
          programmeSemesterId: id,
          pageSize: 100,
          sortBy: "created_at",
          sortOrder: "asc",
        }),
      ])
      setMatrix(m)
      setElectiveEntries(all.rows.filter((r) => r.subject_id === null))
    } catch (err) {
      toast.error("Couldn't load faculty configuration", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setDataLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const cellByKey = React.useMemo(() => {
    const map = new Map<string, ProgrammeSemesterSubjectGroupFacultyCell>()
    matrix?.cells.forEach((c) => {
      map.set(cellKey(c.programme_semester_subject_id, c.attendance_group_id), c)
    })
    return map
  }, [matrix])

  const setCellSaving = (key: string, busy: boolean) => {
    setSavingKeys((s) => {
      const n = new Set(s)
      if (busy) n.add(key)
      else n.delete(key)
      return n
    })
  }

  const applyCell = async (
    subjectId: number,
    groupId: number,
    employeeId: number | null,
  ) => {
    const key = cellKey(subjectId, groupId)
    setCellSaving(key, true)
    try {
      const updated = await setProgrammeSemesterSubjectGroupFaculty(
        subjectId,
        groupId,
        employeeId,
      )
      setMatrix(updated)
    } catch (err) {
      toast.error("Couldn't update faculty", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setCellSaving(key, false)
    }
  }

  const applyOptionFaculty = async (
    optionId: number,
    parentEntryId: number,
    employeeIds: number[],
  ) => {
    const key = `o${optionId}`
    setCellSaving(key, true)
    try {
      const updated = await setProgrammeSemesterSubjectOptionFaculty(
        optionId,
        employeeIds,
      )
      setElectiveEntries((prev) =>
        prev.map((e) => (e.id === parentEntryId ? updated : e)),
      )
    } catch (err) {
      toast.error("Couldn't update faculty", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setCellSaving(key, false)
    }
  }

  const cellCount = matrix
    ? matrix.subjects.filter((s) => s.is_active).length *
      matrix.groups.filter((g) => g.is_active).length
    : 0
  const assignedCount = matrix
    ? matrix.cells.filter((c) => {
        const subj = matrix.subjects.find(
          (s) => s.id === c.programme_semester_subject_id,
        )
        const grp = matrix.groups.find((g) => g.id === c.attendance_group_id)
        return subj?.is_active && grp?.is_active
      }).length
    : 0

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to semester settings">
          <Link
            to="/masters/programme-configuration/semester/$programmeSemesterId"
            params={{ programmeSemesterId: params.programmeSemesterId ?? "" }}
            search={{ programmeId, admissionYearId }}
          />
        </BackLink>
      }
      title="Faculty allocation"
    />
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      {header}

      {shellLoading ? (
        <FacultySkeleton />
      ) : failed || !semester ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load semester"
            description="This semester could not be found, or it was opened without its programme context. Open it from Programme configuration."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/programme-configuration"
                  search={{ programmeId, admissionYearId }}
                >
                  Back to configuration
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <header className="rounded-lg border bg-card px-5 py-3 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Sem {semester.semester.sem_number}
                </span>
                <span className="opacity-40">·</span>
                <span className="font-medium text-foreground">
                  {semester.programme.code}
                </span>
                <span className="opacity-40">·</span>
                <span className="tabular-nums">
                  {semester.admission_year.display_year}
                </span>
                <span className="opacity-40">·</span>
                <span className="font-mono text-foreground">
                  {semester.semester.code}
                </span>
              </div>
              {!dataLoading && cellCount > 0 && (
                <div className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Assigned{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {assignedCount}/{cellCount}
                  </span>
                </div>
              )}
            </div>
          </header>

          {dataLoading ? (
            <FacultyListSkeleton />
          ) : !matrix ? null : matrix.groups.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
              <EmptyState
                icon={Users}
                title="No attendance groups configured"
                description="Faculty are allocated per group per subject. Create groups for this batch first, then come back here to assign teachers."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/masters/programme-configuration/attendance-groups"
                      search={{ programmeId, admissionYearId }}
                    >
                      Configure attendance groups
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : matrix.subjects.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
              <EmptyState
                icon={BookMarked}
                title="No subjects configured"
                description="Configure subjects for this semester first — faculty are then assigned per group per subject."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/masters/programme-configuration/semester/$programmeSemesterId/subjects"
                      params={{
                        programmeSemesterId:
                          params.programmeSemesterId ?? "",
                      }}
                      search={{ programmeId, admissionYearId }}
                    >
                      Configure subjects
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <FacultyMatrixCard
              subjects={matrix.subjects}
              groups={matrix.groups}
              cellByKey={cellByKey}
              savingKeys={savingKeys}
              onSelect={applyCell}
              onClear={(sid, gid) => applyCell(sid, gid, null)}
            />
          )}

          {!dataLoading && electiveEntries.length > 0 && (
            <ElectiveLegacySection
              entries={electiveEntries}
              savingKeys={savingKeys}
              onApply={applyOptionFaculty}
            />
          )}
        </>
      )}
    </div>
  )
}

// --- matrix ----------------------------------------------------------------

function FacultyMatrixCard({
  subjects,
  groups,
  cellByKey,
  savingKeys,
  onSelect,
  onClear,
}: {
  subjects: ProgrammeSemesterSubject[]
  groups: AttendanceGroup[]
  cellByKey: Map<string, ProgrammeSemesterSubjectGroupFacultyCell>
  savingKeys: Set<string>
  onSelect: (subjectId: number, groupId: number, employeeId: number) => void
  onClear: (subjectId: number, groupId: number) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
        <span className="text-sm font-medium">Subjects × Groups</span>
        <span className="text-xs text-muted-foreground">
          One teacher per group per subject
        </span>
      </div>
      <div className="overflow-x-auto thin-scrollbar">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[180px] border-b border-r bg-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Group
              </th>
              {subjects.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  className={cn(
                    "min-w-[200px] border-b border-r bg-muted px-3 py-2 text-left align-top",
                    !s.is_active && "opacity-60",
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium leading-tight">
                      {s.subject?.name ?? "(unnamed)"}
                    </span>
                    {s.subject?.code && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {s.subject.code}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className={cn(!g.is_active && "opacity-60")}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r bg-card px-3 py-2 text-left align-top"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium leading-tight">
                      {g.name}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {g.code}
                    </span>
                  </div>
                </th>
                {subjects.map((s) => {
                  const key = cellKey(s.id, g.id)
                  const cell = cellByKey.get(key)
                  const disabled = !s.is_active || !g.is_active
                  return (
                    <td
                      key={s.id}
                      className="border-b border-r px-2 py-1.5 align-middle"
                    >
                      <MatrixCell
                        subjectName={s.subject?.name ?? "(unnamed)"}
                        groupName={g.name}
                        cell={cell}
                        saving={savingKeys.has(key)}
                        disabled={disabled}
                        onSelect={(empId) => onSelect(s.id, g.id, empId)}
                        onClear={() => onClear(s.id, g.id)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// One cell of the matrix — shows the assigned teacher as a removable chip, or
// a "+ Assign" pill if empty. Clicking either opens the searchable picker.
function MatrixCell({
  subjectName,
  groupName,
  cell,
  saving,
  disabled,
  onSelect,
  onClear,
}: {
  subjectName: string
  groupName: string
  cell: ProgrammeSemesterSubjectGroupFacultyCell | undefined
  saving: boolean
  disabled?: boolean
  onSelect: (employeeId: number) => void
  onClear: () => void
}) {
  if (cell) {
    return (
      <div className="flex items-center gap-1.5">
        <FacultyChip
          employee={cell.employee}
          onRemove={onClear}
          disabled={saving || disabled}
        />
        <SingleFacultyPicker
          excludeId={cell.employee_id}
          label={
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Pencil className="size-3" />
            </span>
          }
          ariaLabel={`Change teacher for ${subjectName} · ${groupName}`}
          disabled={saving || disabled}
          onSelect={onSelect}
        />
        {saving && (
          <span className="text-[11px] text-muted-foreground">Saving…</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <SingleFacultyPicker
        excludeId={null}
        label={
          <span className="inline-flex items-center gap-1">
            <Plus className="size-3.5" />
            Assign
          </span>
        }
        ariaLabel={`Assign teacher for ${subjectName} · ${groupName}`}
        disabled={saving || disabled}
        onSelect={onSelect}
      />
      {saving && (
        <span className="text-[11px] text-muted-foreground">Saving…</span>
      )}
    </div>
  )
}

// --- elective legacy section -----------------------------------------------

// Elective slot candidate-faculty allocation lives here as a holdover from
// the per-subject roster model. Each elective slot expands into its candidate
// subjects; faculty are still allocated as a multi-faculty roster (associates
// flatten in here today). This whole section will move into the student-
// allocation flow in a future change — the note above makes that explicit.
function ElectiveLegacySection({
  entries,
  savingKeys,
  onApply,
}: {
  entries: ProgrammeSemesterSubject[]
  savingKeys: Set<string>
  onApply: (
    optionId: number,
    parentEntryId: number,
    employeeIds: number[],
  ) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Elective candidate faculty</span>
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
            Legacy
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Per-candidate faculty rosters from the older model. This section will
          move into the student-allocation flow so students see the teacher
          alongside the elective when picking.
        </p>
      </div>
      <div className="divide-y">
        {entries.map((entry) => (
          <ElectiveGroup
            key={entry.id}
            entry={entry}
            savingKeys={savingKeys}
            onApply={(optionId, employeeIds) =>
              onApply(optionId, entry.id, employeeIds)
            }
          />
        ))}
      </div>
    </div>
  )
}

function ElectiveGroup({
  entry,
  savingKeys,
  onApply,
}: {
  entry: ProgrammeSemesterSubject
  savingKeys: Set<string>
  onApply: (optionId: number, employeeIds: number[]) => void
}) {
  return (
    <div className={cn(!entry.is_active && "opacity-60")}>
      <div className="flex items-center gap-3 bg-muted/40 px-4 py-2">
        <span className="text-sm font-medium">{electiveLabel(entry)}</span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
          Elective slot
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {entry.options.length} subject
          {entry.options.length === 1 ? "" : "s"} offered
        </span>
      </div>
      {entry.options.length === 0 ? (
        <div className="px-4 py-3 pl-11 text-xs italic text-muted-foreground">
          No subjects offered yet — add them on the Subjects screen.
        </div>
      ) : (
        <div className="divide-y">
          {entry.options.map((o) => (
            <OptionFacultyRow
              key={o.id}
              option={o}
              saving={savingKeys.has(`o${o.id}`)}
              onAdd={(empId) =>
                onApply(o.id, [
                  ...o.faculty.map((f) => f.employee_id),
                  empId,
                ])
              }
              onRemove={(empId) =>
                onApply(
                  o.id,
                  o.faculty
                    .map((f) => f.employee_id)
                    .filter((id) => id !== empId),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OptionFacultyRow({
  option,
  saving,
  onAdd,
  onRemove,
}: {
  option: ProgrammeSemesterSubjectOption
  saving: boolean
  onAdd: (employeeId: number) => void
  onRemove: (employeeId: number) => void
}) {
  const assignedIds = option.faculty.map((f) => f.employee_id)
  return (
    <div className="px-4 py-3 pl-11 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{option.subject.name}</span>
          {option.subject.code && (
            <span className="font-mono text-xs text-muted-foreground">
              {option.subject.code}
            </span>
          )}
          {saving && (
            <span className="text-[11px] text-muted-foreground">Saving…</span>
          )}
        </div>
        <MultiFacultyPicker
          assignedIds={assignedIds}
          onAdd={onAdd}
          disabled={saving}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {option.faculty.map((f) => (
          <FacultyChip
            key={f.id}
            employee={f.employee}
            onRemove={() => onRemove(f.employee_id)}
            disabled={saving}
          />
        ))}
        {option.faculty.length === 0 && (
          <span className="text-xs italic text-muted-foreground">
            No faculty assigned
          </span>
        )}
      </div>
    </div>
  )
}

// --- shared bits -----------------------------------------------------------

function FacultyChip({
  employee,
  onRemove,
  disabled,
}: {
  employee: Employee
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background py-0.5 pl-0.5 pr-1 text-xs"
      title={`${employee.emp_display_name} · ${employee.emp_code}`}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
        {initials(employee.emp_display_name)}
      </span>
      <span className="font-medium">{employee.emp_display_name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {employee.emp_code}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${employee.emp_display_name}`}
        className="ml-0.5 grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
      >
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  )
}

type PickerPos = {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: "below" | "above"
}

// Used by the matrix cell — commits a single employee and closes immediately
// (one teacher per cell). The trigger label flexes so the same picker can be
// either the "+ Assign" pill (empty cell) or a small change-pencil (when the
// cell already has someone).
function SingleFacultyPicker({
  excludeId,
  label,
  ariaLabel,
  disabled,
  onSelect,
}: {
  excludeId: number | null
  label: React.ReactNode
  ariaLabel: string
  disabled?: boolean
  onSelect: (employeeId: number) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [pos, setPos] = React.useState<PickerPos | null>(null)

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const { rows } = useEmployeeSearch(query)
  const filtered = React.useMemo(
    () => rows.filter((e) => e.id !== excludeId),
    [rows, excludeId],
  )

  const triggerDisabled = disabled

  const reposition = React.useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const margin = 12
    const gap = 6
    const width = Math.max(r.width, 264)
    const spaceBelow = window.innerHeight - r.bottom - margin
    const spaceAbove = r.top - margin
    const placement =
      spaceBelow >= 260 || spaceBelow >= spaceAbove ? "below" : "above"
    const maxHeight = Math.min(
      340,
      Math.max(160, placement === "below" ? spaceBelow - gap : spaceAbove - gap),
    )
    let left = r.left
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width
    }
    setPos({
      left: Math.max(margin, left),
      top: placement === "below" ? r.bottom + gap : r.top - gap,
      width,
      maxHeight,
      placement,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    reposition()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, reposition])

  React.useEffect(() => {
    if (!open) return
    const onChange = () => reposition()
    window.addEventListener("scroll", onChange, true)
    window.addEventListener("resize", onChange)
    return () => {
      window.removeEventListener("scroll", onChange, true)
      window.removeEventListener("resize", onChange)
    }
  }, [open, reposition])

  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const tgt = e.target as Node
      if (triggerRef.current?.contains(tgt)) return
      if (panelRef.current?.contains(tgt)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const activeRow =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1)

  React.useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${activeRow}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeRow, open])

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    setQuery("")
    setActiveIndex(0)
    setOpen(true)
  }

  const commit = (employee: Employee) => {
    onSelect(employee.id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(Math.min(filtered.length - 1, activeRow + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(Math.max(0, activeRow - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const emp = filtered[activeRow]
      if (emp) commit(emp)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={triggerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-input px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors",
          "hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          open && "border-solid border-primary/50 bg-primary/5 text-primary",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {label}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Pick faculty"
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.placement === "below"
                ? { top: pos.top }
                : { bottom: window.innerHeight - pos.top }),
            }}
            className={cn(
              "z-50 flex flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg",
              "animate-in fade-in-0 zoom-in-95 duration-150",
            )}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search faculty…"
                className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div
              ref={listRef}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto py-1 thin-scrollbar"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No matches
                </div>
              ) : (
                filtered.map((e, idx) => (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={idx === activeRow}
                    data-row={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => commit(e)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
                      idx === activeRow && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(e.emp_display_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {e.emp_display_name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {e.emp_code}
                      </span>
                    </span>
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

// Used by the elective legacy section — stays open after each pick so several
// faculty can be added in a row. Otherwise the same picker shape as
// SingleFacultyPicker.
function MultiFacultyPicker({
  assignedIds,
  onAdd,
  disabled,
}: {
  assignedIds: number[]
  onAdd: (employeeId: number) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [pos, setPos] = React.useState<PickerPos | null>(null)

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const { rows, loading } = useEmployeeSearch(query)
  const filtered = React.useMemo(
    () => rows.filter((e) => !assignedIds.includes(e.id)),
    [rows, assignedIds],
  )

  const noFaculty = !loading && rows.length === 0
  const allAdded = !noFaculty && filtered.length === 0
  const triggerDisabled = disabled

  const reposition = React.useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const margin = 12
    const gap = 6
    const width = Math.max(r.width, 264)
    const spaceBelow = window.innerHeight - r.bottom - margin
    const spaceAbove = r.top - margin
    const placement =
      spaceBelow >= 260 || spaceBelow >= spaceAbove ? "below" : "above"
    const maxHeight = Math.min(
      340,
      Math.max(160, placement === "below" ? spaceBelow - gap : spaceAbove - gap),
    )
    let left = r.left
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width
    }
    setPos({
      left: Math.max(margin, left),
      top: placement === "below" ? r.bottom + gap : r.top - gap,
      width,
      maxHeight,
      placement,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    reposition()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, reposition])

  React.useEffect(() => {
    if (!open) return
    const onChange = () => reposition()
    window.addEventListener("scroll", onChange, true)
    window.addEventListener("resize", onChange)
    return () => {
      window.removeEventListener("scroll", onChange, true)
      window.removeEventListener("resize", onChange)
    }
  }, [open, reposition])

  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const tgt = e.target as Node
      if (triggerRef.current?.contains(tgt)) return
      if (panelRef.current?.contains(tgt)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const activeRow =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1)

  React.useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${activeRow}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeRow, open])

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    setQuery("")
    setActiveIndex(0)
    setOpen(true)
  }

  const commit = (employee: Employee) => {
    onAdd(employee.id)
    if (filtered.length <= 1) {
      setOpen(false)
      triggerRef.current?.focus()
    } else {
      setQuery("")
      setActiveIndex(0)
      inputRef.current?.focus()
    }
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(Math.min(filtered.length - 1, activeRow + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(Math.max(0, activeRow - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const emp = filtered[activeRow]
      if (emp) commit(emp)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={triggerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-input px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
          "hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          open && "border-solid border-primary/50 bg-primary/5 text-primary",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Plus className="size-3.5" />
        {noFaculty
          ? "No active faculty"
          : allAdded
            ? "All faculty added"
            : "Add faculty"}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Add faculty"
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.placement === "below"
                ? { top: pos.top }
                : { bottom: window.innerHeight - pos.top }),
            }}
            className={cn(
              "z-50 flex flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg",
              "animate-in fade-in-0 zoom-in-95 duration-150",
            )}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search faculty…"
                className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div
              ref={listRef}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto py-1 thin-scrollbar"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No matches
                </div>
              ) : (
                filtered.map((e, idx) => (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={idx === activeRow}
                    data-row={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => commit(e)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
                      idx === activeRow && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(e.emp_display_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {e.emp_display_name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {e.emp_code}
                      </span>
                    </span>
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function FacultySkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-3 shadow-xs">
        <Skeleton className="h-4 w-64" />
      </div>
      <FacultyListSkeleton />
    </>
  )
}

function FacultyListSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-7 w-72 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
