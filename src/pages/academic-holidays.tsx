import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import {
  CalendarRange,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
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
  updateAcademicHoliday,
  type AcademicHoliday,
  type AcademicHolidayType,
} from "@/lib/academic-holidays"
import { cn } from "@/lib/utils"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const HOLIDAY_TYPES: { value: AcademicHolidayType; label: string }[] = [
  { value: "public", label: "Public holiday" },
  { value: "institutional", label: "Institutional" },
  { value: "unplanned", label: "Unplanned closure" },
]

const TYPE_LABEL: Record<AcademicHolidayType, string> = {
  public: "Public",
  institutional: "Institutional",
  unplanned: "Unplanned",
}

// Soft, scannable badge colours per type. Tokens keep them readable in both
// light and dark themes.
const TYPE_BADGE: Record<AcademicHolidayType, string> = {
  public: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  institutional: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  unplanned: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

type TypeFilter = AcademicHolidayType | "all"

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "institutional", label: "Institutional" },
  { value: "unplanned", label: "Unplanned" },
]

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
    type: z.enum(["public", "institutional", "unplanned"]),
    reason: z.string().trim().max(256).optional(),
  })
  .superRefine((v, ctx) => {
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

// Quick date-range presets. Each returns the [from, to] pair the date filter
// feeds to the server ("" = open-ended on that side).
type DatePreset = { key: string; label: string; range: () => [string, string] }

const DATE_PRESETS: DatePreset[] = [
  { key: "upcoming", label: "Upcoming", range: () => [todayISO(), ""] },
  {
    key: "this-year",
    label: "This year",
    range: () => {
      const y = new Date().getFullYear()
      return [`${y}-01-01`, `${y}-12-31`]
    },
  },
  {
    key: "past",
    label: "Past",
    range: () => {
      // Up to and including yesterday — strictly before today.
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getDate()).padStart(2, "0")}`
      return ["", yesterday]
    },
  },
  { key: "all", label: "All time", range: () => ["", ""] },
]

export function AcademicHolidaysPage() {
  const [rows, setRows] = React.useState<AcademicHoliday[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<AcademicHoliday | null>(
    null,
  )
  const [confirmTarget, setConfirmTarget] = React.useState<AcademicHoliday | null>(
    null,
  )
  const [busyId, setBusyId] = React.useState<number | null>(null)

  // Server-side filter: rolling window starting at today by default. Past
  // holidays are useful for audit but not the first thing the admin needs.
  const [filterFrom, setFilterFrom] = React.useState<string>(todayISO())
  const [filterTo, setFilterTo] = React.useState<string>("")

  // Client-side filters over the fetched window — instant, no refetch.
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")

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

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((h) => {
      if (typeFilter !== "all" && h.type !== typeFilter) return false
      if (q) {
        const haystack = `${h.name} ${h.reason ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, search, typeFilter])

  const clientFiltersActive = search.trim() !== "" || typeFilter !== "all"

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

      <div className="space-y-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        {/* Search + type — instant client-side filters over the loaded window. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or reason…"
              className="pl-8 pr-8"
              aria-label="Search holidays"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex items-center rounded-md border bg-background p-0.5">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                aria-pressed={typeFilter === t.value}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                  typeFilter === t.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date window — server-side range, with quick presets. */}
        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
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
          <div className="flex flex-wrap items-center gap-1">
            {DATE_PRESETS.map((p) => {
              const [pf, pt] = p.range()
              const active = filterFrom === pf && filterTo === pt
              return (
                <Button
                  key={p.key}
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  className="h-8"
                  onClick={() => {
                    setFilterFrom(pf)
                    setFilterTo(pt)
                  }}
                >
                  {p.label}
                </Button>
              )
            })}
          </div>
          <p className="ml-auto text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : clientFiltersActive
                ? `${filtered.length} of ${rows.length} shown`
                : `${rows.length} holiday${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <Sheet
        open={formOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false)
            setEditTarget(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {(formOpen || editTarget) && (
            <HolidayForm
              // Remount per target so the form resets cleanly between
              // create and editing different rows.
              key={editTarget ? `edit-${editTarget.id}` : "create"}
              holiday={editTarget}
              onCancel={() => {
                setFormOpen(false)
                setEditTarget(null)
              }}
              onSaved={async (h, cancelled, mode) => {
                setFormOpen(false)
                setEditTarget(null)
                const verb = mode === "edit" ? "updated" : "declared"
                toast.success(
                  cancelled > 0
                    ? `${h.name} ${verb}. ${cancelled} session${
                        cancelled === 1 ? "" : "s"
                      } cancelled.`
                    : `${h.name} ${verb}.`,
                )
                // Keep the just-saved holiday visible. The list defaults to a
                // window starting today, so a past-dated holiday (e.g. a break
                // that already ended) would save fine yet never appear — which
                // reads as "it didn't add". Widen the window to include it;
                // changing the filter triggers the load effect, otherwise we
                // reload explicitly.
                const start = h.date
                const end = h.end_date ?? h.date
                let windowChanged = false
                if (filterFrom && end < filterFrom) {
                  setFilterFrom(start)
                  windowChanged = true
                }
                if (filterTo && start > filterTo) {
                  setFilterTo(end)
                  windowChanged = true
                }
                if (!windowChanged) await load()
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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No holidays match your filters"
            description="Clear the search or type filter to see the rest of this window."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
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
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        TYPE_BADGE[h.type],
                      )}
                    >
                      {TYPE_LABEL[h.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${h.name}`}
                        onClick={() => setEditTarget(h)}
                        disabled={busyId === h.id}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${h.name}`}
                        onClick={() => setConfirmTarget(h)}
                        disabled={busyId === h.id}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
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
  holiday,
  onCancel,
  onSaved,
}: {
  holiday?: AcademicHoliday | null
  onCancel: () => void
  onSaved: (
    h: AcademicHoliday,
    sessionsCancelled: number,
    mode: "create" | "edit",
  ) => void
}) {
  const isEdit = !!holiday
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidayFormSchema),
    defaultValues: holiday
      ? {
          date: holiday.date,
          end_date: holiday.end_date ?? "",
          name: holiday.name,
          type: holiday.type,
          reason: holiday.reason ?? "",
        }
      : {
          date: "",
          end_date: "",
          name: "",
          type: "public",
          reason: "",
        },
  })

  const date = watch("date")
  const endDate = watch("end_date")
  const type = watch("type")

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      date: values.date,
      end_date:
        values.end_date && values.end_date.length > 0 ? values.end_date : null,
      name: values.name,
      type: values.type,
      reason: values.reason && values.reason.length > 0 ? values.reason : null,
    }
    try {
      const res = holiday
        ? await updateAcademicHoliday(holiday.id, payload)
        : await declareAcademicHoliday(payload)
      onSaved(res.holiday, res.sessions_cancelled, holiday ? "edit" : "create")
    } catch (err) {
      toast.error(
        isEdit ? "Couldn't update holiday" : "Couldn't declare holiday",
        {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    }
  })

  return (
    <form className="flex h-full flex-col" onSubmit={onSubmit}>
      <SheetHeader>
        <SheetTitle>{isEdit ? "Edit holiday" : "Declare holiday"}</SheetTitle>
        <SheetDescription>
          {isEdit
            ? "The session seeder honours this date going forward. Scheduled sessions newly caught by the date range are cancelled; ones already cancelled stay cancelled."
            : "The session seeder skips this date going forward, and any already-scheduled sessions in the date range are cancelled in the same transaction (a no-op before the semester starts, when there are none yet)."}
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
              align="end"
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
          <Label htmlFor="reason" className="text-xs">
            Reason{" "}
            <span className="text-muted-foreground">(shown to teachers)</span>
          </Label>
          <Input id="reason" {...register("reason")} maxLength={256} />
        </div>
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
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Declaring…"
            : isEdit
              ? "Save changes"
              : "Declare holiday"}
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
