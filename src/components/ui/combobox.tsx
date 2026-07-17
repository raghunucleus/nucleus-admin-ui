import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComboboxOption = {
  value: number
  label: string
  /** Subtle secondary text shown to the right of the label. */
  sublabel?: string
}

export interface ComboboxProps {
  value: number | null
  options: ComboboxOption[]
  onChange: (value: number | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** When set, shows a leading "clear" row that resets value to null. */
  clearLabel?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
}

export function Combobox({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results",
  clearLabel,
  disabled,
  invalid,
  id,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  // The panel sizes to its content rather than to the trigger, so it can spill
  // past the right edge of the viewport when the trigger sits in a right-hand
  // grid column. Anchor it to whichever edge keeps it on screen.
  const [align, setAlign] = React.useState<"left" | "right">("left")
  const [labelTruncated, setLabelTruncated] = React.useState(false)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const labelRef = React.useRef<HTMLSpanElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? "").toLowerCase().includes(q),
    )
  }, [options, query])

  // List of "rows": the optional clear sentinel + filtered options. Indexing
  // here is what keyboard nav and aria-activedescendant track.
  type Row =
    | { kind: "clear"; label: string }
    | { kind: "option"; option: ComboboxOption }
  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = []
    if (clearLabel) out.push({ kind: "clear", label: clearLabel })
    for (const o of filtered) out.push({ kind: "option", option: o })
    return out
  }, [clearLabel, filtered])

  const selected = options.find((o) => o.value === value) ?? null

  // Open: reset query, focus the search input, set active row to the selected
  // option (or row 0). Close: clear query.
  React.useEffect(() => {
    if (open) {
      setQuery("")
      const idx = selected
        ? rows.findIndex(
            (r) => r.kind === "option" && r.option.value === selected.value,
          )
        : -1
      setActiveIndex(idx >= 0 ? idx : 0)
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery("")
    }
    // We intentionally watch only `open` here — re-running on every rows
    // change would steal focus and reset the highlighted row mid-type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  React.useEffect(() => {
    // Keep activeIndex inside bounds as the filtered list changes.
    if (rows.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((i) => Math.max(0, Math.min(i, rows.length - 1)))
  }, [rows.length])

  // Close on outside mousedown.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Scroll the active row into view when navigating with the keyboard.
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-combobox-row-index="${activeIndex}"]`,
    )
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  // Pick the anchor edge once the panel has been laid out at its natural width.
  // Resets to 'left' on close so the next open re-measures from a known state.
  React.useLayoutEffect(() => {
    if (!open) {
      setAlign("left")
      return
    }
    const panel = panelRef.current
    const root = rootRef.current
    if (!panel || !root) return
    const { left } = root.getBoundingClientRect()
    const overflowsRight =
      left + panel.offsetWidth > document.documentElement.clientWidth - 8
    setAlign(overflowsRight ? "right" : "left")
  }, [open])

  const commitRow = (row: Row) => {
    if (row.kind === "clear") {
      onChange(null)
    } else {
      onChange(row.option.value)
    }
    setOpen(false)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (rows.length > 0) setActiveIndex((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (rows.length > 0) setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(Math.max(0, rows.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const row = rows[activeIndex]
      if (row) commitRow(row)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  const onTriggerKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) return
    if (
      e.key === "ArrowDown" ||
      e.key === "Enter" ||
      e.key === " " ||
      e.key === "ArrowUp"
    ) {
      e.preventDefault()
      setOpen(true)
    }
  }

  const triggerLabel = selected?.label ?? placeholder

  // Only surface the title tooltip when the label is genuinely clipped — an
  // always-on tooltip over a short value is noise. Re-measured on resize
  // because the trigger width is column-driven, not fixed.
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = labelRef.current
      if (el) setLabelTruncated(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [triggerLabel])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        title={labelTruncated && !open ? triggerLabel : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "hover:bg-accent/40 hover:text-accent-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive",
        )}
      >
        <span
          ref={labelRef}
          className={cn(
            "min-w-0 truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {triggerLabel}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute top-full z-50 mt-1 w-max min-w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0",
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
              placeholder={searchPlaceholder}
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-controls={id ? `${id}-listbox` : undefined}
              aria-activedescendant={
                id && rows.length > 0
                  ? `${id}-row-${activeIndex}`
                  : undefined
              }
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus()
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div
            ref={listRef}
            role="listbox"
            id={id ? `${id}-listbox` : undefined}
            className="max-h-64 overflow-y-auto py-1 thin-scrollbar"
          >
            {rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              rows.map((row, idx) => {
                const isActive = idx === activeIndex
                const isSelected =
                  row.kind === "option" && selected?.value === row.option.value
                return (
                  <button
                    key={
                      row.kind === "clear"
                        ? "__clear"
                        : `opt-${row.option.value}`
                    }
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    id={id ? `${id}-row-${idx}` : undefined}
                    data-combobox-row-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitRow(row)}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-sm",
                      isActive && "bg-accent text-accent-foreground",
                      row.kind === "clear" &&
                        "italic text-muted-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 whitespace-normal break-words">
                        {row.kind === "clear" ? row.label : row.option.label}
                      </span>
                      {row.kind === "option" && row.option.sublabel && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.option.sublabel}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
