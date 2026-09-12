import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { loadXlsx } from "@/lib/xlsx"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { listRegulations, type Regulation } from "@/lib/regulations"
import {
  bulkCreateSubjects,
  type BulkCreateSubjectRow,
  type SubjectRowError,
} from "@/lib/subjects"
import { listSubjectTypes, type SubjectType } from "@/lib/subject-types"

// One subject per row. The regulation is chosen once for the whole batch in
// the header, so it is not a column.
const COLUMNS = [
  { key: "subject_type", label: "subject_type", width: "min-w-[14rem]", excelWidth: 20 },
  { key: "code", label: "code", width: "min-w-[10rem]", excelWidth: 18 },
  { key: "name", label: "name", width: "min-w-[24rem]", excelWidth: 48 },
] as const

type ColumnKey = (typeof COLUMNS)[number]["key"]

type GridRow = {
  id: string
  values: Record<ColumnKey, string>
  errors: Partial<Record<ColumnKey, string>>
  serverErrors: Partial<Record<ColumnKey, string>>
}

// Mirrors the server's create-subject rules.
const CODE_REGEX = /^[A-Z0-9._-]+$/
const CODE_MAX = 32
const NAME_MAX = 255

const TYPES_SHEET = "Subject types"

// ExcelJS dataValidations API shape (missing from the package's shipped .d.ts).
type DataValidationsApi = {
  add: (
    range: string,
    dv: {
      type: "list"
      allowBlank?: boolean
      formulae: string[]
      showErrorMessage?: boolean
      errorStyle?: "stop" | "warning" | "information"
      errorTitle?: string
      error?: string
    },
  ) => void
}

let nextRowId = 1
const newRowId = () => `r${nextRowId++}`

function emptyValues(): Record<ColumnKey, string> {
  return { subject_type: "", code: "", name: "" }
}

function emptyRow(): GridRow {
  return { id: newRowId(), values: emptyValues(), errors: {}, serverErrors: {} }
}

// A sheet cell may hold the type's code or its name; normalise to the code so
// the grid's dropdown shows it selected. Unmatched values are kept verbatim so
// the admin can see what was in the file.
function resolveSubjectType(raw: string, types: SubjectType[]): string {
  const upper = raw.toUpperCase()
  const lower = raw.toLowerCase()
  const t =
    types.find((x) => x.code.toUpperCase() === upper) ??
    types.find((x) => x.name.toLowerCase() === lower)
  return t ? t.code : raw
}

