import * as React from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  CalendarRange,
  Check,
  ChevronDown,
  Clock,
  Copy,
  GripVertical,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DatePicker } from "@/components/ui/date-picker"
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
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { EmployeePicker } from "@/components/employee-picker"
import { useEmployeeNames } from "@/lib/employee-search"
import { type Employee } from "@/lib/employees"
import {
  listProgrammeSemesterSubjects,
  type ProgrammeSemesterSubject,
} from "@/lib/programme-semester-subjects"
import {
  clearTimetableEntry,
  createTimetableCourse,
  deleteTimetable,
  deleteTimetableCourse,
  getTimetable,
  saveTimetablePeriods,
  setTimetableCourseFaculty,
  updateTimetable,
  updateTimetableCourse,
  upsertTimetableEntry,
  WEEKDAYS,
  type Timetable,
  type TimetableCourse,
  type TimetableEntry,
  type TimetablePeriod,
} from "@/lib/timetables"

// --- shared helpers ---------------------------------------------------------

// Color-coding for the grid — subjects get a stable color by palette order.
// Opacity-tinted 500-level colors read correctly on both light and dark
// backgrounds from a single class; text always uses the theme's foreground
// tokens, so it stays legible whatever the tint.
const COURSE_COLORS = [
  { dot: "bg-sky-500", tint: "bg-sky-500/10", ring: "border-sky-500/30", hover: "hover:bg-sky-500/20" },
  { dot: "bg-emerald-500", tint: "bg-emerald-500/10", ring: "border-emerald-500/30", hover: "hover:bg-emerald-500/20" },
  { dot: "bg-violet-500", tint: "bg-violet-500/10", ring: "border-violet-500/30", hover: "hover:bg-violet-500/20" },
  { dot: "bg-amber-500", tint: "bg-amber-500/10", ring: "border-amber-500/30", hover: "hover:bg-amber-500/20" },
  { dot: "bg-rose-500", tint: "bg-rose-500/10", ring: "border-rose-500/30", hover: "hover:bg-rose-500/20" },
  { dot: "bg-cyan-500", tint: "bg-cyan-500/10", ring: "border-cyan-500/30", hover: "hover:bg-cyan-500/20" },
  { dot: "bg-indigo-500", tint: "bg-indigo-500/10", ring: "border-indigo-500/30", hover: "hover:bg-indigo-500/20" },
  { dot: "bg-orange-500", tint: "bg-orange-500/10", ring: "border-orange-500/30", hover: "hover:bg-orange-500/20" },
]

