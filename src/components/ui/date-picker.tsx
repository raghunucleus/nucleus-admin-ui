import * as React from "react"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) or empty string. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Earliest selectable year. Defaults to currentYear - 100. */
  minYear?: number
  /** Latest selectable year. Defaults to currentYear. */
  maxYear?: number
  /** When set, renders a clear button next to the trigger. */
  allowClear?: boolean
  /**
   * Which edge of the trigger the calendar popover aligns to. Use "end" when
   * the picker sits near the right edge of a narrow container so the popover
   * doesn't overflow (and clip the next-month arrow). Defaults to "start".
   */
  align?: "start" | "end"
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function parseIso(value: string): { year: number; monthIndex: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return { year: y, monthIndex: m - 1, day: d }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function formatDisplay(value: string): string {
  const parsed = parseIso(value)
  if (!parsed) return ""
  const d = new Date(parsed.year, parsed.monthIndex, parsed.day)
  return dateFormatter.format(d)
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  minYear,
  maxYear,
  allowClear = true,
  align = "start",
  disabled,
  invalid,
  id,
  className,
}: DatePickerProps) {
  const today = React.useMemo(() => new Date(), [])
  const resolvedMaxYear = maxYear ?? today.getFullYear()
  const resolvedMinYear = minYear ?? resolvedMaxYear - 100

  const parsed = parseIso(value)
  const initialYear = parsed?.year ?? resolvedMaxYear
  const initialMonth = parsed?.monthIndex ?? today.getMonth()

  const [open, setOpen] = React.useState(false)
  const [viewYear, setViewYear] = React.useState(initialYear)
  const [viewMonth, setViewMonth] = React.useState(initialMonth)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // When the popover opens, snap the visible month to the selected value (or
  // today if none). We deliberately don't re-sync while open so the user can
  // freely navigate without their value pulling them back.
  React.useEffect(() => {
    if (!open) return
    const p = parseIso(value)
    if (p) {
      setViewYear(p.year)
      setViewMonth(p.monthIndex)
    } else {
      setViewYear(resolvedMaxYear)
      setViewMonth(today.getMonth())
    }
  }, [open, value, resolvedMaxYear, today])

  // Close on outside mousedown — same pattern as Combobox.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Close on Escape from anywhere inside the popover.
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const yearOptions = React.useMemo(() => {
    const out: number[] = []
    for (let y = resolvedMaxYear; y >= resolvedMinYear; y--) out.push(y)
    return out
  }, [resolvedMaxYear, resolvedMinYear])

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      if (viewYear <= resolvedMinYear) return
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (viewMonth === 11) {
      if (viewYear >= resolvedMaxYear) return
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const selectDay = (day: number) => {
    onChange(toIso(viewYear, viewMonth, day))
    setOpen(false)
  }

  const cells = React.useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay()
    const total = daysInMonth(viewYear, viewMonth)
    const out: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= total; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [viewYear, viewMonth])

  const todayKey = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const selectedKey = parsed
    ? toIso(parsed.year, parsed.monthIndex, parsed.day)
    : null

  const triggerLabel = formatDisplay(value)
  const canPrev = !(viewYear === resolvedMinYear && viewMonth === 0)
  const canNext = !(viewYear === resolvedMaxYear && viewMonth === 11)

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          id={id}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "flex h-9 flex-1 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "hover:bg-accent/40 hover:text-accent-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-destructive",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              !triggerLabel && "text-muted-foreground",
            )}
          >
            {triggerLabel || placeholder}
          </span>
          <Calendar className="size-4 shrink-0 opacity-60" />
        </button>
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Clear date"
            title="Clear date"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className={cn(
            "absolute top-full z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover p-3 text-popover-foreground shadow-lg",
            align === "end" ? "right-0" : "left-0",
            "animate-in fade-in-0 zoom-in-95 duration-150",
          )}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrevMonth}
              disabled={!canPrev}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>

            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Month"
            >
              {MONTHS_LONG.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs font-medium tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={goNextMonth}
              disabled={!canNext}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`p-${idx}`} className="h-8" />
              }
              const iso = toIso(viewYear, viewMonth, day)
              const isSelected = selectedKey === iso
              const isToday = todayKey === iso
              return (
                <button
                  key={`d-${idx}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "mx-auto grid size-8 place-items-center rounded-md text-xs tabular-nums transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:bg-accent hover:text-accent-foreground",
                    !isSelected && isToday && "border border-primary/40 text-primary",
                  )}
                  aria-pressed={isSelected}
                  aria-label={iso}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
