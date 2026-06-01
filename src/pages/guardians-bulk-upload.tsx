import * as React from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { listStudentIds } from "@/lib/students"
import {
  bulkUploadGuardians,
  type BulkUploadGuardianRow,
  type GuardianRowError,
} from "@/lib/guardians"

// One row per student. Each contact (father/mother/guardian) is an optional
// group: leave its three cells blank to skip that contact. At least one of the
// three is required per row, and a contact's name is required when its mobile
// is filled.
const COLUMNS = [
  { key: "student_id", label: "student_id", group: "Student", width: "min-w-[9rem]" },
  { key: "father_name", label: "father_name", group: "Father", width: "min-w-[12rem]" },
  { key: "father_mobile", label: "father_mobile", group: "Father", width: "min-w-[10rem]" },
  { key: "father_email", label: "father_email", group: "Father", width: "min-w-[15rem]" },
  { key: "mother_name", label: "mother_name", group: "Mother", width: "min-w-[12rem]" },
  { key: "mother_mobile", label: "mother_mobile", group: "Mother", width: "min-w-[10rem]" },
  { key: "mother_email", label: "mother_email", group: "Mother", width: "min-w-[15rem]" },
  { key: "guardian_name", label: "guardian_name", group: "Guardian", width: "min-w-[12rem]" },
  { key: "guardian_mobile", label: "guardian_mobile", group: "Guardian", width: "min-w-[10rem]" },
  { key: "guardian_email", label: "guardian_email", group: "Guardian", width: "min-w-[15rem]" },
] as const

type ColumnKey = (typeof COLUMNS)[number]["key"]

type GridRow = {
  id: string
  values: Record<ColumnKey, string>
  errors: Partial<Record<ColumnKey, string>>
  serverErrors: Partial<Record<ColumnKey, string>>
}

const STUDENT_ID_REGEX = /^[A-Z0-9]+$/
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CONTACTS = [
  { role: "father", name: "father_name", mobile: "father_mobile", email: "father_email" },
  { role: "mother", name: "mother_name", mobile: "mother_mobile", email: "mother_email" },
  { role: "guardian", name: "guardian_name", mobile: "guardian_mobile", email: "guardian_email" },
] as const

let nextRowId = 1
const newRowId = () => `r${nextRowId++}`

function emptyValues(): Record<ColumnKey, string> {
  return COLUMNS.reduce(
    (acc, c) => {
      acc[c.key] = ""
      return acc
    },
    {} as Record<ColumnKey, string>,
  )
}

function emptyRow(): GridRow {
  return { id: newRowId(), values: emptyValues(), errors: {}, serverErrors: {} }
}

