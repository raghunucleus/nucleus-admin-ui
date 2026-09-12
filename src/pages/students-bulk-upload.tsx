import * as React from "react"
import { toast } from "sonner"
import { loadXlsx } from "@/lib/xlsx"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
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
import { listAdmissionYears, type AdmissionYear } from "@/lib/admission-years"
import {
  getProgrammeAdmissionYearMatrix,
  type ProgrammeAdmissionYearMatrixCell,
} from "@/lib/programme-admission-years"
import { listProgrammes, type Programme } from "@/lib/programmes"
import {
  BLOOD_GROUPS,
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  GENDERS,
  bulkCreateStudents,
  listStudentIds,
  type BloodGroup,
  type BulkCreateStudentRow,
  type BulkRowError,
  type EntryType,
  type Gender,
} from "@/lib/students"

// Bulk-grid cells carry the human label ("Regular"/"Lateral"); the API wants
// the numeric code (1/2). These helpers bridge the two, tolerant of casing and
// of a raw "1"/"2" typed straight into the sheet.
const ENTRY_TYPE_LABEL_LIST = ENTRY_TYPES.map((v) => ENTRY_TYPE_LABELS[v])
const ENTRY_TYPE_BY_LABEL = new Map<string, EntryType>(
  ENTRY_TYPES.map((v) => [ENTRY_TYPE_LABELS[v].toLowerCase(), v]),
)

// Normalize a parsed cell to its canonical label so the dropdown shows it
// selected. Recognizes the labels (any case) and the raw numeric codes; leaves
// anything else untouched so validation can flag it.
function normalizeEntryTypeCell(raw: string): string {
  const v = raw.trim()
  if (v === "") return ""
  const byLabel = ENTRY_TYPE_BY_LABEL.get(v.toLowerCase())
  if (byLabel) return ENTRY_TYPE_LABELS[byLabel]
  const num = Number(v)
  if ((ENTRY_TYPES as readonly number[]).includes(num)) {
    return ENTRY_TYPE_LABELS[num as EntryType]
  }
  return v
}

// Blank defaults to Regular (1); validation guarantees any non-blank value is a
// known label by submit time.
function entryTypeCellToValue(raw: string): EntryType {
  const v = raw.trim().toLowerCase()
  if (v === "") return 1
  return ENTRY_TYPE_BY_LABEL.get(v) ?? 1
}

