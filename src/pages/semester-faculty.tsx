import * as React from "react"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, BookMarked, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { listEmployees, type Employee } from "@/lib/employees"
import {
  listProgrammeSemesters,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  listProgrammeSemesterSubjects,
  setProgrammeSemesterSubjectFaculty,
  setProgrammeSemesterSubjectOptionFaculty,
  type ProgrammeSemesterSubject,
  type ProgrammeSemesterSubjectOption,
} from "@/lib/programme-semester-subjects"

// A single faculty-editable unit. A real subject is one target; an elective
// slot contributes one target per candidate subject (the slot itself is not
// a target — faculty are allocated per candidate subject).
type Target = {
  key: string
  kind: "entry" | "option"
  /** Id passed to the API — the entry id, or the elective option id. */
  refId: number
  /** Parent subject-entry id — used to splice the API response back in. */
  entryId: number
  name: string
  code: string
  faculty: { id: number; employee_id: number; employee: Employee }[]
}

type RenderItem =
  | { kind: "subject"; entry: ProgrammeSemesterSubject; target: Target }
  | {
      kind: "elective"
      entry: ProgrammeSemesterSubject
      optionTargets: Target[]
    }

function entryTarget(e: ProgrammeSemesterSubject): Target {
  return {
    key: `e${e.id}`,
    kind: "entry",
    refId: e.id,
    entryId: e.id,
    name: e.subject?.name ?? "(unnamed)",
    code: e.subject?.code ?? "",
    faculty: e.faculty,
  }
}

