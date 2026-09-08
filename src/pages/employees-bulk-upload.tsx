import * as React from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
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
import { listDepartments, type Department } from "@/lib/departments"
import { listDesignations, type Designation } from "@/lib/designations"
import {
  GENDERS,
  bulkCreateEmployees,
  listEmployeeEmpCodes,
  type BulkCreateEmployeeRow,
  type BulkRowError,
  type Gender,
} from "@/lib/employees"

// Columns in upload order. Each maps to a field on BulkCreateEmployeeRow.
// `width` is a Tailwind min-width class — the cells use these to lay the table
// out wider than the viewport so the horizontal scrollbar kicks in and every
// input has room to breathe.
const COLUMNS = [
  { key: "emp_code", label: "emp_code", required: true, width: "min-w-[8rem]" },
  { key: "emp_display_name", label: "emp_display_name", required: true, width: "min-w-[14rem]" },
  { key: "gender", label: "gender", required: true, width: "min-w-[7rem]" },
  { key: "dob", label: "dob (YYYY-MM-DD)", required: false, width: "min-w-[10rem]" },
  { key: "department_code", label: "department_code", required: true, width: "min-w-[10rem]" },
  { key: "designation_code", label: "designation_code", required: true, width: "min-w-[10rem]" },
  { key: "mobile_number", label: "mobile_number", required: true, width: "min-w-[9rem]" },
  { key: "country_code", label: "country_code", required: false, width: "min-w-[6rem]" },
  { key: "email", label: "email", required: true, width: "min-w-[18rem]" },
  { key: "rm_emp_code", label: "rm_emp_code", required: false, width: "min-w-[8rem]" },
] as const

type ColumnKey = (typeof COLUMNS)[number]["key"]

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

// A row in the grid: raw string values per column + transient client-side
// validation errors keyed by column. `serverErrors` holds messages that came
// back from a failed submit, cleared as soon as the user edits any cell.
type GridRow = {
  id: string
  values: Record<ColumnKey, string>
  errors: Partial<Record<ColumnKey, string>>
  serverErrors: Partial<Record<ColumnKey, string>>
}

const EMP_CODE_REGEX = /^[A-Z0-9._-]+$/
const DIGITS_REGEX = /^[0-9]+$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/

let nextRowId = 1
const newRowId = () => `r${nextRowId++}`

function emptyRow(): GridRow {
  return {
    id: newRowId(),
    values: {
      emp_code: "",
      emp_display_name: "",
      gender: "",
      dob: "",
      department_code: "",
      designation_code: "",
      mobile_number: "",
      country_code: "91",
      email: "",
      rm_emp_code: "",
    },
    errors: {},
    serverErrors: {},
  }
}