// One placeable unit in the grid — a semester-linked subject or a
// timetable-exclusive course, unified for the palette and the cell editor.
type PaletteItem = {
  key: string
  kind: "semester" | "extra"
  refId: number
  name: string
  code: string | null
  short: string
  isElective: boolean
  inactive: boolean
  courseId: number | null
  // The group's own teacher(s) for this subject. Real subjects scoped to
  // a group have at most one; timetable-exclusive courses can have a small
  // roster.
  faculty: { employee_id: number; employee: Employee }[]
  // Teachers allocated to this subject in OTHER groups of the same
  // semester — used by the cell editor as "borrow from another group" so
  // the admin can cover for an absent primary teacher. Empty for extras
  // and electives.
  alternateFaculty: {
    employee_id: number
    employee: Employee
    attendance_group_id: number
    attendance_group_name: string | null
  }[]
  colorIndex: number
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
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

function cellKey(day: number, periodId: number): string {
  return `${day}-${periodId}`
}

function buildPalette(
  semesterSubjects: ProgrammeSemesterSubject[],
  courses: TimetableCourse[],
): PaletteItem[] {
  const items: PaletteItem[] = []
  semesterSubjects.forEach((s) => {
    const name = s.subject?.name ?? s.placeholder_name ?? "(unnamed)"
    const code = s.subject?.code ?? null
    items.push({
      key: `pss-${s.id}`,
      kind: "semester",
      refId: s.id,
      name,
      code,
      short: code ?? name,
      isElective: s.subject_id === null,
      inactive: !s.is_active,
      courseId: null,
      faculty: (s.faculty ?? []).map((f) => ({
        employee_id: f.employee_id,
        employee: f.employee,
      })),
      alternateFaculty: (s.alternate_faculty ?? []).map((f) => ({
        employee_id: f.employee_id,
        employee: f.employee,
        attendance_group_id: f.attendance_group_id,
        attendance_group_name: f.attendance_group?.name ?? null,
      })),
      colorIndex: 0,
    })
  })
  courses.forEach((c) => {
    const name = c.subject?.name ?? c.custom_label ?? "(unnamed)"
    const code = c.subject?.code ?? null
    items.push({
      key: `crs-${c.id}`,
      kind: "extra",
      refId: c.id,
      name,
      code,
      short: code ?? name,
      isElective: false,
      inactive: false,
      courseId: c.id,
      faculty: c.faculty.map((f) => ({
        employee_id: f.employee_id,
        employee: f.employee,
      })),
      // Timetable-exclusive courses are not group-scoped, so there's
      // nothing to borrow from elsewhere.
      alternateFaculty: [],
      colorIndex: 0,
    })
  })
  return items.map((it, i) => ({ ...it, colorIndex: i % COURSE_COLORS.length }))
}

// --- page -------------------------------------------------------------------

export function TimetableEditorPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
    timetableId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const programmeSemesterId = Number(params.programmeSemesterId)
  const timetableId = Number(params.timetableId)
  const { programmeId, admissionYearId } = search

  const [timetable, setTimetable] = React.useState<Timetable | null>(null)
  const [semesterSubjects, setSemesterSubjects] = React.useState<
    ProgrammeSemesterSubject[]
  >([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  const [cellTarget, setCellTarget] = React.useState<{
    day: number
    period: TimetablePeriod
    /** Longest span placeable here — the run of consecutive teaching periods
        starting at this cell, stopping at the next break (backend rejects a
        merged class that covers a break). */
    maxSpan: number
  } | null>(null)
  const [structureOpen, setStructureOpen] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [addCourseOpen, setAddCourseOpen] = React.useState(false)
  const [manageCourse, setManageCourse] = React.useState<TimetableCourse | null>(
    null,
  )
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [actionBusy, setActionBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!Number.isInteger(timetableId) || timetableId <= 0) {
      setLoading(false)
      setFailed(true)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const tt = await getTimetable(timetableId)
      setTimetable(tt)
      const subs = await listProgrammeSemesterSubjects({
        programmeSemesterId: tt.programme_semester_id,
        // Faculty is allocated per (subject, attendance group). The timetable
        // is bound to one group, so scope the palette's faculty to that group.
        attendanceGroupId: tt.attendance_group_id,
        pageSize: 100,
        sortBy: "created_at",
        sortOrder: "asc",
      })
      setSemesterSubjects(subs.rows)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [timetableId])

  React.useEffect(() => {
    void load()
  }, [load])

  const palette = React.useMemo(
    () => buildPalette(semesterSubjects, timetable?.courses ?? []),
    [semesterSubjects, timetable?.courses],
  )
  const paletteByKey = React.useMemo(() => {
    const map = new Map<string, PaletteItem>()
    for (const p of palette) map.set(p.key, p)
    return map
  }, [palette])

  // Resolve an entry to its palette item so a cell knows its color + labels.
  const paletteForEntry = React.useCallback(
    (e: TimetableEntry): PaletteItem | undefined => {
      if (e.programme_semester_subject_id !== null)
        return paletteByKey.get(`pss-${e.programme_semester_subject_id}`)
      if (e.timetable_course_id !== null)
        return paletteByKey.get(`crs-${e.timetable_course_id}`)
      return undefined
    },
    [paletteByKey],
  )

  const entryMap = React.useMemo(() => {
    const map = new Map<string, TimetableEntry>()
    for (const e of timetable?.entries ?? [])
      map.set(cellKey(e.day_of_week, e.timetable_period_id), e)
    return map
  }, [timetable?.entries])

  const readOnly = false

  // Splice a single upserted entry into the live grid, dropping any entry on
  // the same day whose period run overlaps it (a wider span absorbs them) —
  // mirrors the conflict cleanup the server does.
  const applyEntry = (entry: TimetableEntry) => {
    setTimetable((prev) => {
      if (!prev) return prev
      const ordered = [...prev.periods].sort(
        (a, b) => a.position - b.position,
      )
      const idxById = new Map(ordered.map((p, i) => [p.id, i]))
      const newStart = idxById.get(entry.timetable_period_id)
      const newEnd =
        newStart === undefined ? undefined : newStart + entry.span - 1
      const rest = prev.entries.filter((e) => {
        if (e.day_of_week !== entry.day_of_week) return true
        if (newStart === undefined || newEnd === undefined) return true
        const eIdx = idxById.get(e.timetable_period_id)
        if (eIdx === undefined) return true
        const eEnd = eIdx + e.span - 1
        return !(eIdx <= newEnd && newStart <= eEnd)
      })
      return { ...prev, entries: [...rest, entry] }
    })
  }

  const removeEntry = (day: number, periodId: number) => {
    setTimetable((prev) =>
      prev
        ? {
            ...prev,
            entries: prev.entries.filter(
              (e) =>
                !(
                  e.day_of_week === day && e.timetable_period_id === periodId
                ),
            ),
          }
        : prev,
    )
  }

  const handleDelete = async () => {
    if (!timetable) return
    setActionBusy(true)
    try {
      await deleteTimetable(timetable.id)
      toast.success("Timetable deleted")
      void navigate({
        to: "/masters/programme-configuration/semester/$programmeSemesterId/timetables",
        params: { programmeSemesterId: String(programmeSemesterId) },
        search: { programmeId, admissionYearId },
      })
    } catch (err) {
      toast.error("Couldn't delete", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setActionBusy(false)
      setConfirmDelete(false)
    }
  }

  const backLink = (
    <Link
      to="/masters/programme-configuration/semester/$programmeSemesterId/timetables"
      params={{ programmeSemesterId: params.programmeSemesterId ?? "" }}
      search={{ programmeId, admissionYearId }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <ArrowLeft className="size-4" />
      Timetables
    </Link>
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-2">
        <div className="flex items-center gap-1">{backLink}</div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  if (failed || !timetable) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-2">
        <div className="flex items-center gap-1">{backLink}</div>
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load timetable"
            description="This timetable could not be found, or it was opened without its programme context."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/programme-configuration/semester/$programmeSemesterId/timetables"
                  params={{
                    programmeSemesterId: params.programmeSemesterId ?? "",
                  }}
                  search={{ programmeId, admissionYearId }}
                >
                  Back to timetables
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const days = WEEKDAYS.filter((d) => timetable.working_days.includes(d.value))
  const periods = [...timetable.periods].sort((a, b) => a.position - b.position)

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-2">
      <div className="flex items-center gap-1">{backLink}</div>

      {/* Header --------------------------------------------------------- */}
      <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {timetable.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span className="font-medium text-foreground">
                {timetable.attendance_group?.name ?? "Group"}
              </span>
              <span className="opacity-40">·</span>
              <span>{days.map((d) => d.short).join(", ")}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDetailsOpen(true)}
              disabled={actionBusy}
            >
              <Pencil />
              Edit details
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={actionBusy}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </header>

      {/* Period structure ---------------------------------------------- */}
      <PeriodStructurePanel
        open={structureOpen}
        onToggle={() => setStructureOpen((v) => !v)}
        timetable={timetable}
        readOnly={!!readOnly}
        onSaved={setTimetable}
      />

      {/* Course palette ------------------------------------------------- */}
      <CoursePalette
        palette={palette}
        readOnly={!!readOnly}
        programmeSemesterId={params.programmeSemesterId ?? ""}
        programmeId={programmeId}
        admissionYearId={admissionYearId}
        onAdd={() => setAddCourseOpen(true)}
        onManage={(courseId) => {
          const c = timetable.courses.find((x) => x.id === courseId)
          if (c) setManageCourse(c)
        }}
      />

      {/* Grid ----------------------------------------------------------- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Weekly grid</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {readOnly ? "Read-only" : "Click a cell to place or edit a class"}
          </span>
        </div>
        {days.length === 0 || periods.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing to schedule yet"
            description="Set the working days and period rows in Period structure above to build the grid."
          />
        ) : (
          <TimetableGrid
            days={days}
            periods={periods}
            entryMap={entryMap}
            paletteForEntry={paletteForEntry}
            readOnly={!!readOnly}
            onCellClick={(day, period) => {
              const startIdx = periods.findIndex((p) => p.id === period.id)
              let consecutive = 0
              for (
                let i = startIdx;
                i < periods.length && !periods[i].is_break;
                i += 1
              ) {
                consecutive += 1
              }
              setCellTarget({
                day,
                period,
                maxSpan: Math.min(consecutive, 6), // cap UI choice at 6
              })
            }}
          />
        )}
      </section>

      {/* Workload summary ---------------------------------------------- */}
      <WorkloadPanel
        palette={palette}
        entries={timetable.entries}
      />

      {/* Cell editor ---------------------------------------------------- */}
      {cellTarget && (
        <CellEditorModal
          timetableId={timetable.id}
          day={cellTarget.day}
          period={cellTarget.period}
          maxSpan={cellTarget.maxSpan}
          existing={entryMap.get(
            cellKey(cellTarget.day, cellTarget.period.id),
          )}
          palette={palette}
          onClose={() => setCellTarget(null)}
          onSaved={(entry) => {
            applyEntry(entry)
            setCellTarget(null)
          }}
          onCleared={() => {
            removeEntry(cellTarget.day, cellTarget.period.id)
            setCellTarget(null)
          }}
        />
      )}

      {/* Edit details sheet -------------------------------------------- */}
      <EditDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        timetable={timetable}
        onSaved={(tt) => {
          setTimetable(tt)
          setDetailsOpen(false)
        }}
      />

      {/* Add course sheet ---------------------------------------------- */}
      <AddCourseSheet
        open={addCourseOpen}
        onOpenChange={setAddCourseOpen}
        timetableId={timetable.id}
        onSaved={(tt) => {
          setTimetable(tt)
          setAddCourseOpen(false)
        }}
      />

      {/* Manage course sheet ------------------------------------------- */}
      {manageCourse && (
        <ManageCourseSheet
          open
          onOpenChange={(o) => !o && setManageCourse(null)}
          course={manageCourse}
          onSaved={(tt) => {
            setTimetable(tt)
            setManageCourse(null)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this timetable?"
        description="The timetable and all its periods, courses and scheduled classes will be permanently removed."
        confirmLabel="Delete timetable"
        tone="destructive"
        icon={Trash2}
        loading={actionBusy}
        onConfirm={handleDelete}
      />

    </div>
  )
}

// --- weekly grid ------------------------------------------------------------

function TimetableGrid({
  days,
  periods,
  entryMap,
  paletteForEntry,
  readOnly,
  onCellClick,
}: {
  days: (typeof WEEKDAYS)[number][]
  periods: TimetablePeriod[]
  entryMap: Map<string, TimetableEntry>
  paletteForEntry: (e: TimetableEntry) => PaletteItem | undefined
  readOnly: boolean
  onCellClick: (day: number, period: TimetablePeriod) => void
}) {
  // Cells covered (but not anchored) by a multi-period class — skipped in
  // render so the anchor cell's rowSpan fills them.
  const covered = React.useMemo(() => {
    const idx = new Map<number, number>()
    periods.forEach((p, i) => idx.set(p.id, i))
    const s = new Set<string>()
    for (const e of entryMap.values()) {
      if (e.span <= 1) continue
      const start = idx.get(e.timetable_period_id)
      if (start === undefined) continue
      for (let k = 1; k < e.span; k++) {
        const cp = periods[start + k]
        if (cp) s.add(cellKey(e.day_of_week, cp.id))
      }
    }
    return s
  }, [entryMap, periods])

  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-28 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Period
            </th>
            {days.map((d) => (
              <th
                key={d.value}
                className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d.long}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) =>
            p.is_break ? (
              <tr key={p.id}>
                <td className="rounded-md bg-muted/40 px-2 py-2 align-top">
                  <PeriodLabel period={p} />
                </td>
                <td
                  colSpan={days.length}
                  className="rounded-md border border-dashed border-input bg-muted/30 px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {p.label}
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="rounded-md bg-muted/40 px-2 py-2 align-top">
                  <PeriodLabel period={p} />
                </td>
                {days.map((d) => {
                  const key = cellKey(d.value, p.id)
                  // Covered by a rowSpan from an anchor above — render no cell.
                  if (covered.has(key)) return null
                  const entry = entryMap.get(key)
                  const span = entry?.span ?? 1
                  return (
                    <td key={d.value} className="align-top" rowSpan={span}>
                      <GridCell
                        entry={entry}
                        item={entry ? paletteForEntry(entry) : undefined}
                        span={span}
                        readOnly={readOnly}
                        onClick={() => onCellClick(d.value, p)}
                      />
                    </td>
                  )
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function PeriodLabel({ period }: { period: TimetablePeriod }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-semibold">{period.label}</div>
      <div className="text-[11px] tabular-nums text-muted-foreground">
        {fmtTime(period.start_time)}–{fmtTime(period.end_time)}
      </div>
    </div>
  )
}

function GridCell({
  entry,
  item,
  span,
  readOnly,
  onClick,
}: {
  entry: TimetableEntry | undefined
  item: PaletteItem | undefined
  span: number
  readOnly: boolean
  onClick: () => void
}) {
  const color = item ? COURSE_COLORS[item.colorIndex] : null
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const [tip, setTip] = React.useState<{
    left: number
    top?: number
    bottom?: number
  } | null>(null)

  if (!entry) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={readOnly}
        className={cn(
          "flex h-full min-h-[5rem] w-full min-w-[9.5rem] items-center justify-center rounded-md border border-dashed border-input text-muted-foreground transition-colors",
          readOnly
            ? "cursor-default opacity-50"
            : "hover:border-primary/40 hover:bg-accent/40 hover:text-primary",
        )}
      >
        {!readOnly && <Plus className="size-4" />}
      </button>
    )
  }

  // Anchor the detail card to the cell on hover — below it, or above when
  // there's no room. Positioned `fixed` so the grid's scroll container can't
  // clip it.
  const showTip = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const WIDTH = 256
    const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8))
    if (window.innerHeight - r.bottom > 220) {
      setTip({ left, top: r.bottom + 8 })
    } else {
      setTip({ left, bottom: window.innerHeight - r.top + 8 })
    }
  }

  const teacherName = entry.employee
    ? entry.employee.emp_display_name
    : item?.isElective
      ? "Open elective — teacher varies"
      : "No teacher assigned"

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setTip(null)
          onClick()
        }}
        onMouseEnter={showTip}
        onMouseLeave={() => setTip(null)}
        disabled={readOnly}
        className={cn(
          "flex h-full min-h-[5rem] w-full min-w-[9.5rem] flex-col rounded-md border px-2 py-1.5 text-left text-foreground transition-colors",
          color ? cn(color.tint, color.ring) : "border-input bg-muted",
          color && !readOnly && color.hover,
          readOnly && "cursor-default",
        )}
      >
        {/* Fixed 3-zone layout — every cell reads identically:
            name (2-line block) · teacher · code + room. */}
        <div className="flex h-8 items-start gap-1">
          <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-tight text-foreground">
            {item?.name ?? "—"}
          </span>
          {span > 1 && (
            <span className="shrink-0 rounded bg-foreground/10 px-1 text-[9px] font-semibold text-muted-foreground">
              {span} periods
            </span>
          )}
        </div>
        <div className="mt-1 flex h-4 items-center gap-1 text-[11px] text-muted-foreground">
          {entry.employee ? (
            <>
              <User className="size-3 shrink-0" />
              <span className="truncate">
                {entry.employee.emp_display_name}
              </span>
            </>
          ) : (
            <span className="truncate italic">
              {item?.isElective ? "Elective — varies" : "No teacher"}
            </span>
          )}
        </div>
        <div className="mt-auto flex h-4 items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate font-mono">{item?.code ?? ""}</span>
          {entry.room && (
            <span className="flex min-w-0 shrink-0 items-center gap-0.5">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{entry.room}</span>
            </span>
          )}
        </div>
      </button>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-64 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg"
          style={{ left: tip.left, top: tip.top, bottom: tip.bottom }}
        >
          <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
            <span
              className={cn(
                "mt-0.5 size-2.5 shrink-0 rounded-full",
                color?.dot ?? "bg-muted-foreground",
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-snug">
                {item?.name ?? "Unknown subject"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {item?.code && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.code}
                  </span>
                )}
                {item?.isElective && (
                  <span className="rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Elective
                  </span>
                )}
                {item?.kind === "extra" && (
                  <span className="rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Timetable-only
                  </span>
                )}
              </div>
            </div>
          </div>
          <dl className="space-y-2 px-3 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  !entry.employee && "italic text-muted-foreground",
                )}
              >
                {teacherName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  !entry.room && "italic text-muted-foreground",
                )}
              >
                {entry.room ?? "No room set"}
              </span>
            </div>
            {entry.note && (
              <div className="flex items-start gap-2">
                <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{entry.note}</span>
              </div>
            )}
          </dl>
        </div>
      )}
    </>
  )
}

// --- course palette ---------------------------------------------------------

function CoursePalette({
  palette,
  readOnly,
  programmeSemesterId,
  programmeId,
  admissionYearId,
  onAdd,
  onManage,
}: {
  palette: PaletteItem[]
  readOnly: boolean
  programmeSemesterId: string
  programmeId?: number
  admissionYearId?: number
  onAdd: () => void
  onManage: (courseId: number) => void
}) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <BookMarked className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Subjects</span>
        <span className="text-xs text-muted-foreground">
          semester subjects + timetable-only additions
        </span>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={onAdd}
          >
            <Plus />
            Add subject
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {palette.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            This semester has no subjects configured. Subjects set up on the
            semester's{" "}
            <Link
              to="/masters/programme-configuration/semester/$programmeSemesterId/subjects"
              params={{ programmeSemesterId }}
              search={{ programmeId, admissionYearId }}
              className="font-medium text-primary hover:underline"
            >
              Subjects
            </Link>{" "}
            screen appear here automatically, carrying the faculty from{" "}
            <Link
              to="/masters/programme-configuration/semester/$programmeSemesterId/faculty"
              params={{ programmeSemesterId }}
              search={{ programmeId, admissionYearId }}
              className="font-medium text-primary hover:underline"
            >
              Faculty allocation
            </Link>
            . Or use “Add subject” above for a timetable-only subject.
          </p>
        ) : (
          palette.map((p) => {
            const color = COURSE_COLORS[p.colorIndex]
            return (
              <div
                key={p.key}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-foreground",
                  color.ring,
                  color.tint,
                  p.inactive && "opacity-50",
                )}
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", color.dot)}
                />
                <span className="font-semibold">{p.short}</span>
                {p.code && p.name !== p.short && (
                  <span className="max-w-[10rem] truncate text-muted-foreground">
                    {p.name}
                  </span>
                )}
                {p.kind === "extra" ? (
                  <span className="rounded-sm bg-background/70 px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Extra
                  </span>
                ) : p.isElective ? (
                  <span className="rounded-sm bg-background/70 px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Elective
                  </span>
                ) : null}
                <span className="tabular-nums text-muted-foreground">
                  · {p.faculty.length} faculty
                </span>
                {p.kind === "extra" && !readOnly && (
                  <button
                    type="button"
                    onClick={() => p.courseId && onManage(p.courseId)}
                    className="ml-0.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    aria-label={`Manage ${p.name}`}
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

// --- period structure panel -------------------------------------------------

type PeriodDraft = {
  _key: string
  id?: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
}

let draftKeySeq = 0
function nextDraftKey(): string {
  draftKeySeq += 1
  return `d${draftKeySeq}`
}

function PeriodStructurePanel({
  open,
  onToggle,
  timetable,
  readOnly,
  onSaved,
}: {
  open: boolean
  onToggle: () => void
  timetable: Timetable
  readOnly: boolean
  onSaved: (tt: Timetable) => void
}) {
  const toDraft = React.useCallback(
    (): PeriodDraft[] =>
      [...timetable.periods]
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          _key: nextDraftKey(),
          id: p.id,
          label: p.label,
          start_time: fmtTime(p.start_time),
          end_time: fmtTime(p.end_time),
          is_break: p.is_break,
        })),
    [timetable.periods],
  )

  const [rows, setRows] = React.useState<PeriodDraft[]>(toDraft)
  const [busy, setBusy] = React.useState(false)

  // Re-sync the draft whenever the saved periods change identity.
  React.useEffect(() => {
    setRows(toDraft())
  }, [toDraft])

  const teachingCount = timetable.periods.filter((p) => !p.is_break).length

  const mutate = (key: string, patch: Partial<PeriodDraft>) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...patch } : r)),
    )
  }

  const move = (index: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addRow = () => {
    const last = rows[rows.length - 1]
    setRows((prev) => [
      ...prev,
      {
        _key: nextDraftKey(),
        label: `Period ${prev.filter((r) => !r.is_break).length + 1}`,
        start_time: last ? last.end_time : "09:00",
        end_time: last ? last.end_time : "09:50",
        is_break: false,
      },
    ])
  }

  // Rows whose time range overlaps another row's. Gaps between rows are fine;
  // overlaps are not.
  const overlapKeys = React.useMemo(() => {
    const bad = new Set<string>()
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i]
        const b = rows[j]
        if (
          a.start_time &&
          a.end_time &&
          b.start_time &&
          b.end_time &&
          a.start_time < b.end_time &&
          b.start_time < a.end_time
        ) {
          bad.add(a._key)
          bad.add(b._key)
        }
      }
    }
    return bad
  }, [rows])

  const invalid =
    rows.some((r) => !r.label.trim() || r.start_time >= r.end_time) ||
    overlapKeys.size > 0

  const save = async () => {
    if (invalid || rows.length === 0) return
    setBusy(true)
    try {
      const updated = await saveTimetablePeriods(
        timetable.id,
        rows.map((r) => ({
          id: r.id,
          label: r.label.trim(),
          start_time: r.start_time,
          end_time: r.end_time,
          is_break: r.is_break,
        })),
      )
      onSaved(updated)
      toast.success("Period structure saved")
    } catch (err) {
      toast.error("Couldn't save periods", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Clock className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Period structure</span>
        <span className="text-xs text-muted-foreground">
          {teachingCount} period{teachingCount === 1 ? "" : "s"}/day ·{" "}
          {timetable.periods.length} rows
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          {readOnly ? (
            <p className="text-xs italic text-muted-foreground">
              Archived timetables can't be restructured.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <div
                    key={r._key}
                    className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5"
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronDown className="size-3.5 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === rows.length - 1}
                        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                    <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
                    <Input
                      value={r.label}
                      onChange={(e) =>
                        mutate(r._key, { label: e.target.value })
                      }
                      placeholder="Label"
                      className="h-8 w-40"
                      maxLength={48}
                    />
                    <Input
                      type="time"
                      value={r.start_time}
                      onChange={(e) =>
                        mutate(r._key, { start_time: e.target.value })
                      }
                      className="h-8 w-28"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={r.end_time}
                      onChange={(e) =>
                        mutate(r._key, { end_time: e.target.value })
                      }
                      className="h-8 w-28"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={r.is_break}
                        onChange={(e) =>
                          mutate(r._key, { is_break: e.target.checked })
                        }
                        className="size-3.5 rounded border-input accent-primary"
                      />
                      Break
                    </label>
                    {r.start_time >= r.end_time ? (
                      <span className="text-[11px] font-medium text-destructive">
                        End must be after start
                      </span>
                    ) : overlapKeys.has(r._key) ? (
                      <span className="text-[11px] font-medium text-destructive">
                        Overlaps another period
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) =>
                          prev.filter((x) => x._key !== r._key),
                        )
                      }
                      disabled={rows.length === 1}
                      className="ml-auto text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                      aria-label="Remove period"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={addRow}>
                  <Plus />
                  Add period
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows(toDraft())}
                    disabled={busy}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void save()}
                    disabled={busy || invalid}
                  >
                    {busy ? "Saving…" : "Save structure"}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Editing a period keeps the classes already placed in it.
                Removing a period clears its classes.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// --- workload panel ---------------------------------------------------------

function WorkloadPanel({
  palette,
  entries,
}: {
  palette: PaletteItem[]
  entries: TimetableEntry[]
}) {
  const perSubject = React.useMemo(() => {
    return palette
      .map((p) => {
        const count = entries.filter((e) =>
          p.kind === "semester"
            ? e.programme_semester_subject_id === p.refId
            : e.timetable_course_id === p.refId,
        ).length
        return { item: p, count }
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [palette, entries])

  const perTeacher = React.useMemo(() => {
    const counts = new Map<number, number>()
    for (const e of entries) {
      if (e.employee_id !== null)
        counts.set(e.employee_id, (counts.get(e.employee_id) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        employee: entries.find((e) => e.employee_id === id)?.employee ?? null,
      }))
      .sort((a, b) => b.count - a.count)
  }, [entries])

  const placed = entries.length

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Workload summary</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {placed} class{placed === 1 ? "" : "es"} placed
        </span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Periods per subject
          </h3>
          {perSubject.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              No classes placed yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {perSubject.map(({ item, count }) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      COURSE_COLORS[item.colorIndex].dot,
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {count}/wk
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Periods per teacher
          </h3>
          {perTeacher.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              No teachers assigned yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {perTeacher.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                    {initials(t.employee?.emp_display_name ?? "?")}
                  </span>
                  <span className="truncate">
                    {t.employee?.emp_display_name ?? `Employee ${t.id}`}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {t.count}/wk
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

// --- cell editor modal ------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-md",
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full flex-col rounded-lg border bg-card text-card-foreground shadow-xl",
          width,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Avatar tints for faculty cards — picked by employee id for stable variety.
// Opacity tints so they sit well on light and dark; the initials use the
// foreground token for guaranteed contrast.
const AVATAR_COLORS = [
  "bg-sky-500/20",
  "bg-emerald-500/20",
  "bg-violet-500/20",
  "bg-amber-500/20",
  "bg-rose-500/20",
  "bg-cyan-500/20",
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

// Numbered step header for the cell editor's sections.
function SectionHeading({
  step,
  label,
  tone,
}: {
  step: number
  label: string
  tone?: "required" | "optional"
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {step}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide">
        {label}
      </span>
      {tone && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            tone === "required"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          {tone}
        </span>
      )}
    </div>
  )
}

function CellEditorModal({
  timetableId,
  day,
  period,
  maxSpan,
  existing,
  palette,
  onClose,
  onSaved,
  onCleared,
}: {
  timetableId: number
  day: number
  period: TimetablePeriod
  maxSpan: number
  existing: TimetableEntry | undefined
  palette: PaletteItem[]
  onClose: () => void
  onSaved: (entry: TimetableEntry) => void
  onCleared: () => void
}) {
  const initialKey = existing
    ? existing.programme_semester_subject_id !== null
      ? `pss-${existing.programme_semester_subject_id}`
      : `crs-${existing.timetable_course_id}`
    : null

  const [courseKey, setCourseKey] = React.useState<string | null>(initialKey)
  const [teacherId, setTeacherId] = React.useState<number | null>(
    existing?.employee_id ?? null,
  )
  const [room, setRoom] = React.useState(existing?.room ?? "")
  const [note, setNote] = React.useState(existing?.note ?? "")
  const [span, setSpan] = React.useState(
    Math.min(Math.max(existing?.span ?? 1, 1), Math.max(maxSpan, 1)),
  )
  const [search, setSearch] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const selected = courseKey
    ? (palette.find((p) => p.key === courseKey) ?? null)
    : null

  const filtered = palette.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code ?? "").toLowerCase().includes(q)
    )
  })

  // Picking a subject: keep a still-valid teacher (primary or borrowed
  // alternate), auto-pick the primary if exactly one exists, otherwise
  // clear so the user picks explicitly.
  const pickCourse = (key: string) => {
    setCourseKey(key)
    const item = palette.find((p) => p.key === key)
    if (!item) return
    if (item.isElective) {
      setTeacherId(null)
      return
    }
    const validIds = new Set<number>([
      ...item.faculty.map((f) => f.employee_id),
      ...item.alternateFaculty.map((f) => f.employee_id),
    ])
    setTeacherId((prev) =>
      prev !== null && validIds.has(prev)
        ? prev
        : item.faculty.length === 1
          ? item.faculty[0].employee_id
          : null,
    )
  }

  const dayLabel = WEEKDAYS.find((d) => d.value === day)?.long ?? `Day ${day}`

  // A teacher is mandatory for every real subject; only open-elective slots
  // save without one.
  const teacherSatisfied = selected
    ? selected.isElective || teacherId !== null
    : false
  const canSave =
    !!selected && teacherSatisfied && span >= 1 && span <= maxSpan && !busy

  const save = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const entry = await upsertTimetableEntry(timetableId, {
        day_of_week: day,
        timetable_period_id: period.id,
        span,
        programme_semester_subject_id:
          selected.kind === "semester" ? selected.refId : undefined,
        timetable_course_id:
          selected.kind === "extra" ? selected.refId : undefined,
        employee_id: selected.isElective ? null : teacherId,
        room: room.trim() || null,
        note: note.trim() || null,
      })
      onSaved(entry)
    } catch (err) {
      toast.error("Couldn't save class", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await clearTimetableEntry(timetableId, day, period.id)
      onCleared()
    } catch (err) {
      toast.error("Couldn't clear class", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  return (
    <Modal
      width="max-w-2xl"
      title={
        <span>
          {dayLabel} · {period.label}{" "}
          <span className="font-normal text-muted-foreground">
            {fmtTime(period.start_time)}–{fmtTime(period.end_time)}
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          {existing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void clear()}
              disabled={busy}
              className="mr-auto text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
              Clear cell
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!canSave}>
            {busy ? "Saving…" : "Save class"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 1 — Subject ------------------------------------------------- */}
        <section>
          <SectionHeading step={1} label="Subject" tone="required" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects by name or code…"
            className="h-9"
          />
          {filtered.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              No subjects match your search.
            </p>
          ) : (
            <div className="mt-2 grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
              {filtered.map((p) => {
                const color = COURSE_COLORS[p.colorIndex]
                const active = p.key === courseKey
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pickCourse(p.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                      active
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                        : "border-input hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        color.dot,
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {p.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {p.code ??
                          (p.kind === "extra" ? "Timetable-only" : "—")}
                      </span>
                    </span>
                    {p.isElective ? (
                      <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        Elective
                      </span>
                    ) : p.kind === "extra" ? (
                      <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        Extra
                      </span>
                    ) : null}
                    {active && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* 2 — Teacher ------------------------------------------------- */}
        <section>
          <SectionHeading
            step={2}
            label="Teacher"
            tone={selected?.isElective ? undefined : "required"}
          />
          {!selected ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Choose a subject above to pick its teacher.
            </div>
          ) : selected.isElective ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <Users className="mt-0.5 size-4 shrink-0" />
              <span>
                Open-elective slot — students attend their own chosen subject,
                so no single teacher is assigned.
              </span>
            </div>
          ) : selected.faculty.length === 0 && selected.alternateFaculty.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                No faculty allocated to{" "}
                <span className="font-medium">{selected.name}</span> yet.{" "}
                {selected.kind === "semester"
                  ? "Allocate faculty on the semester's Faculty screen"
                  : "Add faculty from this subject's Manage panel"}{" "}
                before scheduling it.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {selected.faculty.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    This group's teacher
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {selected.faculty.map((f) => {
                      const active = teacherId === f.employee_id
                      return (
                        <button
                          key={f.employee_id}
                          type="button"
                          onClick={() => setTeacherId(f.employee_id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors",
                            active
                              ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                              : "border-input hover:bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-foreground",
                              avatarColor(f.employee_id),
                            )}
                          >
                            {initials(f.employee.emp_display_name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {f.employee.emp_display_name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {f.employee.emp_code}
                            </span>
                          </span>
                          {active && (
                            <Check className="size-4 shrink-0 text-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {selected.alternateFaculty.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Borrow from another group
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Teaches the same subject for another group — use only if
                      the primary is unavailable.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {selected.alternateFaculty.map((f) => {
                      const active = teacherId === f.employee_id
                      return (
                        <button
                          key={f.employee_id}
                          type="button"
                          onClick={() => setTeacherId(f.employee_id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors",
                            active
                              ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30"
                              : "border-dashed border-input hover:bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-foreground",
                              avatarColor(f.employee_id),
                            )}
                          >
                            {initials(f.employee.emp_display_name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {f.employee.emp_display_name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {f.employee.emp_code}
                              {f.attendance_group_name && (
                                <>
                                  {" · "}
                                  <span className="italic">
                                    from {f.attendance_group_name}
                                  </span>
                                </>
                              )}
                            </span>
                          </span>
                          {active && (
                            <Check className="size-4 shrink-0 text-amber-600" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3 — Room & note --------------------------------------------- */}
        <section>
          <SectionHeading step={3} label="Room & note" tone="optional" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cell-room">Room</Label>
              <Input
                id="cell-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. A-204"
                maxLength={48}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cell-note">Note</Label>
              <Input
                id="cell-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Lab session"
                maxLength={160}
                className="h-9"
              />
            </div>
          </div>
          {maxSpan > 1 ? (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="cell-span">Span (periods)</Label>
              <Input
                id="cell-span"
                type="number"
                min={1}
                max={maxSpan}
                value={span}
                onChange={(e) =>
                  setSpan(
                    Math.max(
                      1,
                      Math.min(maxSpan, Number(e.target.value) || 1),
                    ),
                  )
                }
                className="h-9 w-28"
              />
              <p className="text-[11px] text-muted-foreground">
                Merge up to {maxSpan} consecutive periods (e.g. a lab).
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  )
}

// --- edit details sheet -----------------------------------------------------

function EditDetailsSheet({
  open,
  onOpenChange,
  timetable,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  timetable: Timetable
  onSaved: (tt: Timetable) => void
}) {
  const [name, setName] = React.useState(timetable.name)
  const [days, setDays] = React.useState<number[]>(timetable.working_days)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(timetable.name)
      setDays(timetable.working_days)
      setBusy(false)
    }
  }, [open, timetable])

  const toggleDay = (value: number) => {
    setDays((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value].sort((a, b) => a - b),
    )
  }

  const droppingDayWithClasses = WEEKDAYS.some(
    (d) =>
      timetable.working_days.includes(d.value) &&
      !days.includes(d.value) &&
      timetable.entries.some((e) => e.day_of_week === d.value),
  )

  const canSave = name.trim().length > 0 && days.length > 0 && !busy

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      const updated = await updateTimetable(timetable.id, {
        name: name.trim(),
        working_days: days,
      })
      onSaved(updated)
      toast.success("Timetable updated")
    } catch (err) {
      toast.error("Couldn't update timetable", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit timetable details</SheetTitle>
          <SheetDescription>
            Name and working days. The semester's planned dates control the
            calendar window.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={96}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Working days</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    days.includes(d.value)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {d.short}
                </button>
              ))}
            </div>
            {droppingDayWithClasses && (
              <p className="text-[11px] font-medium text-destructive">
                Classes already placed on a removed day will be deleted.
              </p>
            )}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- faculty multi-picker (shared by add/manage course) ---------------------

function FacultyPicker({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  // Chips are rendered from ids alone, so resolve them for their names.
  const byId = useEmployeeNames(selectedIds)

  return (
    <div className="space-y-2">
      <EmployeePicker
        value={null}
        excludeIds={selectedIds}
        onChange={(v) => v != null && onChange([...selectedIds, v])}
        placeholder="Add faculty…"
        searchPlaceholder="Search faculty…"
        emptyMessage="No matches"
        disabled={disabled}
      />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const e = byId.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background py-0.5 pl-2 pr-1 text-xs"
              >
                <span className="font-medium">
                  {e?.emp_display_name ?? `#${id}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(selectedIds.filter((x) => x !== id))
                  }
                  disabled={disabled}
                  className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- add course sheet -------------------------------------------------------

function AddCourseSheet({
  open,
  onOpenChange,
  timetableId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  timetableId: number
  onSaved: (tt: Timetable) => void
}) {
  const [name, setName] = React.useState("")
  const [facultyIds, setFacultyIds] = React.useState<number[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName("")
      setFacultyIds([])
      setBusy(false)
    }
  }, [open])

  const canSave = !busy && name.trim().length > 0 && facultyIds.length > 0

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      const updated = await createTimetableCourse(timetableId, {
        custom_label: name.trim(),
        employee_ids: facultyIds,
      })
      onSaved(updated)
      toast.success("Added to this timetable")
    } catch (err) {
      toast.error("Couldn't add it", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a timetable-only subject</SheetTitle>
          <SheetDescription>
            For activities beyond the semester's subjects — Library, Sports,
            Mentoring, a guest session. The semester's own subjects appear in
            the palette automatically; configure them on the Subjects screen.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="course-name">Name</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Library, Sports, Mentoring"
              maxLength={96}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Faculty</Label>
            <FacultyPicker
              selectedIds={facultyIds}
              onChange={setFacultyIds}
              disabled={busy}
            />
            <p
              className={cn(
                "text-[11px]",
                facultyIds.length === 0
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              At least one faculty member is required — they're mapped to this
              timetable only.
            </p>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- manage course sheet ----------------------------------------------------

function ManageCourseSheet({
  open,
  onOpenChange,
  course,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: TimetableCourse
  onSaved: (tt: Timetable) => void
}) {
  const isCustom = course.subject_id === null
  const [label, setLabel] = React.useState(course.custom_label ?? "")
  const [facultyIds, setFacultyIds] = React.useState<number[]>(
    course.faculty.map((f) => f.employee_id),
  )
  const [busy, setBusy] = React.useState(false)
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  const courseName = course.subject?.name ?? course.custom_label ?? "Course"

  const save = async () => {
    setBusy(true)
    try {
      // Persist a renamed free-text label first, then the faculty roster.
      if (isCustom && label.trim() && label.trim() !== course.custom_label) {
        await updateTimetableCourse(course.id, { custom_label: label.trim() })
      }
      const updated = await setTimetableCourseFaculty(course.id, facultyIds)
      onSaved(updated)
      toast.success("Subject updated")
    } catch (err) {
      toast.error("Couldn't update subject", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const updated = await deleteTimetableCourse(course.id)
      onSaved(updated)
      toast.success("Subject removed from this timetable")
    } catch (err) {
      toast.error("Couldn't remove subject", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Manage subject</SheetTitle>
            <SheetDescription>
              {course.subject
                ? `${course.subject.code} · ${course.subject.name}`
                : "A timetable-only activity."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-5">
            {isCustom && (
              <div className="space-y-1.5">
                <Label htmlFor="manage-label">Activity name</Label>
                <Input
                  id="manage-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={96}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <FacultyPicker
                selectedIds={facultyIds}
                onChange={setFacultyIds}
                disabled={busy}
              />
              <p
                className={cn(
                  "text-[11px]",
                  facultyIds.length === 0
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
                )}
              >
                At least one faculty member is required. Faculty mapped here
                are exclusive to this timetable.
              </p>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-muted-foreground">
                Removing this subject also clears every class placed with it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
              >
                <Trash2 />
                Remove subject
              </Button>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={
                busy ||
                facultyIds.length === 0 ||
                (isCustom && label.trim().length === 0)
              }
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this subject?"
        description={
          <>
            <span className="font-medium text-foreground">{courseName}</span>{" "}
            and every class placed with it will be removed from this timetable.
          </>
        }
        confirmLabel="Remove subject"
        tone="destructive"
        icon={Trash2}
        loading={busy}
        onConfirm={remove}
      />
    </>
  )
}
