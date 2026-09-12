import * as React from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Layers,
  Star,
  Trash2,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
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
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  listAttendanceGroups,
  type AttendanceGroup,
} from "@/lib/attendance-groups"
import {
  getProgrammeSemester,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  cloneTimetable,
  createTimetable,
  deleteTimetable,
  listTimetables,
  setDefaultTimetable,
  WEEKDAYS,
  type TimetableListItem,
} from "@/lib/timetables"

// Per attendance group, the admin can save multiple timetable templates
// ("Regular week", "Exam week", ...). The page shows each group with its
// templates underneath plus an "Add template" button. The Schedule view
// then lets the group incharge pick which template to publish per week.
export function SemesterTimetablesPage() {
  const params = useParams({ strict: false }) as { programmeSemesterId?: string }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const navigate = useNavigate()
  const id = Number(params.programmeSemesterId)
  const programmeId = search.programmeId
  const admissionYearId = search.admissionYearId

  const [semester, setSemester] = React.useState<ProgrammeSemester | null>(null)
  const [groups, setGroups] = React.useState<AttendanceGroup[]>([])
  const [timetables, setTimetables] = React.useState<TimetableListItem[]>([])
  const [shellLoading, setShellLoading] = React.useState(true)
  const [listLoading, setListLoading] = React.useState(true)
  const [shellFailed, setShellFailed] = React.useState(false)
  const [createFor, setCreateFor] = React.useState<AttendanceGroup | null>(null)
  const [deleting, setDeleting] = React.useState<TimetableListItem | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [cloning, setCloning] = React.useState<TimetableListItem | null>(null)
  const [settingDefaultId, setSettingDefaultId] = React.useState<number | null>(
    null,
  )

  const handleSetDefault = async (t: TimetableListItem) => {
    setSettingDefaultId(t.id)
    try {
      await setDefaultTimetable(t.id)
      toast.success(`"${t.name}" is now the default for this group.`)
      await loadTimetables()
    } catch (err) {
      toast.error("Couldn't set default", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSettingDefaultId(null)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    setShellLoading(true)
    setShellFailed(false)
    void (async () => {
      try {
        const semRow = await getProgrammeSemester(id)
        if (cancelled) return
        setSemester(semRow)
        if (programmeId !== undefined && admissionYearId !== undefined) {
          const g = await listAttendanceGroups(programmeId, admissionYearId)
          if (!cancelled) setGroups(g)
        }
      } catch {
        if (!cancelled) setShellFailed(true)
      } finally {
        if (!cancelled) setShellLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, programmeId, admissionYearId])

  const loadTimetables = React.useCallback(async () => {
    setListLoading(true)
    try {
      const list = await listTimetables(id)
      setTimetables(list)
    } catch {
      // Empty list is recoverable from refresh.
    } finally {
      setListLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (!shellLoading && semester) void loadTimetables()
  }, [shellLoading, semester, loadTimetables])

  const byGroup = React.useMemo(() => {
    const map = new Map<number, TimetableListItem[]>()
    for (const t of timetables) {
      const bucket = map.get(t.attendance_group_id) ?? []
      bucket.push(t)
      map.set(t.attendance_group_id, bucket)
    }
    // Stable order within each group.
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    }
    return map
  }, [timetables])

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteTimetable(deleting.id)
      toast.success(`Removed ${deleting.name}.`)
      setDeleting(null)
      await loadTimetables()
    } catch (err) {
      toast.error("Couldn't delete template", {
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

  const openSchedule = (timetableId: number) => {
    // The Schedule page is group-level — it just needs any of the group's
    // templates as the URL anchor to derive the group + load all peer
    // templates for the picker.
    void navigate({
      to: "/masters/programme-configuration/semester/$programmeSemesterId/timetables/$timetableId/schedule",
      params: { programmeSemesterId: String(id), timetableId: String(timetableId) },
      search: { programmeId, admissionYearId },
    })
  }

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
      icon={CalendarClock}
      title="Timetables"
    />
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      {header}

      {shellLoading ? (
        <ListSkeleton />
      ) : shellFailed || !semester ? (
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {semester.programme.code}
            </span>
            <span className="opacity-40">·</span>
            <span className="font-mono text-foreground">
              {semester.semester.code}
            </span>
            <span className="opacity-40">·</span>
            <span className="tabular-nums">
              {semester.admission_year.display_year}
            </span>
          </div>

          {listLoading ? (
            <ListSkeleton />
          ) : groups.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={Layers}
                title="No attendance groups in this batch yet"
                description="Create attendance groups first — every timetable belongs to one group."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/masters/programme-configuration/attendance-groups"
                      search={{ programmeId, admissionYearId }}
                    >
                      Manage attendance groups
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <GroupSection
                  key={g.id}
                  group={g}
                  templates={byGroup.get(g.id) ?? []}
                  settingDefaultId={settingDefaultId}
                  onAdd={() => setCreateFor(g)}
                  onOpen={openEditor}
                  onSchedule={openSchedule}
                  onClone={(t) => setCloning(t)}
                  onSetDefault={(t) => void handleSetDefault(t)}
                  onDelete={(t) => setDeleting(t)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {semester && (
        <CreateTimetableSheet
          open={createFor !== null}
          onOpenChange={(o) => {
            if (!o) setCreateFor(null)
          }}
          programmeSemesterId={id}
          group={createFor}
          existingNames={
            createFor ? (byGroup.get(createFor.id) ?? []).map((t) => t.name) : []
          }
          onCreated={(t) => {
            setCreateFor(null)
            openEditor(t.id)
          }}
        />
      )}

      <CloneTimetableSheet
        open={cloning !== null}
        onOpenChange={(o) => {
          if (!o) setCloning(null)
        }}
        source={cloning}
        existingNames={
          cloning
            ? (byGroup.get(cloning.attendance_group_id) ?? []).map((t) => t.name)
            : []
        }
        onCloned={async (created) => {
          setCloning(null)
          await loadTimetables()
          openEditor(created.id)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={
          deleting ? (
            <>
              <span className="font-medium text-foreground">
                {deleting.name}
              </span>{" "}
              and its periods, courses and cells will be removed. Existing
              class_sessions stay so attendance history is preserved.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function GroupSection({
  group,
  templates,
  settingDefaultId,
  onAdd,
  onOpen,
  onSchedule,
  onClone,
  onSetDefault,
  onDelete,
}: {
  group: AttendanceGroup
  templates: TimetableListItem[]
  settingDefaultId: number | null
  onAdd: () => void
  onOpen: (id: number) => void
  onSchedule: (id: number) => void
  onClone: (t: TimetableListItem) => void
  onSetDefault: (t: TimetableListItem) => void
  onDelete: (t: TimetableListItem) => void
}) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Layers className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{group.name}</span>
            <span className="text-xs text-muted-foreground">{group.code}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {templates.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSchedule(templates[0].id)}
              title="Open the week strip for this group"
            >
              <CalendarCheck className="size-4" />
              Schedule
            </Button>
          )}
          <Button size="sm" onClick={onAdd}>
            <CalendarPlus className="size-4" />
            Add template
          </Button>
        </div>
      </div>
      {templates.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs italic text-muted-foreground">
          No templates yet — add one to start placing classes.
        </p>
      ) : (
        <ul className="divide-y">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              timetable={t}
              busySettingDefault={settingDefaultId === t.id}
              onOpen={() => onOpen(t.id)}
              onClone={() => onClone(t)}
              onSetDefault={() => onSetDefault(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TemplateRow({
  timetable,
  busySettingDefault,
  onOpen,
  onClone,
  onSetDefault,
  onDelete,
}: {
  timetable: TimetableListItem
  busySettingDefault: boolean
  onOpen: () => void
  onClone: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  const days = WEEKDAYS.filter((d) => timetable.working_days.includes(d.value))
  return (
    <li
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/20",
        timetable.is_default && "bg-primary/[0.02]",
      )}
    >
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          timetable.is_default
            ? "bg-primary/15 text-primary"
            : "bg-primary/10 text-primary",
        )}
      >
        <FileSpreadsheet className="size-4" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{timetable.name}</span>
          {timetable.is_default && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Star className="size-3 fill-primary" />
              Default
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {timetable.teaching_period_count} period
            {timetable.teaching_period_count === 1 ? "" : "s"}/day
          </span>
          <span className="opacity-40">·</span>
          <span>{days.map((d) => d.short).join(", ") || "No days"}</span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums">
            {timetable.entry_count} cell{timetable.entry_count === 1 ? "" : "s"} placed
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {!timetable.is_default && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onSetDefault}
            disabled={busySettingDefault}
            title="Make this the group's default template"
            className="text-muted-foreground hover:text-foreground"
          >
            <Star className="size-4" />
            <span className="sr-only">Set as default</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClone}
          title="Clone this template"
          className="text-muted-foreground hover:text-foreground"
        >
          <Copy className="size-4" />
          <span className="sr-only">Clone</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          title="Delete template"
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
    </li>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}

// --- create sheet ----------------------------------------------------------

function CreateTimetableSheet({
  open,
  onOpenChange,
  programmeSemesterId,
  group,
  existingNames,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  programmeSemesterId: number
  group: AttendanceGroup | null
  existingNames: string[]
  onCreated: (t: { id: number }) => void
}) {
  const [name, setName] = React.useState("")
  const [days, setDays] = React.useState<number[]>([1, 2, 3, 4, 5])
  const [count, setCount] = React.useState(6)
  const [start, setStart] = React.useState("09:00")
  const [length, setLength] = React.useState(50)
  const [breakAfter, setBreakAfter] = React.useState(3)
  const [breakMin, setBreakMin] = React.useState(40)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const suggested =
        existingNames.length === 0
          ? "Regular week"
          : `Template ${existingNames.length + 1}`
      setName(suggested)
      setDays([1, 2, 3, 4, 5])
      setCount(6)
      setStart("09:00")
      setLength(50)
      setBreakAfter(3)
      setBreakMin(40)
      setBusy(false)
    }
  }, [open, existingNames])

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
  const duplicate = existingNames.includes(name.trim())

  const canSubmit =
    group !== null &&
    name.trim().length > 0 &&
    !duplicate &&
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
    if (!canSubmit || group === null) return
    setBusy(true)
    try {
      const created = await createTimetable({
        programme_semester_id: programmeSemesterId,
        attendance_group_id: group.id,
        name: name.trim(),
        working_days: days,
        periods,
      })
      toast.success("Template created", {
        description: "Opened the editor — add classes to the grid.",
      })
      onCreated(created)
    } catch (err) {
      toast.error("Couldn't create template", {
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
          <SheetTitle>
            New template{group ? ` — ${group.name}` : ""}
          </SheetTitle>
          <SheetDescription>
            Give it a meaningful name (e.g. "Regular week", "Exam week").
            The Schedule view lets you pick which template to publish for
            each week.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={96}
              aria-invalid={duplicate}
            />
            {duplicate && (
              <p className="text-xs text-destructive">
                A template with this name already exists for this group.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Working days</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={days.includes(d.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    days.includes(d.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Periods/day</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Day starts at</Label>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period length (min)</Label>
              <Input
                type="number"
                min={10}
                max={240}
                value={length}
                onChange={(e) =>
                  setLength(Math.max(10, Math.min(240, Number(e.target.value) || 50)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Break after (period)</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={breakAfter}
                onChange={(e) =>
                  setBreakAfter(Math.max(0, Math.min(20, Number(e.target.value) || 0)))
                }
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Break length (min)</Label>
              <Input
                type="number"
                min={0}
                max={240}
                value={breakMin}
                onChange={(e) =>
                  setBreakMin(Math.max(0, Math.min(240, Number(e.target.value) || 0)))
                }
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Preview · ends {periods.length > 0 ? lastEnd : start}
              {overflows && (
                <span className="ml-2 text-destructive">
                  (overflows midnight)
                </span>
              )}
            </p>
            <ul className="mt-2 space-y-0.5 text-xs">
              {periods.map((p, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2",
                    p.is_break && "text-muted-foreground italic",
                  )}
                >
                  <span className="w-16 shrink-0 tabular-nums">
                    {p.start_time}–{p.end_time}
                  </span>
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? "Creating…" : "Create template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- helpers (period generator) -------------------------------------------

const MINUTE = 60

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map((p) => Number(p))
  return h * 60 + (m || 0)
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

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

// --- clone sheet ----------------------------------------------------------

function CloneTimetableSheet({
  open,
  onOpenChange,
  source,
  existingNames,
  onCloned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: TimetableListItem | null
  existingNames: string[]
  onCloned: (created: { id: number }) => void
}) {
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open && source) {
      setName(suggestCloneName(source.name, existingNames))
      setBusy(false)
    }
  }, [open, source, existingNames])

  const trimmed = name.trim()
  const duplicate =
    source !== null &&
    existingNames.includes(trimmed) &&
    trimmed !== source.name // own-name vs collision read the same; the server still rejects equal-to-source
  const canSubmit = source !== null && trimmed.length > 0 && !duplicate && !busy

  const submit = async () => {
    if (!source || !canSubmit) return
    setBusy(true)
    try {
      const created = await cloneTimetable(source.id, { name: trimmed })
      toast.success("Template cloned", {
        description: "Opened the clone — tweak as needed.",
      })
      onCloned(created)
    } catch (err) {
      toast.error("Couldn't clone template", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Clone {source ? `"${source.name}"` : "template"}
          </SheetTitle>
          <SheetDescription>
            The clone keeps the same group, working days, periods, courses
            and grid cells. Pick a new name and tweak the copy for a variant
            week (e.g. exam week or short day).
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="clone-name" className="text-xs">
              Name
            </Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={96}
              aria-invalid={duplicate}
            />
            {duplicate && (
              <p className="text-xs text-destructive">
                A template with this name already exists for this group.
              </p>
            )}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? "Cloning…" : "Clone & open"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Find an unused "<src> (copy)" / "<src> (copy 2)" / ... candidate so the
// admin can hit Enter without renaming. Falls back to the source name +
// numeric suffix when " (copy)" itself collides.
function suggestCloneName(src: string, taken: string[]): string {
  const set = new Set(taken)
  const first = `${src} (copy)`
  if (!set.has(first)) return first
  for (let i = 2; i < 50; i++) {
    const candidate = `${src} (copy ${i})`
    if (!set.has(candidate)) return candidate
  }
  return first
}