export function EmployeesBulkUploadPage() {
  const [rows, setRows] = React.useState<GridRow[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [designations, setDesignations] = React.useState<Designation[]>([])
  const [existingEmpCodes, setExistingEmpCodes] = React.useState<string[]>([])
  const [refsLoaded, setRefsLoaded] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Map of `${rowId}:${columnKey}` → input/select element, so the
  // jump-to-next-error button can focus + scroll the right control.
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

  // Reference data for validation.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [deps, des, codes] = await Promise.all([
          listDepartments({
            status: "active",
            pageSize: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
          listDesignations({
            status: "active",
            pageSize: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
          listEmployeeEmpCodes(),
        ])
        if (cancelled) return
        setDepartments(deps.rows)
        setDesignations(des.rows)
        setExistingEmpCodes(codes)
        setRefsLoaded(true)
      } catch {
        if (!cancelled) setRefsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const deptCodeSet = React.useMemo(
    () => new Set(departments.map((d) => d.code.toUpperCase())),
    [departments],
  )
  const desigCodeSet = React.useMemo(
    () => new Set(designations.map((d) => d.code.toUpperCase())),
    [designations],
  )
  const existingEmpCodeSet = React.useMemo(
    () => new Set(existingEmpCodes.map((c) => c.toUpperCase())),
    [existingEmpCodes],
  )

  // Re-validate whenever rows or reference data changes.
  React.useEffect(() => {
    if (rows.length === 0) return
    setRows((prev) => recomputeErrors(prev, deptCodeSet, desigCodeSet, existingEmpCodeSet))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptCodeSet, desigCodeSet, existingEmpCodeSet])

  const totalErrors = React.useMemo(
    () =>
      rows.reduce(
        (acc, r) => acc + Object.keys(r.errors).length + Object.keys(r.serverErrors).length,
        0,
      ),
    [rows],
  )

  const handleDownloadTemplate = async () => {
    // Lazy-load ExcelJS so writes (which need data validations) don't bloat
    // the main bundle. Reads still use xlsx — it's smaller and doesn't need
    // DV support.
    const ExcelJSModule = await import("exceljs")
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Employees")
    ws.addRow(COLUMNS.map((c) => c.label))

    // Size each column wider than its header text so the full label is
    // legible without resizing. Excel column units are roughly 1 per
    // character at the default font; +4 leaves room for the dropdown arrow
    // and a comfortable margin. Email gets an explicit override since real
    // addresses dwarf the short "email" header.
    const EXCEL_WIDTH_OVERRIDES: Partial<Record<ColumnKey, number>> = {
      email: 28,
    }
    COLUMNS.forEach((c, i) => {
      const override = EXCEL_WIDTH_OVERRIDES[c.key]
      ws.getColumn(i + 1).width =
        override ?? Math.max(c.label.length + 4, 14)
    })

    // Real Excel dropdown for gender. We attach it to rows 2..1000 so the
    // dropdown is available as users fill the sheet, not just where data
    // already exists.
    //
    // ExcelJS exposes `worksheet.dataValidations.add(range, dv)` at runtime
    // but the property is missing from its shipped .d.ts as of 4.4.x — cast
    // through a typed shape rather than littering with `any`.
    const genderIndex = COLUMNS.findIndex((c) => c.key === "gender") + 1
    if (genderIndex > 0) {
      const dv = (ws as unknown as { dataValidations: DataValidationsApi })
        .dataValidations
      const letter = colLetter(genderIndex)
      dv.add(`${letter}2:${letter}1000`, {
        type: "list",
        allowBlank: true,
        formulae: [`"${GENDERS.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid value",
        error: `Pick one of: ${GENDERS.join(", ")}`,
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    triggerDownload(blob, "employees-template.xlsx")
  }

  const handleFile = async (file: File) => {
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
        const values: Record<ColumnKey, string> = {
          emp_code: "",
          emp_display_name: "",
          gender: "",
          dob: "",
          department_code: "",
          designation_code: "",
          mobile_number: "",
          country_code: "91",
          email: "",
          rm_emp_code: "",
        }
        // Normalize headers (strip "(...)" hints, trim, lowercase) so the parser
        // matches "gender (male/female/other)" → col.key "gender" regardless of
        // stray spaces or casing the user introduces.
        const normalized: Record<string, unknown> = {}
        for (const k of Object.keys(raw)) {
          normalized[normalizeHeader(k)] = raw[k]
        }
        for (const col of COLUMNS) {
          const raw_v = normalized[col.key]
          const v = raw_v === undefined || raw_v === null ? "" : String(raw_v).trim()
          if (v !== "") values[col.key] = v
        }
        return {
          id: newRowId(),
          values,
          errors: {},
          serverErrors: {},
        }
      })
      setRows(recomputeErrors(parsed, deptCodeSet, desigCodeSet, existingEmpCodeSet))
      toast.success(`Loaded ${parsed.length} ${parsed.length === 1 ? "row" : "rows"} from ${file.name}.`)
    } catch (err) {
      if (isLockedFileError(err)) {
        toast.error("Couldn't read the file.", {
          description:
            "It may still be open in Excel. Close the file there (or save a copy to a new name) and try again.",
        })
      } else {
        toast.error("Couldn't parse the file.", {
          description:
            err instanceof Error ? err.message : "Make sure it's a valid Excel file.",
        })
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const updateCell = (rowId: string, column: ColumnKey, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.id !== rowId) return r
        // Drop any server error on the touched field — user is editing it now.
        const serverErrors = { ...r.serverErrors }
        delete serverErrors[column]
        return {
          ...r,
          values: { ...r.values, [column]: value },
          serverErrors,
        }
      })
      return recomputeErrors(next, deptCodeSet, desigCodeSet, existingEmpCodeSet)
    })
  }

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId)
      return recomputeErrors(next, deptCodeSet, desigCodeSet, existingEmpCodeSet)
    })
  }

  const addBlankRow = () => {
    setRows((prev) =>
      recomputeErrors([...prev, emptyRow()], deptCodeSet, desigCodeSet, existingEmpCodeSet),
    )
  }

  const clearAll = () => setRows([])

  const canSubmit = rows.length > 0 && totalErrors === 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload: BulkCreateEmployeeRow[] = rows.map((r) => ({
      emp_code: r.values.emp_code.toUpperCase(),
      emp_display_name: r.values.emp_display_name,
      gender: r.values.gender.toLowerCase() as Gender,
      dob: r.values.dob.trim() || null,
      department_code: r.values.department_code.toUpperCase(),
      designation_code: r.values.designation_code.toUpperCase(),
      mobile_number: r.values.mobile_number,
      country_code: r.values.country_code || "91",
      email: r.values.email.toLowerCase(),
      rm_emp_code: r.values.rm_emp_code ? r.values.rm_emp_code.toUpperCase() : null,
    }))

    setSubmitting(true)
    try {
      const result = await bulkCreateEmployees(payload)
      toast.success(`Uploaded ${result.created} ${result.created === 1 ? "employee" : "employees"}.`)
      setRows([])
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as { rowErrors?: BulkRowError[] } | null
        const serverRowErrors = body?.rowErrors ?? []
        if (serverRowErrors.length > 0) {
          setRows((prev) => applyServerErrors(prev, serverRowErrors))
          toast.error(
            `Server rejected ${countAffectedRows(serverRowErrors)} ${
              countAffectedRows(serverRowErrors) === 1 ? "row" : "rows"
            }. Fix the highlighted cells and try again.`,
          )
        } else {
          toast.error("Bulk upload failed", {
            description: err.message,
          })
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
            Bulk upload employees
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Download the template, fill it in, and upload to insert in one transaction.
            Mistakes are flagged in the grid below before anything is saved.
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
            disabled={!refsLoaded}
          >
            <Upload />
            Upload .xlsx
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

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={FileSpreadsheet}
            title="No file loaded"
            description={
              <>
                Click <span className="font-medium">Download template</span>, fill it in,
                then upload to preview rows here. Validation runs in the browser before
                anything reaches the server.
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
    <Table containerClassName="overflow-x-auto thin-scrollbar">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-16 text-center text-xs">#</TableHead>
          {COLUMNS.map((col) => (
            <TableHead key={col.key} className={cn("text-xs", col.width)}>
              {col.label}
              {col.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
            </TableHead>
          ))}
          <TableHead className="w-12 text-right text-xs" aria-label="Actions" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => {
          const rowErrors =
            Object.keys(row.errors).length + Object.keys(row.serverErrors).length
          const hasError = rowErrors > 0
          return (
            <TableRow
              key={row.id}
              className={cn(
                "align-top",
                hasError ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-transparent",
              )}
            >
              <TableCell
                className={cn(
                  "text-center text-xs tabular-nums",
                  hasError
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground",
                )}
                title={hasError ? `${rowErrors} error${rowErrors === 1 ? "" : "s"} in this row` : undefined}
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
                const clientErr = row.errors[col.key]
                const serverErr = row.serverErrors[col.key]
                const err = clientErr ?? serverErr
                return (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "p-1.5",
                      col.width,
                      err && "bg-destructive/10",
                    )}
                  >
                    <CellEditor
                      rowId={row.id}
                      column={col.key}
                      value={row.values[col.key]}
                      onChange={(v) => onCellChange(row.id, col.key, v)}
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
        })}
      </TableBody>
    </Table>
  )
}

function CellEditor({
  rowId,
  column,
  value,
  onChange,
  error,
  registerCell,
}: {
  rowId: string
  column: ColumnKey
  value: string
  onChange: (v: string) => void
  error: string | undefined
  registerCell: (rowId: string, column: ColumnKey, el: HTMLElement | null) => void
}) {
  const invalid = !!error
  const invalidClass = "border-destructive border-2 ring-1 ring-destructive/40"

  if (column === "gender") {
    return (
      <div className="space-y-0.5">
        <select
          ref={(el) => registerCell(rowId, column, el)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60",
            invalid && invalidClass,
          )}
          title={error}
        >
          <option value="">—</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {error && <p className="text-[10px] leading-tight text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <Input
        ref={(el) => registerCell(rowId, column, el)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={cn("h-8 text-xs", invalid && invalidClass)}
        title={error}
        autoComplete="off"
        spellCheck={false}
      />
      {error && <p className="text-[10px] leading-tight text-destructive">{error}</p>}
    </div>
  )
}

// ---------- Validation ----------

function recomputeErrors(
  rows: GridRow[],
  deptCodes: Set<string>,
  desigCodes: Set<string>,
  existingEmpCodes: Set<string>,
): GridRow[] {
  // Intra-batch dupe maps keyed by normalized value → first row indexes that hold it.
  const empCodeCount = new Map<string, number[]>()
  const emailCount = new Map<string, number[]>()
  const mobileCount = new Map<string, number[]>()
  const empCodeSetThisBatch = new Set<string>()

  rows.forEach((r, i) => {
    const code = r.values.emp_code.trim().toUpperCase()
    if (code) {
      empCodeSetThisBatch.add(code)
      const list = empCodeCount.get(code) ?? []
      list.push(i)
      empCodeCount.set(code, list)
    }
    const email = r.values.email.trim().toLowerCase()
    if (email) {
      const list = emailCount.get(email) ?? []
      list.push(i)
      emailCount.set(email, list)
    }
    const mobileKey = `${r.values.country_code.trim() || "91"}::${r.values.mobile_number.trim()}`
    if (r.values.mobile_number.trim()) {
      const list = mobileCount.get(mobileKey) ?? []
      list.push(i)
      mobileCount.set(mobileKey, list)
    }
  })

  return rows.map((r) => {
    const errs: Partial<Record<ColumnKey, string>> = {}

    const empCode = r.values.emp_code.trim()
    if (!empCode) errs.emp_code = "Required"
    else if (!EMP_CODE_REGEX.test(empCode.toUpperCase()))
      errs.emp_code = "Letters, digits, dot, underscore, or dash"
    else if (empCode.length > 32) errs.emp_code = "Max 32 chars"
    else if ((empCodeCount.get(empCode.toUpperCase()) ?? []).length > 1)
      errs.emp_code = `Duplicate in batch (rows ${(empCodeCount.get(empCode.toUpperCase()) ?? []).map((n) => n + 1).join(", ")})`

    if (!r.values.emp_display_name.trim()) errs.emp_display_name = "Required"
    else if (r.values.emp_display_name.length > 128)
      errs.emp_display_name = "Max 128 chars"

    const g = r.values.gender.trim().toLowerCase()
    if (!g) errs.gender = "Required"
    else if (!GENDERS.includes(g as Gender)) errs.gender = "male / female / other"

    const dob = r.values.dob.trim()
    if (dob && !DOB_REGEX.test(dob)) errs.dob = "Use YYYY-MM-DD"

    const dept = r.values.department_code.trim()
    if (!dept) errs.department_code = "Required"
    else if (!deptCodes.has(dept.toUpperCase()))
      errs.department_code = "Unknown department code"

    const desig = r.values.designation_code.trim()
    if (!desig) errs.designation_code = "Required"
    else if (!desigCodes.has(desig.toUpperCase()))
      errs.designation_code = "Unknown designation code"

    const mobile = r.values.mobile_number.trim()
    if (!mobile) errs.mobile_number = "Required"
    else if (!DIGITS_REGEX.test(mobile)) errs.mobile_number = "Digits only"
    else if (mobile.length > 20) errs.mobile_number = "Max 20 digits"
    else {
      const k = `${(r.values.country_code.trim() || "91")}::${mobile}`
      if ((mobileCount.get(k) ?? []).length > 1) {
        errs.mobile_number = `Duplicate in batch (rows ${(mobileCount.get(k) ?? []).map((n) => n + 1).join(", ")})`
      }
    }

    const cc = r.values.country_code.trim() || "91"
    if (!DIGITS_REGEX.test(cc)) errs.country_code = "Digits only"
    else if (cc.length > 8) errs.country_code = "Max 8 digits"

    const email = r.values.email.trim()
    if (!email) errs.email = "Required"
    else if (!EMAIL_REGEX.test(email)) errs.email = "Invalid email"
    else if ((emailCount.get(email.toLowerCase()) ?? []).length > 1)
      errs.email = `Duplicate in batch (rows ${(emailCount.get(email.toLowerCase()) ?? []).map((n) => n + 1).join(", ")})`

    const rm = r.values.rm_emp_code.trim()
    if (rm) {
      const up = rm.toUpperCase()
      if (!EMP_CODE_REGEX.test(up)) errs.rm_emp_code = "Invalid format"
      else if (up === empCode.toUpperCase()) errs.rm_emp_code = "Cannot be self"
      else if (!empCodeSetThisBatch.has(up) && !existingEmpCodes.has(up))
        errs.rm_emp_code = "No employee with that code"
    }

    return { ...r, errors: errs }
  })
}

function applyServerErrors(rows: GridRow[], errors: BulkRowError[]): GridRow[] {
  const byRow = new Map<number, BulkRowError[]>()
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
      const field = (e.field ?? "emp_code") as ColumnKey
      serverErrors[field] = e.message
    }
    return { ...r, serverErrors }
  })
}

function countAffectedRows(errors: BulkRowError[]): number {
  return new Set(errors.map((e) => e.rowIndex)).size
}

// Read file bytes with a FileReader fallback. On Windows, Blob.arrayBuffer()
// sometimes raises NotReadableError when another app (e.g. Excel) holds an
// exclusive lock; the older FileReader API occasionally succeeds where the
// modern one fails. If both throw, the caller surfaces a friendlier message.
// Header normalizer: strip a trailing "(...)" hint, trim, lowercase. Keeps
// the parser tolerant of headers like "gender (male/female/other)" or a
// casual "Emp_Code " typed by a user.
function normalizeHeader(h: string): string {
  return h
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
}

// 1-indexed Excel column letter: 1→A, 26→Z, 27→AA. Used to address data
// validation ranges when generating the template.
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
