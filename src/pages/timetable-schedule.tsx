import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  List,
  MapPin,
  RefreshCw,
  RotateCcw,
  Settings2,
  Star,
  UserCheck,
  UserCog,
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
import { ApiError } from "@/lib/api"
import {
  cancelSession,
  getRoster,
  listClassSessions,
  markAttendance,
  substituteSession,
  uncancelSession,
  type AttendanceStatus,
  type ClassSession,
  type ClassSessionStatus,
  type RosterStudent,
} from "@/lib/class-sessions"
import { listEmployees, type Employee } from "@/lib/employees"
import {
  getTimetable,
  getTimetableWeekSummaries,
  listTimetables,
  previewTimetableWeek,
  publishTimetableWeek,
  WEEKDAYS,
  type PreviewResult,
  type Timetable,
  type TimetableListItem,
  type WeekSummary,
} from "@/lib/timetables"
import { cn } from "@/lib/utils"

// --- date helpers (UTC, calendar-day arithmetic) ----------------------------

function isoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => Number(p))
  return new Date(Date.UTC(y, m - 1, d))
}

function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDate(d)
}

function isoWeekday(s: string): number {
  const dow = parseISO(s).getUTCDay()
  return dow === 0 ? 7 : dow
}

function startOfWeek(s: string): string {
  return addDays(s, -(isoWeekday(s) - 1))
}

function todayISO(): string {
  return isoDate(new Date())
}

const rangeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
})
const rangeWithYearFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  year: "numeric",
})

// "May 27 – Jun 02, 2026" when both ends share a year; the year is only
// shown once at the end. Year-straddling weeks render as
// "Dec 29, 2025 – Jan 04, 2026" so the boundary is unambiguous.
function formatWeekRange(start: string, end: string): string {
  const startD = parseISO(start)
  const endD = parseISO(end)
  if (startD.getUTCFullYear() === endD.getUTCFullYear()) {
    return `${rangeFmt.format(startD)} – ${rangeWithYearFmt.format(endD)}`
  }
  return `${rangeWithYearFmt.format(startD)} – ${rangeWithYearFmt.format(endD)}`
}

const fullDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "2-digit",
})

const WEEKS_IN_STRIP = 8
const STRIP_PREVIOUS_WEEKS = 1

// --- page ------------------------------------------------------------------

