import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { CalendarRange, Plus, RefreshCw, Trash2 } from "lucide-react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError } from "@/lib/api"
import {
  declareAcademicHoliday,
  listAcademicHolidays,
  removeAcademicHoliday,
  type AcademicHoliday,
  type AcademicHolidayScope,
  type AcademicHolidayType,
} from "@/lib/academic-holidays"
import {
  listAttendanceGroups,
  type AttendanceGroup,
} from "@/lib/attendance-groups"
import { listProgrammes, type Programme } from "@/lib/programmes"
import {
  listAdmissionYears,
  type AdmissionYear,
} from "@/lib/admission-years"
import { cn } from "@/lib/utils"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const HOLIDAY_TYPES: { value: AcademicHolidayType; label: string }[] = [
  { value: "public", label: "Public holiday" },
  { value: "institutional", label: "Institutional" },
  { value: "unplanned", label: "Unplanned closure" },
  { value: "half_day", label: "Half-day" },
]

const SCOPE_LABEL: Record<AcademicHolidayScope, string> = {
  institution: "Institution",
  programme: "Programme",
  group: "Attendance group",
}

const TYPE_LABEL: Record<AcademicHolidayType, string> = {
  public: "Public",
  institutional: "Institutional",
  unplanned: "Unplanned",
  half_day: "Half-day",
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

function formatDate(iso: string): string {
  // 'YYYY-MM-DD' stays a pure calendar date — construct in UTC so timezone
  // doesn't shift the day at display time.
  const [y, m, d] = iso.split("-").map((p) => Number(p))
  const date = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(date.getTime()) ? iso : dateFormatter.format(date)
}

function rangeLabel(h: AcademicHoliday): string {
  if (!h.end_date || h.end_date === h.date) return formatDate(h.date)
  return `${formatDate(h.date)} – ${formatDate(h.end_date)}`
}

const HolidayFormSchema = z
  .object({
    date: z.string().regex(DATE_RE, "Pick a date"),
    end_date: z
      .string()
      .regex(DATE_RE)
      .or(z.literal(""))
      .optional(),
    name: z.string().trim().min(1, "Name is required").max(120),
    scope: z.enum(["institution", "programme", "group"]),
    programme_id: z.number().int().positive().nullable().optional(),
    attendance_group_id: z.number().int().positive().nullable().optional(),
    type: z.enum(["public", "institutional", "unplanned", "half_day"]),
    reason: z.string().trim().max(256).optional(),
    cancel_existing_sessions: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "programme" && !v.programme_id) {
      ctx.addIssue({
        code: "custom",
        message: "Pick a programme",
        path: ["programme_id"],
      })
    }
    if (v.scope === "group" && !v.attendance_group_id) {
      ctx.addIssue({
        code: "custom",
        message: "Pick an attendance group",
        path: ["attendance_group_id"],
      })
    }
    if (v.end_date && v.end_date.length > 0 && v.end_date < v.date) {
      ctx.addIssue({
        code: "custom",
        message: "End date must not be before the start date",
        path: ["end_date"],
      })
    }
  })

type HolidayFormValues = z.infer<typeof HolidayFormSchema>