// Columns in the upload grid. The (programme, admission year) pair is locked
// at the top via the matrix selector, so it's intentionally NOT a column here.
const COLUMNS = [
  { key: "student_id", label: "student_id", required: true, width: "min-w-[9rem]" },
  { key: "display_name", label: "display_name", required: true, width: "min-w-[14rem]" },
  { key: "gender", label: "gender", required: true, width: "min-w-[7rem]" },
  {
    key: "entry_type",
    label: "entry_type",
    required: false,
    width: "min-w-[10rem]",
  },
  { key: "email", label: "email", required: true, width: "min-w-[18rem]" },
  { key: "mobile_number", label: "mobile_number", required: true, width: "min-w-[10rem]" },
  { key: "dob", label: "dob (YYYY-MM-DD)", required: true, width: "min-w-[11rem]" },
  { key: "blood_group", label: "blood_group", required: false, width: "min-w-[7rem]" },
  { key: "abc_id", label: "abc_id", required: false, width: "min-w-[10rem]" },
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
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const ABC_ID_REGEX = /^\d{12}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let nextRowId = 1
const newRowId = () => `r${nextRowId++}`

function emptyRow(): GridRow {
  return {
    id: newRowId(),
    values: {
      student_id: "",
      display_name: "",
      gender: "",
      entry_type: "",
      email: "",
      mobile_number: "",
      dob: "",
      blood_group: "",
      abc_id: "",
    },
    errors: {},
    serverErrors: {},
  }
}

type Selection = { programmeId: number; admissionYearId: number } | null

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

export function StudentsBulkUploadPage() {
  const [programmes, setProgrammes] = React.useState<Programme[]>([])
  const [admissionYears, setAdmissionYears] = React.useState<AdmissionYear[]>([])
  const [matrix, setMatrix] = React.useState<ProgrammeAdmissionYearMatrixCell[]>(
    [],
  )
  const [refsLoading, setRefsLoading] = React.useState(true)
  const [refsFailed, setRefsFailed] = React.useState(false)

  const [selection, setSelection] = React.useState<Selection>(null)
  const [rows, setRows] = React.useState<GridRow[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [parsing, setParsing] = React.useState(false)
  const [existingStudentIds, setExistingStudentIds] = React.useState<string[]>(
    [],
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Cell DOM map for "jump to next error".
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

  const loadRefs = React.useCallback(async () => {
    setRefsLoading(true)
    setRefsFailed(false)
    try {
      const [progs, years, mx] = await Promise.all([
        listProgrammes({
          status: "active",
          pageSize: 100,
          sortBy: "name",
          sortOrder: "asc",
        }),
        listAdmissionYears({
          status: "active",
          pageSize: 100,
          sortBy: "year",
          sortOrder: "desc",
        }),
        getProgrammeAdmissionYearMatrix(),
      ])
      setProgrammes(progs.rows)
      setAdmissionYears(years.rows)
      setMatrix(mx)
    } catch {
      setRefsFailed(true)
    } finally {
      setRefsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadRefs()
  }, [loadRefs])

  // Reference data for client-side dedupe. Loaded once; the bulk endpoint
  // re-checks server-side so this is purely UX.
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

  // Validation depends on the existing-IDs set, which changes asynchronously.
  // Reading it via a ref inside callbacks lets us keep updateCell/removeRow
  // referentially stable so the memoized BulkGridRow doesn't re-render every
  // time a parent state updates. The ref always points at the latest set.
  const existingStudentIdSetRef = React.useRef(existingStudentIdSet)
  React.useEffect(() => {
    existingStudentIdSetRef.current = existingStudentIdSet
  }, [existingStudentIdSet])

  // Re-validate whenever the existing-IDs set changes.
  React.useEffect(() => {
    if (rows.length === 0) return
    setRows((prev) => recomputeErrors(prev, existingStudentIdSet))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingStudentIdSet])

  const totalErrors = React.useMemo(
    () =>
      rows.reduce(
        (acc, r) =>
          acc + Object.keys(r.errors).length + Object.keys(r.serverErrors).length,
        0,
      ),
    [rows],
  )

  const programmeById = React.useMemo(
    () => new Map(programmes.map((p) => [p.id, p])),
    [programmes],
  )
  const admissionYearById = React.useMemo(
    () => new Map(admissionYears.map((y) => [y.id, y])),
    [admissionYears],
  )

  const selectedProgramme = selection
    ? programmeById.get(selection.programmeId)
    : null
  const selectedYear = selection
    ? admissionYearById.get(selection.admissionYearId)
    : null

  const handleSelectCell = (programmeId: number, admissionYearId: number) => {
    setSelection({ programmeId, admissionYearId })
    // Fresh grid on each new selection — discard any previous batch.
    setRows([])
  }

  const handleChangeSelection = () => {
    if (rows.length > 0) {
      const ok = window.confirm(
        "Changing the programme or admission year will discard the rows you've loaded. Continue?",
      )
      if (!ok) return
    }
    setSelection(null)
    setRows([])
  }

  const handleDownloadTemplate = async () => {
    if (!selection) return
    // Lazy-load ExcelJS — it's ~1 MB and only needed when an admin actually
    // downloads a template. Reads still go through xlsx (smaller, no DV needed).
    const ExcelJSModule = await import("exceljs")
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Students")
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

    // Force the dob column to text format. Otherwise Excel auto-converts
    // anything that looks date-ish ("2003-08-15", "15/8/03", …) into its
    // locale-specific date display, and our YYYY-MM-DD validator rejects
    // the round-tripped value. With numFmt "@" the cell stays as raw text.
    const dobIndex = COLUMNS.findIndex((c) => c.key === "dob") + 1
    if (dobIndex > 0) {
      ws.getColumn(dobIndex).numFmt = "@"
    }

    // Real Excel dropdowns for the enum columns. We attach data validations
    // to a wide row range (2..1000) so dropdowns appear as users fill the
    // sheet, not just where data already exists.
    //
    // ExcelJS exposes `worksheet.dataValidations.add(range, dv)` at runtime
    // but the property is missing from its shipped .d.ts as of 4.4.x — cast
    // through a typed shape rather than littering with `any`.
    const dv = (ws as unknown as { dataValidations: DataValidationsApi })
      .dataValidations
    const dropdowns: Array<{ key: ColumnKey; values: readonly string[] }> = [
      { key: "gender", values: GENDERS },
      { key: "entry_type", values: ENTRY_TYPE_LABEL_LIST },
      { key: "blood_group", values: BLOOD_GROUPS },
    ]
    for (const { key, values } of dropdowns) {
      const colIndex = COLUMNS.findIndex((c) => c.key === key) + 1
      if (colIndex === 0) continue
      const letter = colLetter(colIndex)
      dv.add(`${letter}2:${letter}1000`, {
        type: "list",
        allowBlank: true,
        formulae: [`"${values.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid value",
        error: `Pick one of: ${values.join(", ")}`,
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const fileTag =
      selectedProgramme && selectedYear
        ? `${selectedProgramme.code}-${selectedYear.year}`
        : "batch"
    triggerDownload(blob, `students-${fileTag}-template.xlsx`)
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    // Yield once so React commits the "Parsing…" state to the DOM before the
    // synchronous XLSX work blocks the main thread. Without this, big files
    // freeze the UI for the entire parse with no spinner shown.
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
      if (json.length === 0) {
        toast.error("The sheet has no data rows.")
        return
      }
      const parsed: GridRow[] = json.map((raw) => {
        const values: Record<ColumnKey, string> = {
          student_id: "",
          display_name: "",
          gender: "",
          entry_type: "",
          email: "",
          mobile_number: "",
          dob: "",
          blood_group: "",
          abc_id: "",
        }
        // Build a header → value map keyed by the *normalized* header (lowercased,
        // trimmed, with any trailing "(...)" hint stripped). The template ships
        // headers like "dob (YYYY-MM-DD)" and "gender (male/female/other)" — this
        // lets us match them back to the bare col.key without forcing users to
        // hand-edit headers, and stays tolerant of stray whitespace or casing.
        const normalized: Record<string, unknown> = {}
        for (const k of Object.keys(raw)) {
          normalized[normalizeHeader(k)] = raw[k]
        }
        for (const col of COLUMNS) {
          const raw_v = normalized[col.key]
          const v =
            raw_v === undefined || raw_v === null ? "" : String(raw_v).trim()
          if (v !== "") values[col.key] = v
        }
        // Coerce "1"/"2"/"regular"/… to the canonical label so the dropdown
        // shows it selected and validation matches on the label.
        values.entry_type = normalizeEntryTypeCell(values.entry_type)
        return {
          id: newRowId(),
          values,
          errors: {},
          serverErrors: {},
        }
      })
      setRows(recomputeErrors(parsed, existingStudentIdSet))
      toast.success(
        `Loaded ${parsed.length} ${parsed.length === 1 ? "row" : "rows"} from ${file.name}.`,
      )
    } catch (err) {
      if (isLockedFileError(err)) {
        toast.error("Couldn't read the file.", {
          description:
            "It may still be open in Excel. Close the file there (or save a copy to a new name) and try again.",
        })
      } else {
        toast.error("Couldn't parse the file.", {
          description:
            err instanceof Error
              ? err.message
              : "Make sure it's a valid Excel file.",
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
          return {
            ...r,
            values: { ...r.values, [column]: value },
            serverErrors,
          }
        })
        return recomputeErrors(next, existingStudentIdSetRef.current)
      })
    },
    [],
  )

  const removeRow = React.useCallback((rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId)
      return recomputeErrors(next, existingStudentIdSetRef.current)
    })
  }, [])

  const addBlankRow = React.useCallback(() => {
    setRows((prev) =>
      recomputeErrors([...prev, emptyRow()], existingStudentIdSetRef.current),
    )
  }, [])

  const clearAll = () => setRows([])

  const canSubmit =
    !!selection && rows.length > 0 && totalErrors === 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !selection) return
    const payload: BulkCreateStudentRow[] = rows.map((r) => ({
      student_id: r.values.student_id.toUpperCase(),
      display_name: r.values.display_name,
      gender: r.values.gender.toLowerCase() as Gender,
      entry_type: entryTypeCellToValue(r.values.entry_type),
      email: r.values.email.toLowerCase(),
      mobile_number: r.values.mobile_number,
      dob: r.values.dob,
      blood_group: r.values.blood_group
        ? (r.values.blood_group as BloodGroup)
        : null,
      abc_id: r.values.abc_id || null,
    }))

    setSubmitting(true)
    try {
      const result = await bulkCreateStudents(
        selection.programmeId,
        selection.admissionYearId,
        payload,
      )
      toast.success(
        `Uploaded ${result.created} ${result.created === 1 ? "student" : "students"}.`,
      )
      setRows([])
      // Refresh known IDs so subsequent uploads in this session catch dupes.
      try {
        setExistingStudentIds(await listStudentIds())
      } catch {
        // ignore
      }
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

  // ---------- Render: split into Phase 1 (matrix) and Phase 2 (grid) ----------

  // One heading for both phases — hoisted so the header slot never goes blank
  // while the page flips between the matrix and the grid.
  const header = <PageHeader title="Bulk upload students" />

  if (!selection) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 py-2">
        {header}

        <MatrixSelector
          programmes={programmes}
          admissionYears={admissionYears}
          matrix={matrix}
          loading={refsLoading}
          failed={refsFailed}
          onRetry={() => void loadRefs()}
          onPick={handleSelectCell}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      {header}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleChangeSelection}>
            <ArrowLeft />
            Change
          </Button>
          <p className="text-xs text-muted-foreground">
            Uploading into{" "}
            <span className="font-medium text-foreground">
              {selectedProgramme?.name ?? "—"}
            </span>{" "}
            <span className="text-muted-foreground">
              ({selectedProgramme?.code ?? "—"})
            </span>{" "}
            ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {selectedYear?.display_year ?? "—"}
            </span>
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
                fill it in, then upload to preview rows here. Programme +
                admission year are locked — only student fields go in the file.
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

function MatrixSelector({
  programmes,
  admissionYears,
  matrix,
  loading,
  failed,
  onRetry,
  onPick,
}: {
  programmes: Programme[]
  admissionYears: AdmissionYear[]
  matrix: ProgrammeAdmissionYearMatrixCell[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  onPick: (programmeId: number, admissionYearId: number) => void
}) {
  // Index the matrix by "programmeId:yearId" for O(1) cell lookups.
  const cellIndex = React.useMemo(() => {
    const m = new Map<string, ProgrammeAdmissionYearMatrixCell>()
    for (const c of matrix) m.set(`${c.programme_id}:${c.admission_year_id}`, c)
    return m
  }, [matrix])

  // Sort programmes by department name then programme name so cells with the
  // same department land next to each other. Group separators are drawn
  // between consecutive department-changes.
  const sortedProgrammes = React.useMemo(() => {
    return [...programmes].sort((a, b) => {
      const da = a.department?.name ?? ""
      const db = b.department?.name ?? ""
      if (da !== db) return da.localeCompare(db)
      return a.name.localeCompare(b.name)
    })
  }, [programmes])

  // Years are already sorted desc by the API call, but be defensive.
  const sortedYears = React.useMemo(
    () => [...admissionYears].sort((a, b) => b.year - a.year),
    [admissionYears],
  )

  if (failed) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground">
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load the matrix"
          description="There was a problem reaching the server."
          action={
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (sortedProgrammes.length === 0 || sortedYears.length === 0) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground">
        <EmptyState
          icon={GraduationCap}
          title="No programmes or admission years yet"
          description="Create at least one active programme and admission year, and link them under Programme admission years, before bulk-uploading students."
        />
      </div>
    )
  }

  let previousDept: string | undefined

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Pick a batch</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Rows are programmes (grouped by department); columns are admission
          years. Click <em>Upload</em> on a configured & active cell. Dash = not configured.
        </p>
      </div>
      <div className="overflow-auto thin-scrollbar">
        <Table containerClassName="max-h-[36rem] overflow-auto thin-scrollbar">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-30 min-w-[18rem] border-r bg-card text-xs">
                Programme
              </TableHead>
              {sortedYears.map((y) => (
                <TableHead
                  key={y.id}
                  className="text-center text-xs font-semibold tabular-nums"
                >
                  {y.display_year}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProgrammes.map((p) => {
              const deptName = p.department?.name ?? "—"
              const showGroup = deptName !== previousDept
              previousDept = deptName
              return (
                <React.Fragment key={p.id}>
                  {showGroup && (
                    <TableRow className="hover:bg-transparent">
                      {/* colSpan'd cell already starts at left-0, so sticky on
                          the cell itself is a no-op. Make the inner content
                          sticky instead so the department name stays pinned
                          at the left as the user scrolls the year columns. */}
                      <TableCell
                        colSpan={1 + sortedYears.length}
                        className="border-y bg-muted/40 p-0"
                      >
                        <div className="sticky left-0 z-20 inline-block px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {deptName}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="hover:bg-accent/10">
                    <TableCell className="sticky left-0 z-20 min-w-[18rem] border-r bg-card align-middle">
                      <div className="font-medium leading-tight">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.code}
                        {p.display_name ? ` · ${p.display_name}` : null}
                      </div>
                    </TableCell>
                    {sortedYears.map((y) => {
                      const cell = cellIndex.get(`${p.id}:${y.id}`)
                      const active = !!cell?.is_active
                      const configured = !!cell
                      return (
                        <TableCell key={y.id} className="text-center">
                          {active ? (
                            <button
                              type="button"
                              onClick={() => onPick(p.id, y.id)}
                              className="mx-auto inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                              title={`Upload to ${p.code} · ${y.display_year}`}
                              aria-label={`Upload to ${p.code} · ${y.display_year}`}
                            >
                              <Upload className="size-3.5" />
                              Upload
                            </button>
                          ) : configured ? (
                            <span
                              className="inline-block rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                              title="This combination is configured but currently inactive."
                            >
                              inactive
                            </span>
                          ) : (
                            <span
                              className="text-muted-foreground/50"
                              aria-hidden="true"
                            >
                              —
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ParsingShimmer() {
  // Mimics the loaded-grid layout (header row + ~6 data rows) so the page
  // doesn't jump when the real rows render. The Loader2 + "Parsing…" label
  // is shown at the top so the user knows work is happening, not just a
  // generic skeleton tease.
  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-muted-foreground">
          Parsing your file… this can take a moment for large sheets.
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 flex-1" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="flex gap-2">
            {Array.from({ length: 8 }).map((_, c) => (
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
              {col.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
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

// Each row renders ~10 inputs/selects. With 1000 rows a naive .map() would
// rebuild every row on every keystroke; memo keeps unchanged rows mounted
// and lets React skip them.
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
        title={
          hasError
            ? `${rowErrors} error${rowErrors === 1 ? "" : "s"} in this row`
            : undefined
        }
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

// Memoized: when the row above doesn't change, none of its cells re-render
// either. The change handler is reconstructed from stable props inside the
// cell, so the memo doesn't get defeated by a fresh closure per render.
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

  if (column === "gender") {
    return (
      <div className="space-y-0.5">
        <select
          ref={registerRef as React.Ref<HTMLSelectElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
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
        {error && (
          <p className="text-[10px] leading-tight text-destructive">{error}</p>
        )}
      </div>
    )
  }

  if (column === "entry_type") {
    return (
      <div className="space-y-0.5">
        <select
          ref={registerRef as React.Ref<HTMLSelectElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60",
            invalid && invalidClass,
          )}
          title={error}
        >
          <option value="">—</option>
          {ENTRY_TYPE_LABEL_LIST.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-[10px] leading-tight text-destructive">{error}</p>
        )}
      </div>
    )
  }

  if (column === "blood_group") {
    return (
      <div className="space-y-0.5">
        <select
          ref={registerRef as React.Ref<HTMLSelectElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60",
            invalid && invalidClass,
          )}
          title={error}
        >
          <option value="">—</option>
          {BLOOD_GROUPS.map((bg) => (
            <option key={bg} value={bg}>
              {bg}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-[10px] leading-tight text-destructive">{error}</p>
        )}
      </div>
    )
  }

  if (column === "dob") {
    return (
      // The app's calendar, not `<input type="date">` — Chromium dismisses
      // the native popup on month navigation inside this grid. The error-jump
      // focuses the picker's trigger button, so that is what gets registered.
      <div
        ref={(el) =>
          registerCell(rowId, column, el?.querySelector("button") ?? null)
        }
        className="space-y-0.5"
        title={error}
      >
        <DatePicker
          value={value}
          onChange={handleChange}
          invalid={invalid}
          placeholder="—"
          className="[&>div>button]:h-8 [&>div>button]:px-2 [&>div>button]:text-xs"
        />
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
  const studentIdCount = new Map<string, number[]>()
  const emailCount = new Map<string, number[]>()
  const abcIdCount = new Map<string, number[]>()

  rows.forEach((r, i) => {
    const sid = r.values.student_id.trim().toUpperCase()
    if (sid) {
      const list = studentIdCount.get(sid) ?? []
      list.push(i)
      studentIdCount.set(sid, list)
    }
    const email = r.values.email.trim().toLowerCase()
    if (email) {
      const list = emailCount.get(email) ?? []
      list.push(i)
      emailCount.set(email, list)
    }
    const abc = r.values.abc_id.trim()
    if (abc) {
      const list = abcIdCount.get(abc) ?? []
      list.push(i)
      abcIdCount.set(abc, list)
    }
  })

  return rows.map((r) => {
    const errs: Partial<Record<ColumnKey, string>> = {}

    const sid = r.values.student_id.trim()
    if (!sid) errs.student_id = "Required"
    else if (!STUDENT_ID_REGEX.test(sid.toUpperCase()))
      errs.student_id = "Letters and digits only"
    else if (sid.length > 32) errs.student_id = "Max 32 chars"
    else if (existingStudentIds.has(sid.toUpperCase()))
      errs.student_id = `student_id "${sid}" already exists`
    else if ((studentIdCount.get(sid.toUpperCase()) ?? []).length > 1) {
      const indices = studentIdCount.get(sid.toUpperCase()) ?? []
      errs.student_id = `Duplicate in batch (rows ${indices.map((n) => n + 1).join(", ")})`
    }

    if (!r.values.display_name.trim()) errs.display_name = "Required"
    else if (r.values.display_name.length > 128)
      errs.display_name = "Max 128 chars"

    const g = r.values.gender.trim().toLowerCase()
    if (!g) errs.gender = "Required"
    else if (!GENDERS.includes(g as Gender))
      errs.gender = "male / female / other"

    // Optional — blank defaults to Regular on submit.
    const et = r.values.entry_type.trim()
    if (et && !ENTRY_TYPE_BY_LABEL.has(et.toLowerCase()))
      errs.entry_type = "Regular or Lateral"

    const email = r.values.email.trim()
    if (!email) errs.email = "Required"
    else if (!EMAIL_REGEX.test(email)) errs.email = "Invalid email"
    else if ((emailCount.get(email.toLowerCase()) ?? []).length > 1) {
      const indices = emailCount.get(email.toLowerCase()) ?? []
      errs.email = `Duplicate in batch (rows ${indices.map((n) => n + 1).join(", ")})`
    }

    const mobile = r.values.mobile_number.trim()
    if (!mobile) errs.mobile_number = "Required"
    else if (!INDIAN_MOBILE_REGEX.test(mobile))
      errs.mobile_number = "10-digit Indian mobile (starts 6-9)"

    const dob = r.values.dob.trim()
    if (!dob) errs.dob = "Required"
    else if (!DATE_REGEX.test(dob)) errs.dob = "Use YYYY-MM-DD"

    const bg = r.values.blood_group.trim()
    if (bg && !(BLOOD_GROUPS as readonly string[]).includes(bg))
      errs.blood_group = "Pick a valid blood group"

    const abc = r.values.abc_id.trim()
    if (abc) {
      if (!ABC_ID_REGEX.test(abc)) errs.abc_id = "Exactly 12 digits"
      else if ((abcIdCount.get(abc) ?? []).length > 1) {
        const indices = abcIdCount.get(abc) ?? []
        errs.abc_id = `Duplicate in batch (rows ${indices.map((n) => n + 1).join(", ")})`
      }
    }

    // Keep the row object's identity when the error map is unchanged. This
    // is what lets the memoized BulkGridRow skip re-rendering unaffected
    // rows on every keystroke; without it, .map() would mint a fresh object
    // for every row on every call and the whole grid would re-render.
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
      const field = (e.field ?? "student_id") as ColumnKey
      serverErrors[field] = e.message
    }
    return { ...r, serverErrors }
  })
}

function countAffectedRows(errors: BulkRowError[]): number {
  return new Set(errors.map((e) => e.rowIndex)).size
}

// Header normalizer: strip a trailing "(...)" hint, trim, lowercase. Keeps
// the parser tolerant of headers like "dob (YYYY-MM-DD)" or a casual
// "Student_ID " typed by a user.
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
      reader.onerror = () =>
        reject(reader.error ?? new Error("FileReader failed"))
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
