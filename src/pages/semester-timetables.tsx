import * as React from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  Copy,
  Layers,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
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
import {
  listAttendanceGroups,
  type AttendanceGroup,
} from "@/lib/attendance-groups"
import {
  listProgrammeSemesters,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  createTimetable,
  deleteTimetable,
  duplicateTimetable,
  listTimetables,
  WEEKDAYS,
  type TimetableListItem,
} from "@/lib/timetables"

// A timetable's badge — draft/archived keep their status word; a published
// timetable shows where it sits in time (derived from its effective dates):
// Active now, Next up, Upcoming or Ended.
type RowBadge = {
  label: string
  className: string
  title: string
  dot?: boolean
}

function rowBadge(t: TimetableListItem, isNext: boolean): RowBadge {
  if (t.status === "draft") {
    return {
      label: "Draft",
      className: "bg-muted text-muted-foreground border border-input",
      title: "Not published yet — not in effect for the group.",
    }
  }
  if (t.status === "archived") {
    return {
      label: "Archived",
      className:
        "bg-muted text-muted-foreground border border-input opacity-80",
      title: "Archived and read-only.",
    }
  }
  const today = todayIso()
  if (t.effective_from > today) {
    return {
      label: isNext ? "Next up" : "Upcoming",
      className: "bg-primary/10 text-primary border border-primary/30",
      title: isNext
        ? "The next timetable to take effect for this group."
        : "A future-dated timetable, planned ahead.",
    }
  }
  if (t.effective_to !== null && t.effective_to < today) {
    return {
      label: "Ended",
      className: "bg-warning/15 text-warning border border-warning/40",
      title: "Its effective dates have passed — you can archive it.",
    }
  }
  return {
    label: "Active now",
    className: "bg-success/10 text-success border border-success/30",
    title: "In effect today — the group's current schedule.",
    dot: true,
  }
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
}