export function SubjectsBulkUploadPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { regulationId?: number }
  const urlRegulationId = search.regulationId

  const [regulationOptions, setRegulationOptions] = React.useState<Regulation[]>([])
  const [subjectTypeOptions, setSubjectTypeOptions] = React.useState<SubjectType[]>(
    [],
  )
  const [optionsLoading, setOptionsLoading] = React.useState(true)

  const [rows, setRows] = React.useState<GridRow[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [parsing, setParsing] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [r, st] = await Promise.all([
          listRegulations({
            status: "active",
            pageSize: 100,
            sortBy: "year_of_regulation",
            sortOrder: "desc",
          }),
          listSubjectTypes({
            status: "active",
            pageSize: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
        ])
        if (cancelled) return
        setRegulationOptions(r.rows)
        setSubjectTypeOptions(st.rows)
      } catch (err) {
        if (cancelled) return
        toast.error("Couldn't load options", {
          description: err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Explicit pick wins; otherwise the regulation handed over from the Subjects
  // page (if still active), otherwise the latest one.
  const [pickedRegulationId, setPickedRegulationId] = React.useState<
    number | undefined
  >(undefined)
  const regulationId =
    pickedRegulationId ??
    (regulationOptions.some((r) => r.id === urlRegulationId)
      ? urlRegulationId
      : regulationOptions[0]?.id)
  const selectedRegulation = regulationOptions.find((r) => r.id === regulationId)

  const typeCodeSet = React.useMemo(
    () => new Set(subjectTypeOptions.map((t) => t.code.toUpperCase())),
    [subjectTypeOptions],
  )
  // Rows can only be loaded once options have arrived (the buttons are
  // disabled until then), so the set is stable by the time validation runs.
  // The ref keeps the cell callbacks referentially stable for the memoized rows.
  const typeCodeSetRef = React.useRef(typeCodeSet)
  React.useEffect(() => {
    typeCodeSetRef.current = typeCodeSet
  }, [typeCodeSet])

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

  const totalErrors = React.useMemo(
    () =>
      rows.reduce(
        (acc, r) =>
          acc + Object.keys(r.errors).length + Object.keys(r.serverErrors).length,
        0,
      ),
    [rows],
  )

  const noSubjectTypes = !optionsLoading && subjectTypeOptions.length === 0
  const inputsDisabled = optionsLoading || noSubjectTypes || regulationId === undefined
  const inputsDisabledTitle = optionsLoading
    ? "Loading options…"
    : noSubjectTypes
      ? "Create an active subject type first"
      : regulationId === undefined
        ? "Create an active regulation first"
        : undefined

  const handleRegulationChange = (v: number | null) => {
    // Mandatory — ignore an unexpected null clear.
    if (v == null) return
    setPickedRegulationId(v)
    // Name clashes are per regulation, so earlier server verdicts no longer
    // apply. Client-side errors don't depend on the regulation.
    setRows((prev) =>
      prev.map((r) =>
        Object.keys(r.serverErrors).length > 0 ? { ...r, serverErrors: {} } : r,
      ),
    )
  }

  const handleDownloadTemplate = async () => {
    // Lazy-load ExcelJS — it's ~1 MB and only needed when an admin actually
    // downloads a template. Reads still go through xlsx.
    const ExcelJSModule = await import("exceljs")
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule
    const wb = new ExcelJS.Workbook()

    // Data sheet must stay first — the upload parser reads sheet 0.
    const ws = wb.addWorksheet("Subjects")
    ws.addRow(COLUMNS.map((c) => c.label))
    ws.getRow(1).font = { bold: true }
    COLUMNS.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.excelWidth
    })
    // Keep codes as raw text so Excel never reformats something like "1E10".
    const codeIndex = COLUMNS.findIndex((c) => c.key === "code") + 1
    ws.getColumn(codeIndex).numFmt = "@"

    // Reference sheet of active subject types. The subject_type dropdown
    // points at its range rather than an inline list, which Excel caps at 255
    // characters.
    const ref = wb.addWorksheet(TYPES_SHEET)
    ref.addRow(["code", "name"])
    ref.getRow(1).font = { bold: true }
    for (const t of subjectTypeOptions) ref.addRow([t.code, t.name])
    ref.getColumn(1).width = 20
    ref.getColumn(2).width = 36

    if (subjectTypeOptions.length > 0) {
      const dv = (ws as unknown as { dataValidations: DataValidationsApi })
        .dataValidations
      const letter = colLetter(COLUMNS.findIndex((c) => c.key === "subject_type") + 1)
      dv.add(`${letter}2:${letter}1000`, {
        type: "list",
        allowBlank: true,
        formulae: [`'${TYPES_SHEET}'!$A$2:$A$${subjectTypeOptions.length + 1}`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid subject type",
        error: `Pick a code from the "${TYPES_SHEET}" sheet.`,
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    triggerDownload(
      blob,
      `subjects-${selectedRegulation?.code ?? "regulation"}-template.xlsx`,
    )
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    // Yield once so React commits the "Parsing…" state before the synchronous
    // XLSX work blocks the main thread.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    try {
      const [XLSX, buf] = await Promise.all([loadXlsx(), readFileBytes(file)])
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
      const parsed: GridRow[] = []
      for (const raw of json) {
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
        // Rows left blank in the template are not data.
        if (!values.subject_type && !values.code && !values.name) continue
        values.subject_type = values.subject_type
          ? resolveSubjectType(values.subject_type, subjectTypeOptions)
          : ""
        values.code = values.code.toUpperCase()
        parsed.push({ id: newRowId(), values, errors: {}, serverErrors: {} })
      }
      if (parsed.length === 0) {
        toast.error("The sheet has no data rows.")
        return
      }
      setRows(recomputeErrors(parsed, typeCodeSet))
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
        return recomputeErrors(next, typeCodeSetRef.current)
      })
    },
    [],
  )

  const removeRow = React.useCallback((rowId: string) => {
    setRows((prev) =>
      recomputeErrors(
        prev.filter((r) => r.id !== rowId),
        typeCodeSetRef.current,
      ),
    )
  }, [])

  const addBlankRow = React.useCallback(() => {
    setRows((prev) => recomputeErrors([...prev, emptyRow()], typeCodeSetRef.current))
  }, [])

  const clearAll = () => setRows([])

  const canSubmit =
    rows.length > 0 && totalErrors === 0 && !submitting && regulationId !== undefined

  const handleSubmit = async () => {
    if (!canSubmit || regulationId === undefined) return
    const payload: BulkCreateSubjectRow[] = rows.map((r) => ({
      subject_type: r.values.subject_type.trim(),
      code: r.values.code.trim().toUpperCase(),
      name: r.values.name.trim(),
    }))

    setSubmitting(true)
    try {
      const result = await bulkCreateSubjects(regulationId, payload)
      toast.success(
        `Created ${result.created} ${result.created === 1 ? "subject" : "subjects"}${
          selectedRegulation ? ` under ${selectedRegulation.code}` : ""
        }.`,
      )
      setRows([])
      void navigate({ to: "/masters/subjects", search: { regulationId } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as { rowErrors?: SubjectRowError[] } | null
        const serverRowErrors = body?.rowErrors ?? []
        if (serverRowErrors.length > 0) {
          const affected = countAffectedRows(serverRowErrors)
          setRows((prev) => applyServerErrors(prev, serverRowErrors))
          toast.error(
            `Server rejected ${affected} ${affected === 1 ? "row" : "rows"}. Fix the highlighted cells and try again.`,
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
      <PageHeader
        leading={
          <BackLink label="Back to subjects">
            <Link
              to="/masters/subjects"
              search={regulationId !== undefined ? { regulationId } : {}}
            />
          </BackLink>
        }
        title="Bulk upload subjects"
      />
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="bulk-regulation" className="text-xs text-muted-foreground">
              Regulation
            </Label>
            <div className="w-48">
              <Combobox
                id="bulk-regulation"
                value={regulationId ?? null}
                options={regulationOptions.map((r) => ({
                  value: r.id,
                  label: r.code,
                  sublabel: r.name,
                }))}
                onChange={handleRegulationChange}
                placeholder={optionsLoading ? "Loading…" : "Select a regulation"}
                searchPlaceholder="Search regulations…"
                emptyMessage="No regulations available"
                disabled={optionsLoading || regulationOptions.length === 0 || submitting}
              />
            </div>
          </div>
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadTemplate()}
            disabled={inputsDisabled}
            title={inputsDisabledTitle}
          >
            <Download />
            Download template
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={inputsDisabled || parsing || submitting}
            title={inputsDisabledTitle}
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

      {parsing && rows.length === 0 ? (
        <ParsingShimmer />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          {noSubjectTypes ? (
            <EmptyState
              icon={AlertCircle}
              title="No active subject types"
              description="Every subject needs a subject type. Create or activate one under Masters → Subject types first."
            />
          ) : (
            <EmptyState
              icon={FileSpreadsheet}
              title="No file loaded"
              description={
                <>
                  Click <span className="font-medium">Download template</span>,
                  fill it in, then upload to preview rows here. You can also{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                    onClick={addBlankRow}
                    disabled={inputsDisabled}
                  >
                    add a blank row
                  </button>{" "}
                  to enter a few by hand.
                </>
              }
            />
          )}
        </div>
      ) : (
        <>
          <SummaryBar
            total={rows.length}
            errorCount={totalErrors}
            onClear={clearAll}
            onAddRow={addBlankRow}
            onSubmit={() => void handleSubmit()}
            onGoToError={focusFirstError}
            submitting={submitting}
            canSubmit={canSubmit}
          />
          <div className="rounded-lg border bg-card text-card-foreground">
            <GridTable
              rows={rows}
              typeOptions={subjectTypeOptions}
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
            <Skeleton className="h-8 w-10" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-[2]" />
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
        <Button variant="ghost" size="sm" onClick={onAddRow} disabled={submitting}>
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
  typeOptions,
  onCellChange,
  onRemoveRow,
  registerCell,
}: {
  rows: GridRow[]
  typeOptions: SubjectType[]
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
            typeOptions={typeOptions}
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
  typeOptions,
  onCellChange,
  onRemoveRow,
  registerCell,
}: {
  row: GridRow
  idx: number
  typeOptions: SubjectType[]
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
        hasError ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-transparent",
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
              typeOptions={typeOptions}
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
  typeOptions,
  onCellChange,
  error,
  registerCell,
}: {
  rowId: string
  column: ColumnKey
  value: string
  typeOptions: SubjectType[]
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

  if (column === "subject_type") {
    const known = typeOptions.some((t) => t.code === value)
    return (
      <div className="space-y-0.5">
        <select
          ref={registerRef as React.Ref<HTMLSelectElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60",
            invalid && invalidClass,
          )}
          title={error}
        >
          <option value="">—</option>
          {typeOptions.map((t) => (
            <option key={t.id} value={t.code}>
              {t.code} — {t.name}
            </option>
          ))}
          {/* Keep an unmatched value from the file visible (and flagged). */}
          {value && !known && <option value={value}>{value} (unknown)</option>}
        </select>
        {error && (
          <p className="text-[10px] leading-tight text-destructive">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <Input
        ref={registerRef as React.Ref<HTMLInputElement>}
        value={value}
        onChange={(e) =>
          handleChange(
            column === "code" ? e.target.value.toUpperCase() : e.target.value,
          )
        }
        aria-invalid={invalid || undefined}
        className={cn("h-8 text-xs", column === "code" && "uppercase", invalid && invalidClass)}
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

// Mirrors SubjectsService.bulkCreate's in-row + in-file checks. Clashes with
// existing subjects are left to the server and come back as rowErrors.
function recomputeErrors(rows: GridRow[], typeCodes: Set<string>): GridRow[] {
  const firstRowByCode = new Map<string, number>()
  const firstRowByName = new Map<string, number>()
  return rows.map((r, idx) => {
    const errs: Partial<Record<ColumnKey, string>> = {}

    const st = r.values.subject_type.trim()
    if (!st) errs.subject_type = "Required"
    else if (!typeCodes.has(st.toUpperCase()))
      errs.subject_type = `Unknown subject type "${st}"`

    const code = r.values.code.trim().toUpperCase()
    if (!code) errs.code = "Required"
    else if (code.length > CODE_MAX) errs.code = `Max ${CODE_MAX} characters`
    else if (!CODE_REGEX.test(code))
      errs.code = "Use letters, numbers, dot, underscore, or dash"
    else {
      const first = firstRowByCode.get(code)
      if (first !== undefined) errs.code = `Duplicate of row ${first + 1}`
      else firstRowByCode.set(code, idx)
    }

    const name = r.values.name.trim()
    if (!name) errs.name = "Required"
    else if (name.length > NAME_MAX) errs.name = `Max ${NAME_MAX} characters`
    else {
      const key = name.toLowerCase()
      const first = firstRowByName.get(key)
      if (first !== undefined) errs.name = `Duplicate of row ${first + 1}`
      else firstRowByName.set(key, idx)
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

function applyServerErrors(rows: GridRow[], errors: SubjectRowError[]): GridRow[] {
  const byRow = new Map<number, SubjectRowError[]>()
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
      serverErrors[e.field ?? "code"] = e.message
    }
    return { ...r, serverErrors }
  })
}

function countAffectedRows(errors: SubjectRowError[]): number {
  return new Set(errors.map((e) => e.rowIndex)).size
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
}

function colLetter(index: number): string {
  let s = ""
  let n = index
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
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