export function TimetableSchedulePage() {
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
    timetableId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const anchorTimetableId = Number(params.timetableId)
  const programmeId = search.programmeId
  const admissionYearId = search.admissionYearId

  // The anchor timetable is just the URL deep-link; the page itself operates
  // at the group level (loads every template in the group).
  const [anchor, setAnchor] = React.useState<Timetable | null>(null)
  const [templates, setTemplates] = React.useState<TimetableListItem[]>([])
  const [stripStart, setStripStart] = React.useState<string>(
    startOfWeek(addDays(todayISO(), -STRIP_PREVIOUS_WEEKS * 7)),
  )
  const [summaries, setSummaries] = React.useState<WeekSummary[]>([])
  const [shellLoading, setShellLoading] = React.useState(true)
  const [shellFailed, setShellFailed] = React.useState(false)
  const [summariesLoading, setSummariesLoading] = React.useState(false)

  // A single modal flow for both "Preview" and "Publish" actions on a week.
  // The modal shows the would-be sessions and offers a Publish CTA at the
  // bottom — no separate confirmation step.
  const [previewing, setPreviewing] = React.useState<{
    week_start: string
    week_end: string
    template_id: number
  } | null>(null)
  const [publishing, setPublishing] = React.useState(false)
  const [managing, setManaging] = React.useState<{
    week_start: string
    week_end: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setShellLoading(true)
    setShellFailed(false)
    void (async () => {
      try {
        const tt = await getTimetable(anchorTimetableId)
        if (cancelled) return
        setAnchor(tt)
        const peers = await listTimetables(
          tt.programme_semester_id,
          tt.attendance_group_id,
        )
        if (!cancelled) setTemplates(peers)
      } catch {
        if (!cancelled) setShellFailed(true)
      } finally {
        if (!cancelled) setShellLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [anchorTimetableId])

  const weekStarts = React.useMemo(
    () =>
      Array.from({ length: WEEKS_IN_STRIP }, (_, i) =>
        addDays(stripStart, i * 7),
      ),
    [stripStart],
  )

  const refreshSummaries = React.useCallback(async () => {
    if (!anchor) return
    setSummariesLoading(true)
    try {
      // Summary endpoint is group-aware — any of the group's templates as
      // the anchor returns the same data.
      const rows = await getTimetableWeekSummaries(anchor.id, weekStarts)
      setSummaries(rows)
    } catch (err) {
      toast.error("Couldn't load week summaries", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSummariesLoading(false)
    }
  }, [anchor, weekStarts])

  React.useEffect(() => {
    if (!shellLoading && anchor) void refreshSummaries()
  }, [shellLoading, anchor, refreshSummaries])

  const handlePublish = async (input: {
    week_start: string
    week_end: string
    template_id: number
  }) => {
    setPublishing(true)
    try {
      const res = await publishTimetableWeek(input.template_id, {
        from: input.week_start,
        to: input.week_end,
      })
      const replacedNote =
        res.replaced > 0
          ? ` ${res.replaced} stale session${res.replaced === 1 ? "" : "s"} replaced.`
          : ""
      const holidayNote =
        res.skipped_holidays > 0
          ? ` ${res.skipped_holidays} skipped for holidays.`
          : ""
      toast.success(
        `Published ${res.inserted} session${res.inserted === 1 ? "" : "s"}.${replacedNote}${holidayNote}`,
      )
      await refreshSummaries()
      setPreviewing(null)
    } catch (err) {
      toast.error("Couldn't publish this week", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setPublishing(false)
    }
  }

  // Optional bounds from the semester's planned dates. When both are set,
  // weeks outside this range are gated in the UI (Publish/Preview disabled)
  // — the server would reject anyway, but a clean preflight beats a 400.
  const plannedStart = anchor?.programme_semester?.planned_start_date ?? null
  const plannedEnd = anchor?.programme_semester?.planned_end_date ?? null
  const hasBounds = plannedStart !== null || plannedEnd !== null

  // True when the week's intersection with the planned window is empty —
  // i.e. there's no way the seeder could create anything inside.
  const isWeekOutOfRange = (weekStart: string, weekEnd: string): boolean => {
    if (plannedStart && weekEnd < plannedStart) return true
    if (plannedEnd && weekStart > plannedEnd) return true
    return false
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/masters/programme-configuration/semester/$programmeSemesterId/timetables"
          params={{ programmeSemesterId: params.programmeSemesterId ?? "" }}
          search={{ programmeId, admissionYearId }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Templates
        </Link>
      </div>

      {shellLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : shellFailed || !anchor ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load schedule"
            description="The timetable used as the anchor for this URL is missing."
          />
        </div>
      ) : (
        <>
          <header className="rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="size-4 text-muted-foreground" />
                  <h1 className="text-base font-semibold tracking-tight">
                    Schedule — {anchor.attendance_group?.name ?? "Group"}
                  </h1>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {templates.length} template{templates.length === 1 ? "" : "s"}{" "}
                  available. Each week, pick which template to publish.
                </p>
                {hasBounds && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Semester window:
                    </span>{" "}
                    {plannedStart
                      ? rangeFmt.format(parseISO(plannedStart))
                      : "open start"}
                    {" – "}
                    {plannedEnd
                      ? rangeFmt.format(parseISO(plannedEnd))
                      : "open end"}
                    . Weeks outside this range can't be published.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStripStart((s) => addDays(s, -7 * WEEKS_IN_STRIP))}
                  aria-label="Previous block of weeks"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  {formatWeekRange(weekStarts[0], addDays(weekStarts[weekStarts.length - 1], 6))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStripStart((s) => addDays(s, 7 * WEEKS_IN_STRIP))}
                  aria-label="Next block of weeks"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void refreshSummaries()}
                  disabled={summariesLoading}
                  aria-label="Refresh"
                >
                  <RefreshCw
                    className={cn(
                      "size-4",
                      summariesLoading && "animate-spin",
                    )}
                  />
                </Button>
              </div>
            </div>
          </header>

          {templates.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={FileSpreadsheet}
                title="No templates yet"
                description="Create at least one template before publishing weeks."
              />
            </div>
          ) : (
            <WeekStrip
              weeks={summaries.length > 0 ? summaries : skeletonWeeks(weekStarts)}
              templates={templates}
              loading={summariesLoading && summaries.length === 0}
              isOutOfRange={isWeekOutOfRange}
              // Preview and Publish both open the same modal — Publish just
              // commits from inside it. Single, honest decision surface.
              onOpenWeek={(weekStart, weekEnd, templateId) =>
                setPreviewing({
                  week_start: weekStart,
                  week_end: weekEnd,
                  template_id: templateId,
                })
              }
              onManage={(weekStart, weekEnd) =>
                setManaging({ week_start: weekStart, week_end: weekEnd })
              }
            />
          )}
        </>
      )}

      <PreviewModal
        open={previewing !== null}
        week={previewing}
        templates={templates}
        publishing={publishing}
        onOpenChange={(o) => {
          if (!o) setPreviewing(null)
        }}
        onTemplateChange={(id) =>
          setPreviewing((p) => (p ? { ...p, template_id: id } : p))
        }
        onPublish={() => {
          if (previewing) void handlePublish(previewing)
        }}
      />

      <Sheet
        open={managing !== null}
        onOpenChange={(o) => {
          if (!o) setManaging(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          {managing && anchor && (
            <ManageWeekSheet
              week={managing}
              attendanceGroupId={anchor.attendance_group_id}
              programmeSemesterId={anchor.programme_semester_id}
              onClose={() => setManaging(null)}
              onChanged={async () => {
                await refreshSummaries()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// --- strip -----------------------------------------------------------------

function WeekStrip({
  weeks,
  templates,
  loading,
  isOutOfRange,
  onOpenWeek,
  onManage,
}: {
  weeks: WeekSummary[]
  templates: TimetableListItem[]
  loading: boolean
  isOutOfRange: (weekStart: string, weekEnd: string) => boolean
  onOpenWeek: (
    weekStart: string,
    weekEnd: string,
    templateId: number,
  ) => void
  onManage: (weekStart: string, weekEnd: string) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: WEEKS_IN_STRIP }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-lg" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {weeks.map((w) => (
        <WeekCard
          key={w.week_start}
          week={w}
          templates={templates}
          outOfRange={isOutOfRange(w.week_start, w.week_end)}
          onOpenWeek={(templateId) =>
            onOpenWeek(w.week_start, w.week_end, templateId)
          }
          onManage={() => onManage(w.week_start, w.week_end)}
        />
      ))}
    </div>
  )
}

function WeekCard({
  week,
  templates,
  outOfRange,
  onOpenWeek,
  onManage,
}: {
  week: WeekSummary
  templates: TimetableListItem[]
  outOfRange: boolean
  onOpenWeek: (templateId: number) => void
  onManage: () => void
}) {
  const today = todayISO()
  const isPast = week.week_end < today
  const isCurrent = today >= week.week_start && today <= week.week_end

  // Default the preview modal to:
  //   1. The template currently published for this week (dominant by
  //      session count) — so re-opening a published week sticks with it.
  //   2. The group's default template — the admin's pre-chosen "regular
  //      week" — when nothing is published yet.
  //   3. The first template, as a last resort.
  const suggestedTemplateId =
    week.templates[0]?.id ??
    templates.find((t) => t.is_default)?.id ??
    templates[0]?.id ??
    0

  // Tone hierarchy:
  //   outOfRange → muted card with no actionable buttons
  //   isCurrent  → primary ring on top of whatever the published/empty tone is
  //   has_any    → primary-tinted card (future) or plain card (past)
  //   else       → dashed empty card
  const baseTone = outOfRange
    ? "border-dashed bg-muted/30 opacity-60"
    : !week.has_any
      ? "border-dashed bg-muted/20"
      : isPast
        ? "border-input bg-card"
        : "border-primary/30 bg-primary/[0.03]"
  const currentTone = isCurrent && !outOfRange
    ? "border-primary ring-2 ring-primary/40 shadow-sm"
    : ""

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-4 shadow-xs",
        baseTone,
        currentTone,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formatWeekRange(week.week_start, week.week_end)}
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
            outOfRange
              ? "border border-input bg-background text-muted-foreground"
              : week.has_any
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border border-input bg-background text-muted-foreground",
          )}
        >
          {outOfRange ? "Out of range" : week.has_any ? "Published" : "Empty"}
        </span>
      </div>

      {outOfRange && (
        <div className="mt-2 text-xs italic text-muted-foreground">
          Falls outside the semester's planned dates.
        </div>
      )}

      {!outOfRange && week.has_any && (
        <div className="mt-2 text-xs text-muted-foreground">
          Using:{" "}
          {week.templates.map((t, i) => (
            <span key={t.id} className="text-foreground">
              {i > 0 && ", "}
              {t.name}
              {week.templates.length > 1 && ` (${t.session_count})`}
            </span>
          ))}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Scheduled</dt>
        <dd className="text-right tabular-nums">{week.scheduled}</dd>
        <dt className="text-muted-foreground">Completed</dt>
        <dd className="text-right tabular-nums">{week.completed}</dd>
        <dt className="text-muted-foreground">Cancelled</dt>
        <dd className="text-right tabular-nums">{week.cancelled}</dd>
      </dl>

      <div className="mt-auto space-y-1.5 pt-3">
        <Button
          size="sm"
          className="w-full"
          onClick={() => onOpenWeek(suggestedTemplateId)}
          disabled={suggestedTemplateId === 0 || outOfRange}
          title={
            outOfRange ? "Outside the semester's planned dates" : undefined
          }
        >
          {week.has_any ? (
            <>
              <Eye className="size-4" />
              Preview & republish
            </>
          ) : (
            <>
              <Check className="size-4" />
              Preview & publish
            </>
          )}
        </Button>
        {week.has_any && !outOfRange && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={onManage}
            title="Cancel a class, change a teacher, mark attendance"
          >
            <Settings2 className="size-4" />
            Manage classes
          </Button>
        )}
      </div>
    </div>
  )
}

function skeletonWeeks(starts: string[]): WeekSummary[] {
  return starts.map((s) => ({
    week_start: s,
    week_end: addDays(s, 6),
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    has_any: false,
    templates: [],
  }))
}

// --- preview modal --------------------------------------------------------

// Centered dialog used for both Preview and Publish flows. Shows what the
// chosen template would seed for the week — full subject + teacher names,
// real period times — with a Publish CTA at the bottom that commits.
function PreviewModal({
  open,
  week,
  templates,
  publishing,
  onOpenChange,
  onTemplateChange,
  onPublish,
}: {
  open: boolean
  week: { week_start: string; week_end: string; template_id: number } | null
  templates: TimetableListItem[]
  publishing: boolean
  onOpenChange: (open: boolean) => void
  onTemplateChange: (id: number) => void
  onPublish: () => void
}) {
  const [view, setView] = React.useState<"sessions" | "grid">("sessions")
  const [sessionData, setSessionData] = React.useState<PreviewResult | null>(
    null,
  )
  const [sessionFailed, setSessionFailed] = React.useState(false)
  const [gridData, setGridData] = React.useState<Timetable | null>(null)
  const [gridFailed, setGridFailed] = React.useState(false)

  // Reset state when the modal closes so a re-open doesn't flash stale data.
  React.useEffect(() => {
    if (!open) {
      setSessionData(null)
      setSessionFailed(false)
      setGridData(null)
      setGridFailed(false)
      setView("sessions")
    }
  }, [open])

  // Load sessions whenever template / week changes.
  React.useEffect(() => {
    if (!open || !week) return
    let cancelled = false
    setSessionData(null)
    setSessionFailed(false)
    void (async () => {
      try {
        const res = await previewTimetableWeek(week.template_id, {
          from: week.week_start,
          to: week.week_end,
        })
        if (!cancelled) setSessionData(res)
      } catch {
        if (!cancelled) setSessionFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, week])

  // Lazy-load the grid only when first requested.
  React.useEffect(() => {
    if (!open || !week || view !== "grid" || gridData?.id === week.template_id) {
      return
    }
    let cancelled = false
    setGridData(null)
    setGridFailed(false)
    void (async () => {
      try {
        const tt = await getTimetable(week.template_id)
        if (!cancelled) setGridData(tt)
      } catch {
        if (!cancelled) setGridFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, view, week, gridData?.id])

  const sessionsByDate = React.useMemo(() => {
    if (!sessionData) return new Map<string, PreviewResult["sessions"]>()
    const m = new Map<string, PreviewResult["sessions"]>()
    for (const s of sessionData.sessions) {
      const bucket = m.get(s.session_date) ?? []
      bucket.push(s)
      m.set(s.session_date, bucket)
    }
    // Stable order: by period start_time within each day.
    for (const list of m.values()) {
      list.sort((a, b) =>
        (a.period_start_time ?? "").localeCompare(b.period_start_time ?? ""),
      )
    }
    return m
  }, [sessionData])

  const dates = React.useMemo(() => {
    if (!week) return []
    const out: string[] = []
    for (let d = week.week_start; d <= week.week_end; d = addDays(d, 1)) {
      out.push(d)
    }
    return out
  }, [week])

  if (!week) return null

  const newCount =
    sessionData?.sessions.filter((s) => !s.already_exists).length ?? 0
  const existingCount =
    sessionData?.sessions.filter((s) => s.already_exists).length ?? 0
  const templateName =
    templates.find((t) => t.id === week.template_id)?.name ?? "—"
  const publishLabel = existingCount > 0 ? "Republish week" : "Publish week"
  const publishDisabled =
    publishing ||
    sessionData === null ||
    sessionData.sessions.length === 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl outline-none",
            "max-h-[90vh]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <CalendarCheck className="size-4 text-primary" />
                Preview · {formatWeekRange(week.week_start, week.week_end)}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {sessionData ? (
                  <>
                    Using template{" "}
                    <span className="font-medium text-foreground">
                      {templateName}
                    </span>
                    {" · "}
                    <span className="font-medium text-foreground tabular-nums">
                      {sessionData.sessions.length}
                    </span>{" "}
                    session{sessionData.sessions.length === 1 ? "" : "s"}{" "}
                    ({newCount} new, {existingCount} unchanged)
                  </>
                ) : (
                  "Loading preview…"
                )}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Template picker — focused card-style group. Each card is a
              radio-like option; the default template is badged and
              auto-selected on first open. */}
          <div className="border-b bg-muted/20 px-6 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Template for this week
              </Label>
              <div className="inline-flex overflow-hidden rounded-md border bg-background text-xs">
                <button
                  type="button"
                  onClick={() => setView("sessions")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 transition-colors",
                    view === "sessions"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40",
                  )}
                  aria-pressed={view === "sessions"}
                >
                  <List className="size-3.5" />
                  Sessions
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "inline-flex items-center gap-1 border-l px-2.5 py-1 transition-colors",
                    view === "grid"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40",
                  )}
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid className="size-3.5" />
                  Template grid
                </button>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label="Pick a template"
              className="flex flex-wrap gap-2"
            >
              {templates.map((t) => {
                const active = t.id === week.template_id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onTemplateChange(t.id)}
                    className={cn(
                      "group relative flex min-w-[10rem] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                      active
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                        : "border-input bg-background hover:border-primary/30 hover:bg-accent/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <FileSpreadsheet className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {t.name}
                      </span>
                      {t.is_default && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <Star className="size-3 fill-primary" />
                          Default
                        </span>
                      )}
                    </span>
                    {active && (
                      <Check className="absolute right-2 top-2 size-3.5 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {view === "sessions" && sessionFailed && (
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load preview"
                description="Try a different template or close and reopen."
              />
            )}

            {view === "sessions" && !sessionData && !sessionFailed && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}

            {view === "sessions" &&
              sessionData &&
              sessionData.holidays.length > 0 && (
                <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <p className="font-medium text-amber-800">
                    Holidays affecting this week
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {sessionData.holidays.map((h, i) => (
                      <li key={i}>
                        <span className="tabular-nums">{h.date}</span>
                        {h.end_date && h.end_date !== h.date && (
                          <> – {h.end_date}</>
                        )}
                        : {h.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {view === "sessions" && sessionData && (
              <DayList
                dates={dates}
                sessionsByDate={sessionsByDate}
                blockedDates={sessionData.blocked_dates}
              />
            )}

            {view === "grid" && gridFailed && (
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load template grid"
                description="Try again — the template payload didn't return."
              />
            )}
            {view === "grid" && !gridData && !gridFailed && (
              <Skeleton className="h-64 w-full" />
            )}
            {view === "grid" && gridData && (
              <TemplateGrid timetable={gridData} />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t bg-muted/10 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Publishing replaces still-scheduled rows in this week regardless
              of source template. Completed, cancelled and ad-hoc rows stay.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={onPublish}
                disabled={publishDisabled}
              >
                <CalendarRange className="size-4" />
                {publishing ? "Publishing…" : publishLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

type PreviewRowGroup =
  | { kind: "regular"; row: PreviewResult["sessions"][number] }
  | {
      kind: "elective"
      slot_pss_id: number
      timetable_period_id: number
      period_label: string | null
      period_start_time: string | null
      period_end_time: string | null
      span: number
      slot_name: string
      cohorts: PreviewResult["sessions"]
    }

// Build the per-day display rows. Regular sessions stay one-per-row.
// Elective cohorts collapse into one row per (slot, period) — teachers
// for electives are assigned dynamically based on each student's pick, so
// listing per-cohort teacher names is noisy. The collapsed row shows the
// slot name + the subjects offered + a "Dynamic allocation" stand-in for
// the teacher.
function groupSessionsForDay(
  sessions: PreviewResult["sessions"],
): PreviewRowGroup[] {
  const electiveBuckets = new Map<string, PreviewRowGroup & { kind: "elective" }>()
  const out: PreviewRowGroup[] = []
  for (const row of sessions) {
    if (row.programme_semester_subject_option_id === null) {
      out.push({ kind: "regular", row })
      continue
    }
    const key = `${row.programme_semester_subject_id}:${row.timetable_period_id}`
    const existing = electiveBuckets.get(key)
    if (existing) {
      existing.cohorts.push(row)
      continue
    }
    const bucket: PreviewRowGroup & { kind: "elective" } = {
      kind: "elective",
      slot_pss_id: row.programme_semester_subject_id,
      timetable_period_id: row.timetable_period_id,
      period_label: row.period_label,
      period_start_time: row.period_start_time,
      period_end_time: row.period_end_time,
      span: row.span,
      slot_name:
        row.slot_placeholder_name ??
        `Slot #${row.programme_semester_subject_id}`,
      cohorts: [row],
    }
    electiveBuckets.set(key, bucket)
    out.push(bucket)
  }
  // Sort by start time so groups read top-to-bottom.
  out.sort((a, b) => {
    const aT =
      a.kind === "regular"
        ? (a.row.period_start_time ?? "")
        : (a.period_start_time ?? "")
    const bT =
      b.kind === "regular"
        ? (b.row.period_start_time ?? "")
        : (b.period_start_time ?? "")
    return aT.localeCompare(bT)
  })
  return out
}

// Renders a day-by-day list of would-be sessions with proper subject /
// teacher / room formatting. The two-column grid keeps it scannable on
// the wide canvas: time + status on the left, content on the right.
function DayList({
  dates,
  sessionsByDate,
  blockedDates,
}: {
  dates: string[]
  sessionsByDate: Map<string, PreviewResult["sessions"]>
  blockedDates: string[]
}) {
  return (
    <div className="space-y-3">
      {dates.map((d) => {
        const rows = sessionsByDate.get(d) ?? []
        const blocked = blockedDates.includes(d)
        const groups = groupSessionsForDay(rows)
        return (
          <div
            key={d}
            className="overflow-hidden rounded-lg border bg-card text-card-foreground"
          >
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <div className="text-sm font-medium">
                {fullDateFmt.format(parseISO(d))}
              </div>
              {blocked ? (
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                  Holiday — no classes
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {groups.length} class{groups.length === 1 ? "" : "es"}
                </span>
              )}
            </div>
            {groups.length === 0 && !blocked && (
              <p className="px-4 py-3 text-xs italic text-muted-foreground">
                Nothing scheduled on this day.
              </p>
            )}
            {groups.length > 0 && (
              <ul className="divide-y">
                {groups.map((g, i) =>
                  g.kind === "regular" ? (
                    <PreviewRegularRow key={i} session={g.row} />
                  ) : (
                    <PreviewElectiveRow key={i} group={g} />
                  ),
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PreviewRegularRow({
  session: s,
}: {
  session: PreviewResult["sessions"][number]
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/20">
      <div className="w-28 shrink-0">
        <div className="text-sm font-medium tabular-nums text-foreground">
          {s.period_start_time?.slice(0, 5) ?? "?"} –{" "}
          {s.period_end_time?.slice(0, 5) ?? "?"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {s.period_label ?? `Period #${s.timetable_period_id}`}
          {s.span > 1 ? ` × ${s.span}` : ""}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {s.subject_code && (
            <span className="text-muted-foreground">{s.subject_code} </span>
          )}
          {s.subject_name ?? `Subject #${s.subject_id}`}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserCog className="size-3.5" />
            {s.teacher_name ?? `Teacher #${s.scheduled_employee_id}`}
            {s.teacher_emp_code && (
              <span className="opacity-60">· {s.teacher_emp_code}</span>
            )}
          </span>
          {s.room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {s.room}
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          s.already_exists
            ? "border border-input bg-muted text-muted-foreground"
            : "border border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {s.already_exists ? "Existing" : "New"}
      </span>
    </li>
  )
}

function PreviewElectiveRow({
  group,
}: {
  group: PreviewRowGroup & { kind: "elective" }
}) {
  // Unique subjects offered across cohorts — e.g. "Python, Java, R" when a
  // single slot has multiple option subjects with student picks behind them.
  const offeredSubjects = React.useMemo(() => {
    const seen = new Map<number, { code: string | null; name: string | null }>()
    for (const c of group.cohorts) {
      if (!seen.has(c.subject_id)) {
        seen.set(c.subject_id, {
          code: c.subject_code,
          name: c.subject_name,
        })
      }
    }
    return Array.from(seen.values())
  }, [group.cohorts])

  const newCount = group.cohorts.filter((c) => !c.already_exists).length
  const allExisting = newCount === 0
  const room = group.cohorts.find((c) => c.room)?.room ?? null

  return (
    <li className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/20">
      <div className="w-28 shrink-0">
        <div className="text-sm font-medium tabular-nums text-foreground">
          {group.period_start_time?.slice(0, 5) ?? "?"} –{" "}
          {group.period_end_time?.slice(0, 5) ?? "?"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {group.period_label ?? `Period #${group.timetable_period_id}`}
          {group.span > 1 ? ` × ${group.span}` : ""}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{group.slot_name}</span>
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-700">
            Elective
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 italic">
            <UserCog className="size-3.5" />
            Dynamic allocation (teacher per student's pick)
          </span>
          {room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {room}
            </span>
          )}
        </div>
        {offeredSubjects.length > 0 && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Offered:{" "}
            {offeredSubjects
              .map((s) => (s.code ? `${s.code} ${s.name ?? ""}` : (s.name ?? "—")))
              .join(" · ")}
            <span className="ml-2 opacity-60">
              · {group.cohorts.length} cohort
              {group.cohorts.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          allExisting
            ? "border border-input bg-muted text-muted-foreground"
            : "border border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {allExisting ? "Existing" : `New${newCount > 1 ? ` ×${newCount}` : ""}`}
      </span>
    </li>
  )
}

// --- template grid ---------------------------------------------------------

// A compact visual of the weekly bell schedule: rows = periods, columns =
// working days. Cells show the subject's code or placeholder + teacher
// initials. Read-only — for editing, open the template's editor.
function TemplateGrid({ timetable }: { timetable: Timetable }) {
  const days = WEEKDAYS.filter((d) => timetable.working_days.includes(d.value))
  const periods = [...timetable.periods].sort(
    (a, b) => a.position - b.position,
  )
  const entryAt = React.useMemo(() => {
    const m = new Map<string, (typeof timetable.entries)[number]>()
    for (const e of timetable.entries) {
      m.set(`${e.day_of_week}:${e.timetable_period_id}`, e)
    }
    return m
  }, [timetable.entries])

  if (periods.length === 0 || days.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Empty template"
        description="No periods or days set on this template yet."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/30">
            <th className="border-b border-r px-2 py-1.5 text-left font-medium">
              Time
            </th>
            {days.map((d) => (
              <th
                key={d.value}
                className="border-b border-r px-2 py-1.5 text-left font-medium last:border-r-0"
              >
                {d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id}>
              <td className="border-b border-r px-2 py-1.5 tabular-nums text-muted-foreground">
                <div>{p.start_time.slice(0, 5)}</div>
                <div className="text-[10px] opacity-70">
                  {p.end_time.slice(0, 5)}
                </div>
              </td>
              {p.is_break ? (
                <td
                  colSpan={days.length}
                  className="border-b px-2 py-1.5 text-center italic text-muted-foreground"
                >
                  {p.label}
                </td>
              ) : (
                days.map((d) => {
                  const e = entryAt.get(`${d.value}:${p.id}`)
                  return (
                    <td
                      key={d.value}
                      className="border-b border-r px-2 py-1.5 align-top last:border-r-0"
                    >
                      {e ? (
                        (() => {
                          // A "slot" cell — open elective / honors / minors.
                          // PSS row with subject_id NULL means the actual
                          // subject + teacher are decided per-student at
                          // enrollment time.
                          const isSlot =
                            e.programme_semester_subject !== null &&
                            e.programme_semester_subject.subject_id === null
                          return (
                            <div>
                              <div className="font-medium leading-tight">
                                {e.programme_semester_subject?.subject?.code ??
                                  e.timetable_course?.subject?.code ??
                                  null}
                              </div>
                              <div className="text-[11px] leading-tight text-foreground">
                                {e.programme_semester_subject?.subject?.name ??
                                  e.programme_semester_subject?.placeholder_name ??
                                  e.timetable_course?.subject?.name ??
                                  e.timetable_course?.custom_label ??
                                  "—"}
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {isSlot ? (
                                  <span className="italic">
                                    Dynamic allocation
                                  </span>
                                ) : (
                                  (e.employee?.emp_display_name ??
                                  "(no teacher)")
                                )}
                              </div>
                              {e.room && (
                                <div className="text-[10px] opacity-70">
                                  {e.room}
                                </div>
                              )}
                            </div>
                          )
                        })()
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- manage-week sheet (per-session actions) ------------------------------

const STATUS_BADGE: Record<
  ClassSessionStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-muted text-muted-foreground border border-input",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border border-destructive/30",
  },
  rescheduled: {
    label: "Rescheduled",
    className: "bg-amber-500/10 text-amber-700 border border-amber-500/30",
  },
}

function ManageWeekSheet({
  week,
  attendanceGroupId,
  programmeSemesterId,
  onClose,
  onChanged,
}: {
  week: { week_start: string; week_end: string }
  attendanceGroupId: number
  programmeSemesterId: number
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const [sessions, setSessions] = React.useState<ClassSession[] | null>(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [editing, setEditing] = React.useState<ClassSession | null>(null)
  const [marking, setMarking] = React.useState<ClassSession | null>(null)

  const reload = React.useCallback(async () => {
    setSessions(null)
    setLoadFailed(false)
    try {
      const list = await listClassSessions({
        from: week.week_start,
        to: week.week_end,
        attendance_group_id: attendanceGroupId,
        programme_semester_id: programmeSemesterId,
      })
      setSessions(list)
    } catch {
      setLoadFailed(true)
    }
  }, [week.week_start, week.week_end, attendanceGroupId, programmeSemesterId])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const byDate = React.useMemo(() => {
    const m = new Map<string, ClassSession[]>()
    if (sessions) {
      for (const s of sessions) {
        const bucket = m.get(s.session_date) ?? []
        bucket.push(s)
        m.set(s.session_date, bucket)
      }
    }
    return m
  }, [sessions])

  const dates = React.useMemo(() => {
    const out: string[] = []
    for (let d = week.week_start; d <= week.week_end; d = addDays(d, 1)) {
      out.push(d)
    }
    return out
  }, [week.week_start, week.week_end])

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          Manage classes · {formatWeekRange(week.week_start, week.week_end)}
        </SheetTitle>
        <SheetDescription>
          Cancel a class, assign a substitute teacher, or mark attendance.
          All actions are logged on the session's audit trail.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-3">
        {loadFailed && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load sessions"
            description="Close and reopen to retry."
          />
        )}
        {!loadFailed && sessions === null && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}
        {sessions && sessions.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No sessions in this week"
            description="Publish the week first to create sessions."
          />
        )}
        {sessions &&
          sessions.length > 0 &&
          dates.map((d) => {
            const rows = byDate.get(d) ?? []
            if (rows.length === 0) return null
            return (
              <div
                key={d}
                className="rounded-md border bg-card text-card-foreground"
              >
                <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
                  <span>{fullDateFmt.format(parseISO(d))}</span>
                  <span className="text-muted-foreground">
                    {rows.length} class{rows.length === 1 ? "" : "es"}
                  </span>
                </div>
                <ul className="divide-y">
                  {rows.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onEdit={() => setEditing(s)}
                      onMark={() => setMarking(s)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          {editing && (
            <SessionEditForm
              session={editing}
              onClose={() => setEditing(null)}
              onChanged={async () => {
                setEditing(null)
                await reload()
                await onChanged()
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={marking !== null}
        onOpenChange={(o) => {
          if (!o) setMarking(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {marking && (
            <AttendanceMarkingForm
              session={marking}
              onClose={() => setMarking(null)}
              onSaved={async () => {
                setMarking(null)
                await reload()
                await onChanged()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SessionRow({
  session,
  onEdit,
  onMark,
}: {
  session: ClassSession
  onEdit: () => void
  onMark: () => void
}) {
  const period = session.timetable_period
  const subjectName =
    session.subject?.name ??
    session.programme_semester_subject_option?.subject?.name ??
    session.programme_semester_subject?.subject?.name ??
    session.programme_semester_subject?.placeholder_name ??
    "(unknown)"
  const subjectCode =
    session.subject?.code ??
    session.programme_semester_subject_option?.subject?.code ??
    session.programme_semester_subject?.subject?.code ??
    ""
  const teacher =
    session.effective_employee?.emp_display_name ?? "(teacher TBD)"
  const isSub =
    session.effective_employee_id !== session.scheduled_employee_id
  const badge = STATUS_BADGE[session.status]
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2.5",
        session.status === "cancelled" && "opacity-70",
      )}
    >
      <div className="flex w-24 shrink-0 flex-col gap-0.5 text-xs">
        <span className="font-medium text-foreground">
          {period?.start_time?.slice(0, 5) ?? "?"}–
          {period?.end_time?.slice(0, 5) ?? "?"}
        </span>
        <span className="text-muted-foreground">
          {period?.label ?? "Period"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {subjectCode && (
              <span className="text-muted-foreground">{subjectCode} </span>
            )}
            {subjectName}
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
              badge.className,
            )}
          >
            {badge.label}
          </span>
          {session.programme_semester_subject_option_id !== null && (
            <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-700">
              Elective
            </span>
          )}
          {isSub && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
              Substitute
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserCog className="size-3.5" />
            {teacher}
          </span>
          {session.room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {session.room}
            </span>
          )}
          {session.cancel_reason && (
            <span className="italic">{session.cancel_reason}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {session.status !== "cancelled" && (
          <Button size="sm" variant="outline" onClick={onMark}>
            <UserCheck className="size-4" />
            {session.status === "completed" ? "Amend" : "Mark"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </li>
  )
}

// --- edit one session (cancel / substitute / move) -----------------------

function SessionEditForm({
  session,
  onClose,
  onChanged,
}: {
  session: ClassSession
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const [busy, setBusy] = React.useState<
    "cancel" | "uncancel" | "substitute" | null
  >(null)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState("")
  const [subEmployeeId, setSubEmployeeId] = React.useState<number | null>(
    session.effective_employee_id,
  )
  const [subReason, setSubReason] = React.useState("")
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = React.useState(false)

  const isCancelled = session.status === "cancelled"
  const isCompleted = session.status === "completed"

  React.useEffect(() => {
    setEmployeesLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const res = await listEmployees({
          page: 1,
          pageSize: 1000,
          status: "active",
        })
        if (!cancelled) setEmployees(res.rows)
      } catch {
        if (!cancelled) setEmployees([])
      } finally {
        if (!cancelled) setEmployeesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const doCancel = async () => {
    setBusy("cancel")
    try {
      await cancelSession(session.id, { reason: cancelReason.trim() })
      toast.success("Class cancelled.")
      await onChanged()
    } catch (err) {
      toast.error("Couldn't cancel", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
      setConfirmCancel(false)
    }
  }

  const doUncancel = async () => {
    setBusy("uncancel")
    try {
      await uncancelSession(session.id, {})
      toast.success("Class re-opened.")
      await onChanged()
    } catch (err) {
      toast.error("Couldn't re-open", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  const doSubstitute = async () => {
    if (!subEmployeeId) return
    setBusy("substitute")
    try {
      await substituteSession(session.id, {
        new_effective_employee_id: subEmployeeId,
        reason: subReason.trim() || undefined,
      })
      toast.success("Substitute assigned.")
      await onChanged()
    } catch (err) {
      toast.error("Couldn't substitute", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Edit class</SheetTitle>
        <SheetDescription>
          {fullDateFmt.format(parseISO(session.session_date))} ·{" "}
          {session.timetable_period?.label} · {session.subject?.name}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {isCompleted && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
            <p className="font-medium">Attendance already marked</p>
            <p className="mt-1">
              Cancel / substitute is disabled — use the amend flow on the
              marking screen if you need to change the recorded attendance.
            </p>
          </div>
        )}

        {/* Cancel / Uncancel */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cancellation
          </h3>
          {isCancelled ? (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-sm">
                Cancelled
                {session.cancel_reason ? `: ${session.cancel_reason}` : "."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={doUncancel}
                disabled={busy !== null || session.session_date < todayISO()}
              >
                <RotateCcw className="size-4" />
                Re-open class
              </Button>
              {session.session_date < todayISO() && (
                <p className="text-xs text-muted-foreground">
                  Can't re-open a class whose date has passed.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="cancel-reason" className="text-xs">
                Reason
              </Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={256}
                placeholder="e.g. Faculty unavailable"
                disabled={isCompleted}
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmCancel(true)}
                disabled={
                  cancelReason.trim().length === 0 ||
                  busy !== null ||
                  isCompleted
                }
              >
                <X className="size-4" />
                Cancel class
              </Button>
            </div>
          )}
        </section>

        {/* Substitute */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Change teacher (substitute)
          </h3>
          <div className="space-y-2">
            <Label className="text-xs">Effective teacher</Label>
            <Combobox
              value={subEmployeeId}
              options={employees.map<ComboboxOption>((e) => ({
                value: e.id,
                label: e.emp_display_name,
                sublabel: e.emp_code,
              }))}
              onChange={(v) => setSubEmployeeId(v)}
              placeholder={employeesLoading ? "Loading…" : "Pick a teacher…"}
              disabled={employeesLoading || isCancelled || isCompleted}
            />
            <p className="text-xs text-muted-foreground">
              Scheduled:{" "}
              {session.scheduled_employee?.emp_display_name ?? "—"} · Currently:{" "}
              {session.effective_employee?.emp_display_name ?? "—"}
            </p>
            <Input
              value={subReason}
              onChange={(e) => setSubReason(e.target.value)}
              maxLength={256}
              placeholder="Reason (optional)"
              disabled={isCancelled || isCompleted}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={doSubstitute}
              disabled={
                subEmployeeId === null ||
                subEmployeeId === session.effective_employee_id ||
                busy !== null ||
                isCancelled ||
                isCompleted
              }
            >
              <UserCog className="size-4" />
              Save substitute
            </Button>
          </div>
        </section>
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this class?"
        description={
          <>
            The class on{" "}
            <span className="font-medium text-foreground">
              {fullDateFmt.format(parseISO(session.session_date))}
            </span>{" "}
            will be cancelled. Students' "held" count won't increment for
            this slot.
          </>
        }
        confirmLabel="Cancel class"
        tone="destructive"
        loading={busy === "cancel"}
        onConfirm={doCancel}
      />

    </div>
  )
}

// --- attendance marking form ---------------------------------------------

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  exempt: "Exempt",
  od: "OD",
}

function AttendanceMarkingForm({
  session,
  onClose,
  onSaved,
}: {
  session: ClassSession
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [roster, setRoster] = React.useState<RosterStudent[] | null>(null)
  const [rosterError, setRosterError] = React.useState(false)
  const [statuses, setStatuses] = React.useState<
    Record<number, AttendanceStatus>
  >({})
  const [submitting, setSubmitting] = React.useState(false)

  const isAmending = session.status === "completed"
  const onBehalfOfId = session.effective_employee_id

  React.useEffect(() => {
    let cancelled = false
    setRoster(null)
    setRosterError(false)
    void (async () => {
      try {
        const list = await getRoster(session.id)
        if (cancelled) return
        setRoster(list)
        const initial: Record<number, AttendanceStatus> = {}
        for (const r of list) initial[r.id] = "present"
        setStatuses(initial)
      } catch {
        if (!cancelled) setRosterError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session.id])

  const setStatus = (studentId: number, status: AttendanceStatus) =>
    setStatuses((prev) => ({ ...prev, [studentId]: status }))

  const presentCount = React.useMemo(
    () =>
      Object.values(statuses).filter((s) => s === "present" || s === "late")
        .length,
    [statuses],
  )

  const markAll = (status: AttendanceStatus) => {
    if (!roster) return
    const next: Record<number, AttendanceStatus> = {}
    for (const r of roster) next[r.id] = status
    setStatuses(next)
  }

  const onSubmit = async () => {
    if (!roster) return
    setSubmitting(true)
    try {
      const entries = roster.map((r) => ({
        student_id: r.id,
        status: statuses[r.id] ?? "absent",
      }))
      const result = await markAttendance(session.id, {
        entries,
        allow_amend: isAmending,
        on_behalf_of_employee_id: onBehalfOfId,
      })
      toast.success(
        isAmending
          ? `Attendance amended for ${result.roster_size} students.`
          : `Attendance saved for ${result.roster_size} students.`,
      )
      await onSaved()
    } catch (err) {
      toast.error("Couldn't save attendance", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {isAmending ? "Amend attendance" : "Mark attendance"}
        </SheetTitle>
        <SheetDescription>
          {fullDateFmt.format(parseISO(session.session_date))} ·{" "}
          {session.timetable_period?.label} · {session.subject?.name} ·{" "}
          {session.effective_employee?.emp_display_name ?? "—"}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-4">
        {roster === null && !rosterError ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rosterError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load roster"
            description="Close and reopen to retry."
          />
        ) : roster && roster.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Empty roster"
            description="No students are currently in scope for this session. Check elective enrollment or group membership."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium">
                {presentCount} / {roster?.length ?? 0} present
              </span>
              <span className="ml-auto flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => markAll("present")}
                >
                  All present
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => markAll("absent")}
                >
                  All absent
                </Button>
              </span>
            </div>

            <ul className="divide-y rounded-md border bg-card">
              {roster?.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.student_id}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(
                      [
                        "present",
                        "late",
                        "absent",
                        "od",
                        "exempt",
                      ] as AttendanceStatus[]
                    ).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStatus(s.id, opt)}
                        aria-pressed={statuses[s.id] === opt}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          statuses[s.id] === opt
                            ? statusButtonClass(opt)
                            : "border-input bg-background text-muted-foreground hover:bg-accent/40",
                        )}
                      >
                        {ATTENDANCE_LABEL[opt]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting || roster === null || roster.length === 0}
        >
          {submitting
            ? "Saving…"
            : isAmending
              ? "Save amendment"
              : "Save attendance"}
        </Button>
      </SheetFooter>
    </div>
  )
}

function statusButtonClass(s: AttendanceStatus): string {
  switch (s) {
    case "present":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
    case "late":
      return "border-amber-500/50 bg-amber-500/10 text-amber-700"
    case "absent":
      return "border-destructive/50 bg-destructive/10 text-destructive"
    case "od":
      return "border-sky-500/50 bg-sky-500/10 text-sky-700"
    case "exempt":
      return "border-violet-500/50 bg-violet-500/10 text-violet-700"
  }
}