function effectiveRange(from: string, to: string | null): string {
  return to ? `${formatDate(from)} → ${formatDate(to)}` : `${formatDate(from)} onwards`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Dedicated full-screen for the Timetable section of a semester's settings.
// Lists every timetable of the semester, grouped by attendance group, and
// flags groups that still lack a published schedule.
export function SemesterTimetablesPage() {
  const navigate = useNavigate()
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
  const [groups, setGroups] = React.useState<AttendanceGroup[]>([])
  const [timetables, setTimetables] = React.useState<TimetableListItem[]>([])
  const [shellLoading, setShellLoading] = React.useState(true)
  const [listLoading, setListLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<TimetableListItem | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [duplicatingId, setDuplicatingId] = React.useState<number | null>(null)

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
      const [semRes, groupRes] = await Promise.all([
        listProgrammeSemesters({
          programmeId,
          admissionYearId,
          pageSize: 100,
          sortBy: "semester",
          sortOrder: "asc",
        }),
        listAttendanceGroups(programmeId, admissionYearId),
      ])
      const row = semRes.rows.find((r) => r.id === id) ?? null
      if (!row) {
        setFailed(true)
        return
      }
      setSemester(row)
      setGroups(groupRes)
    } catch {
      setFailed(true)
    } finally {
      setShellLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void loadShell()
  }, [loadShell])

  const loadList = React.useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setListLoading(false)
      return
    }
    setListLoading(true)
    try {
      setTimetables(await listTimetables(id))
    } catch (err) {
      toast.error("Couldn't load timetables", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setListLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void loadList()
  }, [loadList])

  // Timetables bucketed by attendance group, each bucket date-ordered.
  const byGroup = React.useMemo(() => {
    const map = new Map<number, TimetableListItem[]>()
    for (const t of timetables) {
      const arr = map.get(t.attendance_group_id) ?? []
      arr.push(t)
      map.set(t.attendance_group_id, arr)
    }
    return map
  }, [timetables])

  const uncovered = React.useMemo(
    () =>
      groups.filter(
        (g) =>
          !(byGroup.get(g.id) ?? []).some((t) => t.status === "published"),
      ),
    [groups, byGroup],
  )

  const handleDuplicate = async (t: TimetableListItem) => {
    setDuplicatingId(t.id)
    try {
      const copy = await duplicateTimetable(t.id, {
        name: `${t.name} (copy)`,
        effective_from: t.effective_from,
        effective_to: t.effective_to,
      })
      toast.success("Timetable duplicated", {
        description: "Opened the new draft copy.",
      })
      void navigate({
        to: "/masters/programme-configuration/semester/$programmeSemesterId/timetables/$timetableId",
        params: {
          programmeSemesterId: String(id),
          timetableId: String(copy.id),
        },
        search: { programmeId, admissionYearId },
      })
    } catch (err) {
      toast.error("Couldn't duplicate timetable", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteTimetable(deleting.id)
      toast.success("Timetable deleted")
      setDeleting(null)
      void loadList()
    } catch (err) {
      toast.error("Couldn't delete timetable", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setDeleteBusy(false)
    }
  }

  const openEditor = (timetableId: number) => {
    void navigate({
      to: "/masters/programme-configuration/semester/$programmeSemesterId/timetables/$timetableId",
      params: { programmeSemesterId: String(id), timetableId: String(timetableId) },
      search: { programmeId, admissionYearId },
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
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
        <ListSkeleton />
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
                  Timetables
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
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                disabled={groups.length === 0}
              >
                <CalendarPlus />
                New timetable
              </Button>
            </div>
          </header>

          {groups.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
              <EmptyState
                icon={Layers}
                title="No attendance groups yet"
                description="A timetable belongs to an attendance group. Create the batch's attendance groups first."
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
          ) : (
            <>
              {uncovered.length > 0 && !listLoading && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p className="text-foreground">
                    No published timetable yet for{" "}
                    <span className="font-medium">
                      {uncovered.map((g) => g.name).join(", ")}
                    </span>
                    . Create one and publish it so the group has an active
                    schedule.
                  </p>
                </div>
              )}

              {listLoading ? (
                <ListSkeleton />
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <GroupSection
                      key={g.id}
                      group={g}
                      timetables={byGroup.get(g.id) ?? []}
                      duplicatingId={duplicatingId}
                      onOpen={openEditor}
                      onDuplicate={handleDuplicate}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {semester && (
        <CreateTimetableSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          programmeSemesterId={id}
          groups={groups}
          onCreated={(t) => {
            setCreateOpen(false)
            openEditor(t.id)
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this timetable?"
        description={
          deleting ? (
            <>
              <span className="font-medium text-foreground">
                {deleting.name}
              </span>{" "}
              and all its periods, courses and scheduled classes will be
              permanently removed. This can't be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete timetable"
        tone="destructive"
        icon={Trash2}
        loading={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// One attendance group and its timetables, laid out as a date-ordered
// timeline so current and future revisions read top-to-bottom.
function GroupSection({
  group,
  timetables,
  duplicatingId,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  group: AttendanceGroup
  timetables: TimetableListItem[]
  duplicatingId: number | null
  onOpen: (id: number) => void
  onDuplicate: (t: TimetableListItem) => void
  onDelete: (t: TimetableListItem) => void
}) {
  // The soonest published, future-dated timetable — it gets the "Next up"
  // badge; later future-dated ones are just "Upcoming".
  const nextId = React.useMemo(() => {
    const today = todayIso()
    const upcoming = timetables
      .filter((t) => t.status === "published" && t.effective_from > today)
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    return upcoming[0]?.id ?? null
  }, [timetables])

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Layers className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{group.name}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {timetables.length} timetable{timetables.length === 1 ? "" : "s"}
        </span>
      </div>
      {timetables.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs italic text-muted-foreground">
          No timetable for this group yet.
        </p>
      ) : (
        <ol className="divide-y">
          {timetables.map((t) => (
            <li key={t.id}>
              <TimetableRow
                timetable={t}
                isNext={t.id === nextId}
                duplicating={duplicatingId === t.id}
                onOpen={() => onOpen(t.id)}
                onDuplicate={() => onDuplicate(t)}
                onDelete={() => onDelete(t)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function TimetableRow({
  timetable: t,
  isNext,
  duplicating,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  timetable: TimetableListItem
  isNext: boolean
  duplicating: boolean
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const days = WEEKDAYS.filter((d) => t.working_days.includes(d.value))
  const badge = rowBadge(t, isNext)
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
      <button
        type="button"
        onClick={onOpen}
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
        aria-label={`Open ${t.name}`}
      >
        <CalendarClock className="size-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{t.name}</span>
          <span
            title={badge.title}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              badge.className,
            )}
          >
            {badge.dot && (
              <span className="size-1.5 rounded-full bg-success" />
            )}
            {badge.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <CalendarRange className="size-3.5" />
          <span>{effectiveRange(t.effective_from, t.effective_to)}</span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums">
            {t.teaching_period_count} period
            {t.teaching_period_count === 1 ? "" : "s"}/day
          </span>
          <span className="opacity-40">·</span>
          <span>{days.map((d) => d.short).join(", ") || "No days"}</span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums">{t.entry_count} classes placed</span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDuplicate}
          disabled={duplicating}
          title="Duplicate"
        >
          <Copy className="size-4" />
          <span className="sr-only">Duplicate</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          title="Delete"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
        <Button size="sm" onClick={onOpen}>
          Open
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  )
}

// --- New timetable sheet ----------------------------------------------------

const MINUTE = 60

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * MINUTE + m
}

function minToTime(m: number): string {
  const h = Math.floor(m / MINUTE)
  const min = m % MINUTE
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

// Build the period rows from the generator inputs — N teaching periods with
// an optional break inserted after one of them.
function generatePeriods(opts: {
  count: number
  start: string
  lengthMin: number
  breakAfter: number | null
  breakMin: number
}): { label: string; start_time: string; end_time: string; is_break: boolean }[] {
  const out: {
    label: string
    start_time: string
    end_time: string
    is_break: boolean
  }[] = []
  let cursor = timeToMin(opts.start)
  for (let i = 1; i <= opts.count; i++) {
    out.push({
      label: `Period ${i}`,
      start_time: minToTime(cursor),
      end_time: minToTime(cursor + opts.lengthMin),
      is_break: false,
    })
    cursor += opts.lengthMin
    if (
      opts.breakAfter !== null &&
      i === opts.breakAfter &&
      i < opts.count
    ) {
      out.push({
        label: "Lunch Break",
        start_time: minToTime(cursor),
        end_time: minToTime(cursor + opts.breakMin),
        is_break: true,
      })
      cursor += opts.breakMin
    }
  }
  return out
}

function CreateTimetableSheet({
  open,
  onOpenChange,
  programmeSemesterId,
  groups,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  programmeSemesterId: number
  groups: AttendanceGroup[]
  onCreated: (t: { id: number }) => void
}) {
  const [groupId, setGroupId] = React.useState<number | null>(null)
  const [name, setName] = React.useState("")
  const [from, setFrom] = React.useState(todayIso())
  const [to, setTo] = React.useState("")
  const [days, setDays] = React.useState<number[]>([1, 2, 3, 4, 5])
  const [count, setCount] = React.useState(6)
  const [start, setStart] = React.useState("09:00")
  const [length, setLength] = React.useState(50)
  const [breakAfter, setBreakAfter] = React.useState(3)
  const [breakMin, setBreakMin] = React.useState(40)
  const [busy, setBusy] = React.useState(false)

  // Reset the form each time the sheet opens.
  React.useEffect(() => {
    if (open) {
      setGroupId(groups.length === 1 ? groups[0].id : null)
      setName("")
      setFrom(todayIso())
      setTo("")
      setDays([1, 2, 3, 4, 5])
      setCount(6)
      setStart("09:00")
      setLength(50)
      setBreakAfter(3)
      setBreakMin(40)
      setBusy(false)
    }
  }, [open, groups])

  const groupOptions: ComboboxOption[] = groups.map((g) => ({
    value: g.id,
    label: g.name,
  }))

  const periods = React.useMemo(
    () =>
      generatePeriods({
        count,
        start,
        lengthMin: length,
        breakAfter: breakAfter > 0 && breakAfter < count ? breakAfter : null,
        breakMin,
      }),
    [count, start, length, breakAfter, breakMin],
  )
  const lastEnd = periods.length > 0 ? periods[periods.length - 1].end_time : start
  const overflows = timeToMin(lastEnd) > 24 * MINUTE

  const canSubmit =
    groupId !== null &&
    name.trim().length > 0 &&
    from.length > 0 &&
    days.length > 0 &&
    count >= 1 &&
    !overflows &&
    !busy

  const toggleDay = (value: number) => {
    setDays((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value].sort((a, b) => a - b),
    )
  }

  const submit = async () => {
    if (!canSubmit || groupId === null) return
    setBusy(true)
    try {
      const created = await createTimetable({
        programme_semester_id: programmeSemesterId,
        attendance_group_id: groupId,
        name: name.trim(),
        effective_from: from,
        effective_to: to ? to : null,
        working_days: days,
        periods,
      })
      toast.success("Timetable created", {
        description: "Opened the editor — add classes to the grid.",
      })
      onCreated(created)
    } catch (err) {
      toast.error("Couldn't create timetable", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New timetable</SheetTitle>
          <SheetDescription>
            A timetable belongs to one attendance group. Set its effective
            dates so you can plan revisions ahead.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label>Attendance group</Label>
            <Combobox
              value={groupId}
              options={groupOptions}
              onChange={setGroupId}
              placeholder="Select a group…"
              searchPlaceholder="Search groups…"
              emptyMessage="No groups"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-name">Name</Label>
            <Input
              id="tt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Section A — Odd semester"
              maxLength={96}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Effective from</Label>
              <DatePicker value={from} onChange={setFrom} />
            </div>
            <div className="space-y-1.5">
              <Label>Effective to</Label>
              <DatePicker
                value={to}
                onChange={setTo}
                allowClear
                placeholder="Open-ended"
              />
            </div>
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
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Period structure
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Periods / day"
                value={count}
                min={1}
                max={16}
                onChange={setCount}
              />
              <div className="space-y-1.5">
                <Label htmlFor="tt-start">Day starts</Label>
                <Input
                  id="tt-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <NumField
                label="Period length (min)"
                value={length}
                min={20}
                max={180}
                onChange={setLength}
              />
              <NumField
                label="Break after period"
                value={breakAfter}
                min={0}
                max={count}
                onChange={setBreakAfter}
                hint="0 = no break"
              />
              <NumField
                label="Break length (min)"
                value={breakMin}
                min={10}
                max={120}
                onChange={setBreakMin}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {periods.length} rows · {start}–{lastEnd}. You can fine-tune
              every period later in the editor.
            </p>
            {overflows && (
              <p className="text-xs font-medium text-destructive">
                The schedule runs past midnight — reduce the count or length.
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
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? "Creating…" : "Create timetable"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-xs">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-12 w-full" />
            <Skeleton className="mt-2 h-12 w-full" />
          </div>
        ))}
      </div>
    </>
  )
}