function optionTarget(
  e: ProgrammeSemesterSubject,
  o: ProgrammeSemesterSubjectOption,
): Target {
  return {
    key: `o${o.id}`,
    kind: "option",
    refId: o.id,
    entryId: e.id,
    name: o.subject.name,
    code: o.subject.code,
    faculty: o.faculty,
  }
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

// Dedicated full-screen for the Faculty allocation section of a semester's
// settings. Real subjects and each elective candidate subject get their own
// inline-editable faculty roster, plus a bulk-assign bar.
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

  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [entries, setEntries] = React.useState<ProgrammeSemesterSubject[]>([])
  const [entriesLoading, setEntriesLoading] = React.useState(true)

  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())
  const [bulkFacultyIds, setBulkFacultyIds] = React.useState<number[]>([])
  const [bulkBusy, setBulkBusy] = React.useState(false)
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

  React.useEffect(() => {
    let cancelled = false
    listEmployees({
      status: "active",
      pageSize: 100,
      sortBy: "emp_display_name",
      sortOrder: "asc",
    })
      .then((r) => {
        if (!cancelled) setEmployees(r.rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error("Couldn't load faculty list", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadEntries = React.useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    try {
      const r = await listProgrammeSemesterSubjects({
        programmeSemesterId: id,
        pageSize: 100,
        sortBy: "created_at",
        sortOrder: "asc",
      })
      setEntries(r.rows)
    } catch (err) {
      toast.error("Couldn't load subjects", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setEntriesLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  // Real subjects render as one row; electives expand into a group of
  // candidate-subject rows. `allTargets` is the flat list behind selection,
  // the bulk action, and the assigned-count.
  const renderItems = React.useMemo<RenderItem[]>(
    () =>
      entries.map((e) =>
        e.subject_id !== null
          ? { kind: "subject", entry: e, target: entryTarget(e) }
          : {
              kind: "elective",
              entry: e,
              optionTargets: e.options.map((o) => optionTarget(e, o)),
            },
      ),
    [entries],
  )
  const allTargets = React.useMemo<Target[]>(
    () =>
      renderItems.flatMap((it) =>
        it.kind === "subject" ? [it.target] : it.optionTargets,
      ),
    [renderItems],
  )

  // Persist a target's roster via the matching endpoint, then splice the
  // returned entry back in — both endpoints return the parent subject entry.
  const persist = async (target: Target, employeeIds: number[]) => {
    const updated =
      target.kind === "entry"
        ? await setProgrammeSemesterSubjectFaculty(target.refId, employeeIds)
        : await setProgrammeSemesterSubjectOptionFaculty(
            target.refId,
            employeeIds,
          )
    setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
  }

  const applyFaculty = async (target: Target, employeeIds: number[]) => {
    setSavingKeys((s) => new Set(s).add(target.key))
    try {
      await persist(target, employeeIds)
    } catch (err) {
      toast.error("Couldn't update faculty", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSavingKeys((s) => {
        const n = new Set(s)
        n.delete(target.key)
        return n
      })
    }
  }

  const addToTarget = (target: Target, employeeId: number) => {
    if (target.faculty.some((f) => f.employee_id === employeeId)) return
    void applyFaculty(target, [
      ...target.faculty.map((f) => f.employee_id),
      employeeId,
    ])
  }

  const removeFromTarget = (target: Target, employeeId: number) => {
    void applyFaculty(
      target,
      target.faculty
        .map((f) => f.employee_id)
        .filter((eid) => eid !== employeeId),
    )
  }

  const toggleKey = (key: string) => {
    setSelectedKeys((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const toggleKeys = (keys: string[], select: boolean) => {
    setSelectedKeys((s) => {
      const n = new Set(s)
      for (const k of keys) {
        if (select) n.add(k)
        else n.delete(k)
      }
      return n
    })
  }

  const allSelected =
    allTargets.length > 0 && allTargets.every((t) => selectedKeys.has(t.key))
  const someSelected = selectedKeys.size > 0 && !allSelected

  const toggleSelectAll = () => {
    setSelectedKeys(
      allSelected ? new Set() : new Set(allTargets.map((t) => t.key)),
    )
  }

  const bulkApply = async () => {
    if (bulkFacultyIds.length === 0 || selectedKeys.size === 0) return
    setBulkBusy(true)
    const targets = allTargets.filter((t) => selectedKeys.has(t.key))
    let done = 0
    try {
      for (const t of targets) {
        const merged = Array.from(
          new Set([
            ...t.faculty.map((f) => f.employee_id),
            ...bulkFacultyIds,
          ]),
        )
        await persist(t, merged)
        done++
      }
      toast.success(
        `Added faculty to ${done} subject${done === 1 ? "" : "s"}.`,
      )
      setSelectedKeys(new Set())
      setBulkFacultyIds([])
    } catch (err) {
      toast.error("Couldn't finish bulk assign", {
        description:
          (err instanceof ApiError ? err.message : "Please try again.") +
          (done > 0 ? ` ${done} subject(s) updated before the error.` : ""),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const allocatedCount = allTargets.filter((t) => t.faculty.length > 0).length

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/masters/programme-configuration/semester/$programmeSemesterId"
          params={{ programmeSemesterId: params.programmeSemesterId ?? "" }}
          search={{ programmeId, admissionYearId }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Semester settings
        </Link>
      </div>

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
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  Faculty allocation
                </h1>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
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
              </div>
              {!entriesLoading && allTargets.length > 0 && (
                <div className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Assigned{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {allocatedCount}/{allTargets.length}
                  </span>
                </div>
              )}
            </div>
          </header>

          {entriesLoading ? (
            <FacultyListSkeleton />
          ) : entries.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
              <EmptyState
                icon={BookMarked}
                title="No subjects configured"
                description="Configure subjects for this semester first — faculty are allocated per subject."
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
            <>
              {/* Bulk assign --------------------------------------------- */}
              <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <UserPlus className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold tracking-tight">
                      Bulk assign
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pick faculty, tick the subjects below, then add them all
                      in one go. Existing faculty on a subject are kept.
                    </p>
                    <div className="mt-3 space-y-2.5">
                      <FacultyMultiPicker
                        employees={employees}
                        selectedIds={bulkFacultyIds}
                        onChange={setBulkFacultyIds}
                        disabled={bulkBusy}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => void bulkApply()}
                          disabled={
                            bulkBusy ||
                            bulkFacultyIds.length === 0 ||
                            selectedKeys.size === 0
                          }
                        >
                          <UserPlus />
                          {bulkBusy
                            ? "Applying…"
                            : selectedKeys.size === 0
                              ? "Add to selected subjects"
                              : `Add to ${selectedKeys.size} selected subject${
                                  selectedKeys.size === 1 ? "" : "s"
                                }`}
                        </Button>
                        {selectedKeys.size > 0 && !bulkBusy && (
                          <button
                            type="button"
                            onClick={() => setSelectedKeys(new Set())}
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Clear selection
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Subjects list ------------------------------------------- */}
              <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
                <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all subjects"
                    className="size-4 rounded border-input accent-primary"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleSelectAll}
                    disabled={bulkBusy || allTargets.length === 0}
                  />
                  <span className="text-sm font-medium">Subjects</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {selectedKeys.size} selected
                  </span>
                </div>
                <div className="divide-y">
                  {renderItems.map((it) =>
                    it.kind === "subject" ? (
                      <FacultyRow
                        key={it.entry.id}
                        target={it.target}
                        employees={employees}
                        selected={selectedKeys.has(it.target.key)}
                        saving={savingKeys.has(it.target.key)}
                        disabled={bulkBusy}
                        inactive={!it.entry.is_active}
                        onToggleSelect={() => toggleKey(it.target.key)}
                        onAdd={(empId) => addToTarget(it.target, empId)}
                        onRemove={(empId) =>
                          removeFromTarget(it.target, empId)
                        }
                      />
                    ) : (
                      <ElectiveGroup
                        key={it.entry.id}
                        entry={it.entry}
                        optionTargets={it.optionTargets}
                        employees={employees}
                        selectedKeys={selectedKeys}
                        savingKeys={savingKeys}
                        disabled={bulkBusy}
                        onToggleSelect={toggleKey}
                        onToggleGroup={toggleKeys}
                        onAdd={addToTarget}
                        onRemove={removeFromTarget}
                      />
                    ),
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// An open-elective slot — a group header plus one faculty-editable row per
// candidate subject.
function ElectiveGroup({
  entry,
  optionTargets,
  employees,
  selectedKeys,
  savingKeys,
  disabled,
  onToggleSelect,
  onToggleGroup,
  onAdd,
  onRemove,
}: {
  entry: ProgrammeSemesterSubject
  optionTargets: Target[]
  employees: Employee[]
  selectedKeys: Set<string>
  savingKeys: Set<string>
  disabled: boolean
  onToggleSelect: (key: string) => void
  onToggleGroup: (keys: string[], select: boolean) => void
  onAdd: (target: Target, employeeId: number) => void
  onRemove: (target: Target, employeeId: number) => void
}) {
  const keys = optionTargets.map((t) => t.key)
  const allSel = keys.length > 0 && keys.every((k) => selectedKeys.has(k))
  const someSel = keys.some((k) => selectedKeys.has(k)) && !allSel

  return (
    <div className={cn(!entry.is_active && "opacity-60")}>
      <div className="flex items-center gap-3 bg-muted/40 px-4 py-2">
        <input
          type="checkbox"
          aria-label={`Select all candidates of ${electiveLabel(entry)}`}
          className="size-4 rounded border-input accent-primary"
          checked={allSel}
          ref={(el) => {
            if (el) el.indeterminate = someSel
          }}
          onChange={() => onToggleGroup(keys, !allSel)}
          disabled={disabled || keys.length === 0}
        />
        <span className="text-sm font-medium">{electiveLabel(entry)}</span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
          Elective slot
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {entry.options.length} candidate
          {entry.options.length === 1 ? "" : "s"}
        </span>
      </div>
      {optionTargets.length === 0 ? (
        <div className="px-4 py-3 pl-11 text-xs italic text-muted-foreground">
          No candidate subjects yet — add them on the Subjects screen.
        </div>
      ) : (
        <div className="divide-y">
          {optionTargets.map((t) => (
            <FacultyRow
              key={t.key}
              target={t}
              employees={employees}
              selected={selectedKeys.has(t.key)}
              saving={savingKeys.has(t.key)}
              disabled={disabled}
              indented
              onToggleSelect={() => onToggleSelect(t.key)}
              onAdd={(empId) => onAdd(t, empId)}
              onRemove={(empId) => onRemove(t, empId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// One faculty-editable subject row — a real subject, or an elective
// candidate subject when `indented`.
function FacultyRow({
  target,
  employees,
  selected,
  saving,
  disabled,
  indented,
  inactive,
  onToggleSelect,
  onAdd,
  onRemove,
}: {
  target: Target
  employees: Employee[]
  selected: boolean
  saving: boolean
  disabled: boolean
  indented?: boolean
  inactive?: boolean
  onToggleSelect: () => void
  onAdd: (employeeId: number) => void
  onRemove: (employeeId: number) => void
}) {
  const assignedIds = target.faculty.map((f) => f.employee_id)
  const locked = saving || disabled

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        indented && "pl-11",
        selected && "bg-primary/[0.03]",
        inactive && "opacity-60",
      )}
    >
      <input
        type="checkbox"
        aria-label={`Select ${target.name}`}
        className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
        checked={selected}
        onChange={onToggleSelect}
        disabled={disabled}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{target.name}</span>
          {target.code && (
            <span className="font-mono text-xs text-muted-foreground">
              {target.code}
            </span>
          )}
          {saving && (
            <span className="text-[11px] text-muted-foreground">Saving…</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {target.faculty.map((f) => (
            <FacultyChip
              key={f.id}
              employee={f.employee}
              onRemove={() => onRemove(f.employee_id)}
              disabled={locked}
            />
          ))}
          {target.faculty.length === 0 && (
            <span className="text-xs italic text-muted-foreground">
              No faculty yet —
            </span>
          )}
          <div className="w-52">
            <FacultyAddCombobox
              employees={employees}
              excludeIds={assignedIds}
              onAdd={onAdd}
              disabled={locked}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Removable pill for one faculty — initials avatar + name.
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

// Single-pick combobox that emits the chosen faculty and resets — used both
// inline on a row and inside the bulk multi-picker.
function FacultyAddCombobox({
  employees,
  excludeIds,
  onAdd,
  disabled,
}: {
  employees: Employee[]
  excludeIds: number[]
  onAdd: (employeeId: number) => void
  disabled?: boolean
}) {
  const options = React.useMemo<ComboboxOption[]>(
    () =>
      employees
        .filter((e) => !excludeIds.includes(e.id))
        .map((e) => ({
          value: e.id,
          label: e.emp_display_name,
          sublabel: e.emp_code,
        })),
    [employees, excludeIds],
  )

  return (
    <Combobox
      value={null}
      options={options}
      onChange={(v) => v != null && onAdd(v)}
      placeholder={
        employees.length === 0
          ? "No active faculty"
          : options.length === 0
            ? "All faculty added"
            : "Add faculty…"
      }
      searchPlaceholder="Search faculty…"
      emptyMessage={
        employees.length === 0 ? "No active faculty" : "No matches"
      }
      disabled={disabled || employees.length === 0 || options.length === 0}
    />
  )
}

// Chip multi-select for the bulk bar — staged faculty, not yet persisted.
function FacultyMultiPicker({
  employees,
  selectedIds,
  onChange,
  disabled,
}: {
  employees: Employee[]
  selectedIds: number[]
  onChange: (next: number[]) => void
  disabled?: boolean
}) {
  const byId = React.useMemo(() => {
    const map = new Map<number, Employee>()
    for (const e of employees) map.set(e.id, e)
    return map
  }, [employees])

  return (
    <div className="space-y-2">
      <FacultyAddCombobox
        employees={employees}
        excludeIds={selectedIds}
        onAdd={(eid) => onChange([...selectedIds, eid])}
        disabled={disabled}
      />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((eid) => {
            const e = byId.get(eid)
            if (!e) return null
            return (
              <FacultyChip
                key={eid}
                employee={e}
                onRemove={() =>
                  onChange(selectedIds.filter((x) => x !== eid))
                }
                disabled={disabled}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function FacultySkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
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
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="mt-0.5 size-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-7 w-72 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