export function GuardiansBulkUploadPage() {
  const [rows, setRows] = React.useState<GridRow[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [parsing, setParsing] = React.useState(false)
  const [warnings, setWarnings] = React.useState<GuardianRowError[]>([])
  const [existingStudentIds, setExistingStudentIds] = React.useState<string[]>(
    [],
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const cellRefs = React.useRef(new Map<string, HTMLElement>())
  const registerCell = React.useCallback(
    (rowId: string, column: ColumnKey, el: HTMLElement | null) => {
      const key = `${rowId}:${column}`
      if (el) cellRefs.current.set(key, el)
      else cellRefs.current.delete(key)
    },
    [],
  )

  const focusFirstError = React.useCallback(() => {
    for (const row of rows) {
      const firstErrField = (Object.keys(row.errors)[0] ??
        Object.keys(row.serverErrors)[0]) as ColumnKey | undefined
      if (!firstErrField) continue
      const el = cellRefs.current.get(`${row.id}:${firstErrField}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        el.focus()
      }
      return
    }
  }, [rows])

  // Known roll numbers, for client-side "student not found" checks. Loaded
  // once; the bulk endpoint re-checks server-side so this is purely UX.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const ids = await listStudentIds()
        if (!cancelled) setExistingStudentIds(ids)
      } catch {
        // Non-fatal: server still validates on submit.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const existingStudentIdSet = React.useMemo(
    () => new Set(existingStudentIds.map((c) => c.toUpperCase())),
    [existingStudentIds],
  )
  const existingStudentIdSetRef = React.useRef(existingStudentIdSet)
  React.useEffect(() => {
    existingStudentIdSetRef.current = existingStudentIdSet
  }, [existingStudentIdSet])

  React.useEffect(() => {
    if (rows.length === 0) return
    setRows((prev) => recomputeErrors(prev, existingStudentIdSet))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingStudentIdSet])

  const totalErrors = React.useMemo(
    () =>
      rows.reduce(
        (acc, r) =>
          acc +
          Object.keys(r.errors).length +
          Object.keys(r.serverErrors).length,
        0,
      ),
    [rows],
  )

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.label)])
    ws["!cols"] = COLUMNS.map((c) => ({
      wch: Math.max(c.label.length + 2, 14),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Guardians")
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    triggerDownload(blob, "guardians-template.xlsx")
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setWarnings([])
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    try {
      const buf = await readFileBytes(file)
      const wb = XLSX.read(buf, { type: "array" })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) {
        toast.error("The file has no sheets.")
        return
      }
      const sheet = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      })
      if (json.length === 0) {
        toast.error("The sheet has no data rows.")
        return
      }
      const parsed: GridRow[] = json.map((raw) => {
        const values = emptyValues()
        const normalized: Record<string, unknown> = {}
        for (const k of Object.keys(raw)) {
          normalized[normalizeHeader(k)] = raw[k]
        }
        for (const col of COLUMNS) {
          const rawV = normalized[col.key]
          const v = rawV === undefined || rawV === null ? "" : String(rawV).trim()
          if (v !== "") values[col.key] = v
        }
        return { id: newRowId(), values, errors: {}, serverErrors: {} }
      })
      setRows(recomputeErrors(parsed, existingStudentIdSet))
      toast.success(
        `Loaded ${parsed.length} ${parsed.length === 1 ? "row" : "rows"} from ${file.name}.`,
      )
    } catch (err) {
      if (isLockedFileError(err)) {
        toast.error("Couldn't read the file.", {
          description:
            "It may still be open in Excel. Close it there (or save a copy) and try again.",
        })
      } else {
        toast.error("Couldn't parse the file.", {
          description:
            err instanceof Error ? err.message : "Make sure it's a valid Excel file.",
        })
      }
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const updateCell = React.useCallback(
    (rowId: string, column: ColumnKey, value: string) => {
      setRows((prev) => {
        const next = prev.map((r) => {
          if (r.id !== rowId) return r
          const serverErrors = { ...r.serverErrors }
          delete serverErrors[column]
          return { ...r, values: { ...r.values, [column]: value }, serverErrors }
        })
        return recomputeErrors(next, existingStudentIdSetRef.current)
      })
    },
    [],
  )

  const removeRow = React.useCallback((rowId: string) => {
    setRows((prev) =>
      recomputeErrors(
        prev.filter((r) => r.id !== rowId),
        existingStudentIdSetRef.current,
      ),
    )
  }, [])

  const addBlankRow = React.useCallback(() => {
    setRows((prev) =>
      recomputeErrors([...prev, emptyRow()], existingStudentIdSetRef.current),
    )
  }, [])

  const clearAll = () => {
    setRows([])
    setWarnings([])
  }

  const canSubmit = rows.length > 0 && totalErrors === 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload: BulkUploadGuardianRow[] = rows.map((r) => ({
      student_id: r.values.student_id.toUpperCase(),
      father_name: r.values.father_name || undefined,
      father_mobile: r.values.father_mobile || undefined,
      father_email: r.values.father_email || undefined,
      mother_name: r.values.mother_name || undefined,
      mother_mobile: r.values.mother_mobile || undefined,
      mother_email: r.values.mother_email || undefined,
      guardian_name: r.values.guardian_name || undefined,
      guardian_mobile: r.values.guardian_mobile || undefined,
      guardian_email: r.values.guardian_email || undefined,
    }))

    setSubmitting(true)
    setWarnings([])
    try {
      const result = await bulkUploadGuardians(payload)
      toast.success(
        `Saved ${result.contacts_upserted} contact${
          result.contacts_upserted === 1 ? "" : "s"
        } across ${result.students_affected} student${
          result.students_affected === 1 ? "" : "s"
        }.`,
      )
      setWarnings(result.warnings ?? [])
      setRows([])
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as { rowErrors?: GuardianRowError[] } | null
        const serverRowErrors = body?.rowErrors ?? []
        if (serverRowErrors.length > 0) {
          setRows((prev) => applyServerErrors(prev, serverRowErrors))
          toast.error(
            `Server rejected ${countAffectedRows(serverRowErrors)} ${
              countAffectedRows(serverRowErrors) === 1 ? "row" : "rows"
            }. Fix the highlighted cells and try again.`,
          )
        } else {
          toast.error("Bulk upload failed", { description: err.message })
        }
      } else {
        toast.error("Bulk upload failed", {
          description: err instanceof ApiError ? err.message : "Please try again.",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Bulk upload guardians
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One row per student. Fill in father, mother and/or guardian details
            — at least one contact per row. Contacts are matched to one login by
            mobile number, so the same parent of two students becomes a single
            account linked to both.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download />
            Download template
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? <Loader2 className="animate-spin" /> : <Upload />}
            {parsing ? "Parsing…" : "Upload .xlsx"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-foreground dark:bg-amber-950/20">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4 text-amber-500" />
            Upload completed with {warnings.length}{" "}
            {warnings.length === 1 ? "warning" : "warnings"}
          </div>
          <ul className="mt-2 list-disc space-y-0.5 pl-6 text-xs text-muted-foreground">
            {warnings.slice(0, 50).map((w, i) => (
              <li key={i}>
                Row {w.rowIndex + 1}
                {w.field ? ` · ${w.field}` : ""}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsing && rows.length === 0 ? (
        <ParsingShimmer />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={FileSpreadsheet}
            title="No file loaded"
            description={
              <>
                Click <span className="font-medium">Download template</span>,
                fill it in, then upload to preview rows here. You can also{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={addBlankRow}
                >
                  add a blank row
                </button>{" "}
                to enter a few by hand.
              </>
            }
          />
        </div>
      ) : (
        <>
          <SummaryBar
            total={rows.length}
            errorCount={totalErrors}
            onClear={clearAll}
            onAddRow={addBlankRow}
            onSubmit={handleSubmit}
            onGoToError={focusFirstError}
            submitting={submitting}
            canSubmit={canSubmit}
          />
          <div className="rounded-lg border bg-card text-card-foreground">
            <GridTable
              rows={rows}
              onCellChange={updateCell}
              onRemoveRow={removeRow}
              registerCell={registerCell}
            />
          </div>
        </>
      )}
    </div>
  )
}

function ParsingShimmer() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-muted-foreground">
          Parsing your file… this can take a moment for large sheets.
        </span>
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="flex gap-2">
            {Array.from({ length: 10 }).map((_, c) => (
              <Skeleton key={c} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryBar({
  total,
  errorCount,
  onClear,
  onAddRow,
  onSubmit,
  onGoToError,
  submitting,
  canSubmit,
}: {
  total: number
  errorCount: number
  onClear: () => void
  onAddRow: () => void
  onSubmit: () => void
  onGoToError: () => void
  submitting: boolean
  canSubmit: boolean
}) {
  const allClean = errorCount === 0
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-xs",
        allClean
          ? "border-success/30 bg-success/5 text-foreground"
          : "border-destructive/30 bg-destructive/5 text-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        {allClean ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <AlertCircle className="size-4 text-destructive" />
        )}
        <span>
          <span className="font-medium tabular-nums">{total}</span>{" "}
          {total === 1 ? "row" : "rows"} loaded
          {!allClean && (
            <>
              {" · "}
              <span className="font-medium text-destructive tabular-nums">
                {errorCount}
              </span>{" "}
              {errorCount === 1 ? "error" : "errors"} to fix
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!allClean && (
          <Button variant="outline" size="sm" onClick={onGoToError}>
            Jump to next error
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onAddRow}>
          Add row
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={submitting}>
          Clear
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={!canSubmit}>
          {submitting
            ? "Uploading…"
            : `Upload ${total} ${total === 1 ? "row" : "rows"}`}
        </Button>
      </div>
    </div>
  )
}

function GridTable({
  rows,
  onCellChange,
  onRemoveRow,
  registerCell,
}: {
  rows: GridRow[]
  onCellChange: (rowId: string, column: ColumnKey, value: string) => void
  onRemoveRow: (rowId: string) => void
  registerCell: (rowId: string, column: ColumnKey, el: HTMLElement | null) => void
}) {
  return (
    <Table containerClassName="max-h-[32rem] overflow-auto thin-scrollbar">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-16 text-center text-xs">#</TableHead>
          {COLUMNS.map((col) => (
            <TableHead key={col.key} className={cn("text-xs", col.width)}>
              {col.label}
            </TableHead>
          ))}
          <TableHead className="w-12 text-right text-xs" aria-label="Actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <BulkGridRow
            key={row.id}
            row={row}
            idx={idx}
            onCellChange={onCellChange}
            onRemoveRow={onRemoveRow}
            registerCell={registerCell}
          />
        ))}
      </TableBody>
    </Table>
  )
}

const BulkGridRow = React.memo(function BulkGridRow({
  row,
  idx,
  onCellChange,
  onRemoveRow,
  registerCell,
}: {
  row: GridRow
  idx: number
  onCellChange: (rowId: string, column: ColumnKey, value: string) => void
  onRemoveRow: (rowId: string) => void
  registerCell: (rowId: string, column: ColumnKey, el: HTMLElement | null) => void
}) {
  const rowErrors =
    Object.keys(row.errors).length + Object.keys(row.serverErrors).length
  const hasError = rowErrors > 0
  return (
    <TableRow
      className={cn(
        "align-top",
        hasError
          ? "bg-destructive/5 hover:bg-destructive/10"
          : "hover:bg-transparent",
      )}
    >
      <TableCell
        className={cn(
          "text-center text-xs tabular-nums",
          hasError ? "font-semibold text-destructive" : "text-muted-foreground",
        )}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span>{idx + 1}</span>
          {hasError && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {rowErrors}
            </span>
          )}
        </div>
      </TableCell>
      {COLUMNS.map((col) => {
        const err = row.errors[col.key] ?? row.serverErrors[col.key]
        return (
          <TableCell
            key={col.key}
            className={cn("p-1.5", col.width, err && "bg-destructive/10")}
          >
            <CellEditor
              rowId={row.id}
              column={col.key}
              value={row.values[col.key]}
              onCellChange={onCellChange}
              error={err}
              registerCell={registerCell}
            />
          </TableCell>
        )
      })}
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemoveRow(row.id)}
          title="Remove row"
          aria-label="Remove row"
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
})

const CellEditor = React.memo(function CellEditor({
  rowId,
  column,
  value,
  onCellChange,
  error,
  registerCell,
}: {
  rowId: string
  column: ColumnKey
  value: string
  onCellChange: (rowId: string, column: ColumnKey, value: string) => void
  error: string | undefined
  registerCell: (rowId: string, column: ColumnKey, el: HTMLElement | null) => void
}) {
  const invalid = !!error
  const invalidClass = "border-destructive border-2 ring-1 ring-destructive/40"

  const handleChange = React.useCallback(
    (v: string) => onCellChange(rowId, column, v),
    [onCellChange, rowId, column],
  )
  const registerRef = React.useCallback(
    (el: HTMLElement | null) => registerCell(rowId, column, el),
    [registerCell, rowId, column],
  )

  return (
    <div className="space-y-0.5">
      <Input
        ref={registerRef as React.Ref<HTMLInputElement>}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={cn("h-8 text-xs", invalid && invalidClass)}
        title={error}
        autoComplete="off"
        spellCheck={false}
      />
      {error && (
        <p className="text-[10px] leading-tight text-destructive">{error}</p>
      )}
    </div>
  )
})

// ---------- Validation ----------

function recomputeErrors(
  rows: GridRow[],
  existingStudentIds: Set<string>,
): GridRow[] {
  return rows.map((r) => {
    const errs: Partial<Record<ColumnKey, string>> = {}

    const sid = r.values.student_id.trim()
    if (!sid) errs.student_id = "Required"
    else if (!STUDENT_ID_REGEX.test(sid.toUpperCase()))
      errs.student_id = "Letters and digits only"
    else if (sid.length > 32) errs.student_id = "Max 32 chars"
    else if (existingStudentIds.size > 0 && !existingStudentIds.has(sid.toUpperCase()))
      errs.student_id = `student "${sid}" not found`

    let contactCount = 0
    for (const c of CONTACTS) {
      const name = r.values[c.name].trim()
      const mobile = r.values[c.mobile].trim()
      const email = r.values[c.email].trim()
      const hasAny = name || mobile || email
      if (hasAny) contactCount++

      if (!mobile) {
        if (name || email) {
          errs[c.mobile] = "Mobile required for this contact"
        }
        continue
      }
      if (!INDIAN_MOBILE_REGEX.test(mobile)) {
        errs[c.mobile] = "10-digit Indian mobile (starts 6-9)"
      }
      if (!name) errs[c.name] = "Name required"
      if (email && !EMAIL_REGEX.test(email)) errs[c.email] = "Invalid email"
    }

    if (contactCount === 0 && !errs.student_id) {
      errs.student_id = "At least one of father / mother / guardian is required"
    }

    if (errorsEqual(r.errors, errs)) return r
    return { ...r, errors: errs }
  })
}

function errorsEqual(
  a: Partial<Record<ColumnKey, string>>,
  b: Partial<Record<ColumnKey, string>>,
): boolean {
  const ak = Object.keys(a) as ColumnKey[]
  const bk = Object.keys(b) as ColumnKey[]
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function applyServerErrors(
  rows: GridRow[],
  errors: GuardianRowError[],
): GridRow[] {
  const byRow = new Map<number, GuardianRowError[]>()
  for (const e of errors) {
    const list = byRow.get(e.rowIndex) ?? []
    list.push(e)
    byRow.set(e.rowIndex, list)
  }
  return rows.map((r, i) => {
    const rowErrs = byRow.get(i)
    if (!rowErrs || rowErrs.length === 0) return r
    const serverErrors: Partial<Record<ColumnKey, string>> = {}
    for (const e of rowErrs) {
      const field = (e.field ?? "student_id") as ColumnKey
      serverErrors[field] = e.message
    }
    return { ...r, serverErrors }
  })
}

function countAffectedRows(errors: GuardianRowError[]): number {
  return new Set(errors.map((e) => e.rowIndex)).size
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer()
  } catch (err) {
    if (!isLockedFileError(err)) throw err
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (result instanceof ArrayBuffer) resolve(result)
        else reject(new Error("Unexpected reader result"))
      }
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"))
      reader.readAsArrayBuffer(file)
    })
  }
}

function isLockedFileError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false
  if (err.name === "NotReadableError") return true
  if (err.name === "NotFoundError") return true
  return false
}
