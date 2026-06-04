import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProgrammeAdmissionYearMatrix } from "@/lib/programme-admission-years"
import { cn } from "@/lib/utils"

interface MatrixPickerProps {
  /** Selected programme_admission_years ids. */
  value: number[]
  onChange: (next: number[]) => void
}

interface Axis {
  id: number
  label: string
}

/** Native checkbox styled to match the editor — no UI primitive dependency. */
function Box({
  checked,
  disabled,
  onToggle,
  className,
}: {
  checked: boolean
  disabled?: boolean
  onToggle: (next: boolean) => void
  className?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onToggle(e.target.checked)}
      className={cn(
        "size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30",
        className,
      )}
    />
  )
}

/**
 * Programme (rows) × admission-year (columns) selector for the
 * `ref:programme_admission_year` RBAC attribute. Each existing
 * (programme, year) cell maps to one `programme_admission_years` id — the
 * value stored on the assignment is the flat array of those ids, so this is a
 * drop-in replacement for the generic multi-select picker.
 *
 * Only active combinations are offered (mirrors the server-side fetcher).
 * Cells with no combination render as a disabled "—".
 */
export function ProgrammeYearMatrixPicker({
  value,
  onChange,
}: MatrixPickerProps) {
  const [programmes, setProgrammes] = useState<Axis[]>([])
  const [years, setYears] = useState<Axis[]>([])
  // `${programme_id}:${admission_year_id}` -> combo id
  const [cellId, setCellId] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await getProgrammeAdmissionYearMatrix()
        if (!alive) return

        const progMap = new Map<number, Axis>()
        const yearMap = new Map<number, { axis: Axis; year: number }>()
        const cells = new Map<string, number>()

        // Only active combinations are selectable (mirrors the server fetcher).
        for (const row of rows.filter((r) => r.is_active)) {
          progMap.set(row.programme_id, {
            id: row.programme_id,
            label: `${row.programme_name} (${row.programme_code})`,
          })
          yearMap.set(row.admission_year_id, {
            axis: {
              id: row.admission_year_id,
              label: row.admission_year_display,
            },
            year: row.admission_year_value,
          })
          cells.set(`${row.programme_id}:${row.admission_year_id}`, row.id)
        }

        setProgrammes(
          [...progMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
        )
        setYears(
          [...yearMap.values()]
            .sort((a, b) => b.year - a.year)
            .map((y) => y.axis),
        )
        setCellId(cells)
      } catch (err) {
        if (!alive) return
        toast.error(
          err instanceof Error
            ? err.message
            : "Couldn't load programme / admission-year options",
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const selected = useMemo(() => new Set(value), [value])
  const allIds = useMemo(() => [...cellId.values()], [cellId])

  function commit(next: Set<number>) {
    onChange([...next])
  }

  function toggleOne(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    commit(next)
  }

  function toggleMany(ids: number[], on: boolean) {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    commit(next)
  }

  function rowIds(programmeId: number): number[] {
    return years
      .map((y) => cellId.get(`${programmeId}:${y.id}`))
      .filter((v): v is number => v !== undefined)
  }

  function colIds(yearId: number): number[] {
    return programmes
      .map((p) => cellId.get(`${p.id}:${yearId}`))
      .filter((v): v is number => v !== undefined)
  }

  function allSelected(ids: number[]): boolean {
    return ids.length > 0 && ids.every((id) => selected.has(id))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Loading programme / admission-year matrix…
      </div>
    )
  }

  if (allIds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No active programme / admission-year combinations exist yet.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background">
              <label className="flex items-center gap-2 text-xs">
                <Box
                  checked={allSelected(allIds)}
                  onToggle={(on) => toggleMany(allIds, on)}
                />
                All
              </label>
            </TableHead>
            {years.map((y) => {
              const ids = colIds(y.id)
              return (
                <TableHead key={y.id} className="text-center">
                  <label className="flex flex-col items-center gap-1 text-xs">
                    <span className="font-medium text-foreground">
                      {y.label}
                    </span>
                    <Box
                      checked={allSelected(ids)}
                      disabled={ids.length === 0}
                      onToggle={(on) => toggleMany(ids, on)}
                    />
                  </label>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {programmes.map((p) => {
            const ids = rowIds(p.id)
            return (
              <TableRow key={p.id}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <label className="flex items-center gap-2 text-xs">
                    <Box
                      checked={allSelected(ids)}
                      disabled={ids.length === 0}
                      onToggle={(on) => toggleMany(ids, on)}
                    />
                    <span className="text-foreground">{p.label}</span>
                  </label>
                </TableCell>
                {years.map((y) => {
                  const id = cellId.get(`${p.id}:${y.id}`)
                  return (
                    <TableCell key={y.id} className="text-center">
                      {id === undefined ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        <Box
                          checked={selected.has(id)}
                          onToggle={() => toggleOne(id)}
                          className="mx-auto block"
                        />
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