const todayISO = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function AcademicHolidaysPage() {
  const [rows, setRows] = React.useState<AcademicHoliday[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [confirmTarget, setConfirmTarget] = React.useState<AcademicHoliday | null>(
    null,
  )
  const [busyId, setBusyId] = React.useState<number | null>(null)

  // Filter: rolling window starting at today by default. Past holidays are
  // useful for audit but not the first thing the admin needs to see.
  const [filterFrom, setFilterFrom] = React.useState<string>(todayISO())
  const [filterTo, setFilterTo] = React.useState<string>("")

  const initialLoadDoneRef = React.useRef(false)
  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const list = await listAcademicHolidays({
        from: filterFrom || undefined,
        to: filterTo || undefined,
      })
      if (!isLatest()) return
      setRows(list)
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load holidays", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      if (isLatest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [filterFrom, filterTo])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (h: AcademicHoliday) => {
    setBusyId(h.id)
    try {
      await removeAcademicHoliday(h.id)
      toast.success(`${h.name} removed.`, {
        description:
          "Sessions cancelled by this holiday stay cancelled — re-open them from the timetable if needed.",
      })
      await load()
    } catch (err) {
      toast.error("Couldn't remove holiday", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyId(null)
      setConfirmTarget(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <h1 className="text-base font-semibold tracking-tight">
            Academic holidays
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            disabled={formOpen}
          >
            <Plus />
            Declare holiday
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={refreshing || loading}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">From</Label>
          <DatePicker
            value={filterFrom}
            onChange={setFilterFrom}
            allowClear
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">To</Label>
          <DatePicker
            value={filterTo}
            onChange={setFilterTo}
            allowClear
            className="w-44"
          />
        </div>
        <p className="ml-auto text-xs text-muted-foreground">
          Holidays inside this window are shown. Leaving fields blank widens
          the range.
        </p>
      </div>

      <Sheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {formOpen && (
            <HolidayForm
              onCancel={() => setFormOpen(false)}
              onSaved={async (h, cancelled) => {
                setFormOpen(false)
                toast.success(
                  cancelled > 0
                    ? `${h.name} declared. ${cancelled} session${
                        cancelled === 1 ? "" : "s"
                      } cancelled.`
                    : `${h.name} declared.`,
                )
                await load()
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="rounded-lg border bg-card text-card-foreground">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : loadFailed ? (
          <EmptyState
            icon={CalendarRange}
            title="Couldn't load holidays"
            description="The server didn't respond. Refresh to retry."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No holidays in this window"
            description="Declare a holiday to skip seeded sessions on that date."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {rangeLabel(h)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{h.name}</div>
                    {h.reason && (
                      <div className="text-xs text-muted-foreground">
                        {h.reason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {SCOPE_LABEL[h.scope]}
                    {h.scope === "programme" && h.programme && (
                      <span className="text-muted-foreground">
                        {" "}— {h.programme.display_name}
                      </span>
                    )}
                    {h.scope === "group" && h.attendance_group && (
                      <span className="text-muted-foreground">
                        {" "}— {h.attendance_group.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{TYPE_LABEL[h.type]}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${h.name}`}
                      onClick={() => setConfirmTarget(h)}
                      disabled={busyId === h.id}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title={confirmTarget ? `Remove "${confirmTarget.name}"?` : ""}
        description="Removing the holiday entry will not bring back sessions it cancelled. Re-open them from the timetable if needed."
        confirmLabel="Remove"
        tone="destructive"
        loading={busyId !== null}
        onConfirm={() => {
          if (confirmTarget) void handleDelete(confirmTarget)
        }}
      />
    </div>
  )
}

// --- form -----------------------------------------------------------------

function HolidayForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void
  onSaved: (h: AcademicHoliday, sessionsCancelled: number) => void
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidayFormSchema),
    defaultValues: {
      date: "",
      end_date: "",
      name: "",
      scope: "institution",
      programme_id: null,
      attendance_group_id: null,
      type: "public",
      reason: "",
      cancel_existing_sessions: true,
    },
  })

  const date = watch("date")
  const endDate = watch("end_date")
  const scope = watch("scope")
  const programmeId = watch("programme_id") ?? null
  const attendanceGroupId = watch("attendance_group_id") ?? null
  const cancelExisting = watch("cancel_existing_sessions")
  const type = watch("type")

  const [programmes, setProgrammes] = React.useState<Programme[]>([])
  const [admissionYears, setAdmissionYears] = React.useState<AdmissionYear[]>([])
  const [groups, setGroups] = React.useState<AttendanceGroup[]>([])
  const [groupBatchYearId, setGroupBatchYearId] = React.useState<number | null>(
    null,
  )
  const [groupsLoading, setGroupsLoading] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      try {
        const [p, ay] = await Promise.all([
          listProgrammes({ pageSize: 200, status: "active" }),
          listAdmissionYears({ pageSize: 200, status: "active" }),
        ])
        setProgrammes(p.rows)
        setAdmissionYears(ay.rows)
      } catch {
        // Surfaced via combobox empty states.
      }
    })()
  }, [])

  // Attendance groups are scoped to (programme, admission_year). The form
  // surfaces a small "batch year" picker when scope='group' so the group
  // combobox stays a flat list.
  React.useEffect(() => {
    if (scope !== "group" || !programmeId || !groupBatchYearId) {
      setGroups([])
      return
    }
    setGroupsLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const list = await listAttendanceGroups(programmeId, groupBatchYearId)
        if (!cancelled) setGroups(list)
      } catch {
        if (!cancelled) setGroups([])
      } finally {
        if (!cancelled) setGroupsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scope, programmeId, groupBatchYearId])

  // Clear scope-specific fields when the scope changes so the request stays
  // honest to the picked shape.
  React.useEffect(() => {
    if (scope !== "programme") setValue("programme_id", null)
    if (scope !== "group") {
      setValue("attendance_group_id", null)
      setGroupBatchYearId(null)
    }
  }, [scope, setValue])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await declareAcademicHoliday({
        date: values.date,
        end_date: values.end_date && values.end_date.length > 0 ? values.end_date : null,
        name: values.name,
        scope: values.scope,
        programme_id:
          values.scope === "programme" ? (values.programme_id ?? null) : null,
        attendance_group_id:
          values.scope === "group"
            ? (values.attendance_group_id ?? null)
            : null,
        type: values.type,
        reason: values.reason && values.reason.length > 0 ? values.reason : null,
        cancel_existing_sessions: values.cancel_existing_sessions,
      })
      onSaved(res.holiday, res.sessions_cancelled)
    } catch (err) {
      toast.error("Couldn't declare holiday", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    }
  })

  return (
    <form className="flex h-full flex-col" onSubmit={onSubmit}>
      <SheetHeader>
        <SheetTitle>Declare holiday</SheetTitle>
        <SheetDescription>
          The session seeder honours this date going forward. If
          “Cancel matching scheduled sessions” is on, already-seeded sessions
          in the date range are cancelled in the same transaction.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs">
              Date
            </Label>
            <DatePicker
              id="date"
              value={date}
              onChange={(v) => setValue("date", v, { shouldValidate: true })}
              invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_date" className="text-xs">
              End date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <DatePicker
              id="end_date"
              value={endDate ?? ""}
              onChange={(v) => setValue("end_date", v, { shouldValidate: true })}
              allowClear
              invalid={!!errors.end_date}
            />
            {errors.end_date && (
              <p className="text-xs text-destructive">
                {errors.end_date.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs">
            Name
          </Label>
          <Input
            id="name"
            placeholder="e.g. Independence Day, Cyclone closure"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {HOLIDAY_TYPES.map((t) => (
              <RadioCard
                key={t.value}
                checked={type === t.value}
                label={t.label}
                onClick={() =>
                  setValue("type", t.value, { shouldValidate: true })
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Scope</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["institution", "programme", "group"] as const).map((s) => (
              <RadioCard
                key={s}
                checked={scope === s}
                label={SCOPE_LABEL[s]}
                onClick={() => setValue("scope", s, { shouldValidate: true })}
              />
            ))}
          </div>
        </div>

        {scope === "programme" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Programme</Label>
            <Combobox
              value={programmeId}
              options={programmes.map<ComboboxOption>((p) => ({
                value: p.id,
                label: p.display_name,
                sublabel: p.code,
              }))}
              onChange={(v) =>
                setValue("programme_id", v, { shouldValidate: true })
              }
              placeholder="Pick a programme…"
              invalid={!!errors.programme_id}
            />
            {errors.programme_id && (
              <p className="text-xs text-destructive">
                {errors.programme_id.message}
              </p>
            )}
          </div>
        )}

        {scope === "group" && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Programme</Label>
              <Combobox
                value={programmeId}
                options={programmes.map<ComboboxOption>((p) => ({
                  value: p.id,
                  label: p.display_name,
                  sublabel: p.code,
                }))}
                onChange={(v) => {
                  setValue("programme_id", v, { shouldValidate: true })
                  setValue("attendance_group_id", null)
                }}
                placeholder="Pick a programme…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Batch (admission year)</Label>
              <Combobox
                value={groupBatchYearId}
                options={admissionYears.map<ComboboxOption>((ay) => ({
                  value: ay.id,
                  label: ay.display_year,
                }))}
                onChange={(v) => {
                  setGroupBatchYearId(v)
                  setValue("attendance_group_id", null)
                }}
                placeholder="Pick a batch…"
                disabled={!programmeId}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attendance group</Label>
              <Combobox
                value={attendanceGroupId}
                options={groups.map<ComboboxOption>((g) => ({
                  value: g.id,
                  label: g.name,
                  sublabel: g.code,
                }))}
                onChange={(v) =>
                  setValue("attendance_group_id", v, { shouldValidate: true })
                }
                placeholder={
                  groupsLoading ? "Loading…" : "Pick a group…"
                }
                disabled={!programmeId || !groupBatchYearId || groupsLoading}
                invalid={!!errors.attendance_group_id}
              />
              {errors.attendance_group_id && (
                <p className="text-xs text-destructive">
                  {errors.attendance_group_id.message}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs">
            Reason{" "}
            <span className="text-muted-foreground">(shown to teachers)</span>
          </Label>
          <Input id="reason" {...register("reason")} maxLength={256} />
        </div>

        <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={cancelExisting}
            onChange={(e) =>
              setValue("cancel_existing_sessions", e.target.checked)
            }
          />
          <span className="space-y-0.5">
            <span className="block font-medium">
              Cancel matching scheduled sessions
            </span>
            <span className="block text-xs text-muted-foreground">
              On for mid-semester declarations so students/teachers see the
              cancellation in their day view. Turn off when adding holidays
              before the semester starts — there are no sessions to cancel
              yet.
            </span>
          </span>
        </label>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Declaring…" : "Declare holiday"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function RadioCard({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={cn(
        "rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
        checked
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
    </button>
  )
}
