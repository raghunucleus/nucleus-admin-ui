import * as React from "react"
import { createPortal } from "react-dom"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, BookMarked, Plus, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
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
// inline-editable faculty roster.
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
  // candidate-subject rows. `allTargets` is the flat list behind the
  // assigned-count.
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
            <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
              <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-medium">
                Subjects
              </div>
              <div className="divide-y">
                {renderItems.map((it) =>
                  it.kind === "subject" ? (
                    <FacultyRow
                      key={it.entry.id}
                      target={it.target}
                      employees={employees}
                      saving={savingKeys.has(it.target.key)}
                      inactive={!it.entry.is_active}
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
                      savingKeys={savingKeys}
                      onAdd={addToTarget}
                      onRemove={removeFromTarget}
                    />
                  ),
                )}
              </div>
            </div>
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
  savingKeys,
  onAdd,
  onRemove,
}: {
  entry: ProgrammeSemesterSubject
  optionTargets: Target[]
  employees: Employee[]
  savingKeys: Set<string>
  onAdd: (target: Target, employeeId: number) => void
  onRemove: (target: Target, employeeId: number) => void
}) {
  return (
    <div className={cn(!entry.is_active && "opacity-60")}>
      <div className="flex items-center gap-3 bg-muted/40 px-4 py-2">
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
              saving={savingKeys.has(t.key)}
              indented
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
  saving,
  indented,
  inactive,
  onAdd,
  onRemove,
}: {
  target: Target
  employees: Employee[]
  saving: boolean
  indented?: boolean
  inactive?: boolean
  onAdd: (employeeId: number) => void
  onRemove: (employeeId: number) => void
}) {
  const assignedIds = target.faculty.map((f) => f.employee_id)

  return (
    <div
      className={cn(
        "px-4 py-3 transition-colors",
        indented && "pl-11",
        inactive && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        <FacultyPicker
          employees={employees}
          assignedIds={assignedIds}
          onAdd={onAdd}
          disabled={saving}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {target.faculty.map((f) => (
          <FacultyChip
            key={f.id}
            employee={f.employee}
            onRemove={() => onRemove(f.employee_id)}
            disabled={saving}
          />
        ))}
        {target.faculty.length === 0 && (
          <span className="text-xs italic text-muted-foreground">
            No faculty assigned
          </span>
        )}
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

type PickerPos = {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: "below" | "above"
}

// "Add faculty" pill that opens a searchable faculty list. The panel is
// portalled to <body> and anchored with fixed positioning, so it is never
// clipped by the subjects card's `overflow-hidden`. The panel stays open
// after each pick so several faculty can be added in one pass.
function FacultyPicker({
  employees,
  assignedIds,
  onAdd,
  disabled,
}: {
  employees: Employee[]
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

  const available = React.useMemo(
    () => employees.filter((e) => !assignedIds.includes(e.id)),
    [employees, assignedIds],
  )
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter(
      (e) =>
        e.emp_display_name.toLowerCase().includes(q) ||
        e.emp_code.toLowerCase().includes(q),
    )
  }, [available, query])

  const noFaculty = employees.length === 0
  const allAdded = !noFaculty && available.length === 0
  const triggerDisabled = disabled || noFaculty || allAdded

  // Anchor the panel to the trigger in viewport coordinates. Prefers below;
  // flips above when there is more room there.
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

  // Keep the panel anchored while the page scrolls or resizes.
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

  // Close on outside mousedown.
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

  // The highlighted row, clamped to the current filtered list so it stays
  // valid as results change — no syncing effect needed.
  const activeRow =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1)

  // Scroll the highlighted row into view during keyboard navigation.
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
    // `available` still includes this employee until the parent re-renders;
    // a length of 1 means this was the last one — close once it is gone.
    if (available.length <= 1) {
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
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-7 w-72 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
