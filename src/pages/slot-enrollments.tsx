import * as React from "react"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { loadXlsx } from "@/lib/xlsx"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  Users,
  X,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { ProgrammeSemesterSubjectSlotType } from "@/lib/programme-semester-subjects"
import {
  bulkSetSlotEnrollments,
  getSlotEnrollments,
  type BulkSetSlotEnrollmentRow,
  type SlotEnrollmentOptionView,
  type SlotEnrollmentRowError,
  type SlotEnrollmentStudentView,
  type SlotEnrollmentView,
} from "@/lib/slot-enrollments"

const SLOT_TYPE_LABEL: Record<ProgrammeSemesterSubjectSlotType, string> = {
  open_elective: "Open elective",
  honors: "Honors",
  minors: "Minors",
}

// A pick targets a specific (candidate, faculty) pair — both required to
// assign, both null to clear. Pending changes are keyed by student id.
type Pick = { option_id: number; employee_id: number } | null
type PendingChanges = Map<number, Pick>

// Per-row outcome of parsing an upload, surfaced in the preview sheet
// before anything is staged into the pending map.
type PreviewRow =
  | {
      kind: "change"
      sheetRowIndex: number
      studentId: number
      studentCode: string
      studentName: string
      from: { code: string; faculty: string } | null
      to: { code: string; faculty: string } | null
      pick: Pick
    }
  | {
      kind: "unchanged"
      sheetRowIndex: number
      studentCode: string
      studentName: string
    }
  | {
      kind: "error"
      sheetRowIndex: number
      studentCode: string
      message: string
    }

type Preview = {
  rows: PreviewRow[]
  totals: { changed: number; unchanged: number; errors: number }
}

function picksEqual(a: Pick, b: Pick): boolean {
  if (a === null) return b === null
  if (b === null) return false
  return a.option_id === b.option_id && a.employee_id === b.employee_id
}

export function SlotEnrollmentsPage() {
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
    slotId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const slotId = Number(params.slotId)

  const [view, setView] = React.useState<SlotEnrollmentView | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [pending, setPending] = React.useState<PendingChanges>(new Map())
  const [filter, setFilter] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [rowErrors, setRowErrors] = React.useState<Map<string, string>>(
    new Map(),
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = React.useState(false)
  const [preview, setPreview] = React.useState<Preview | null>(null)

  const load = React.useCallback(async () => {
    if (!Number.isInteger(slotId) || slotId <= 0) {
      setFailed(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const v = await getSlotEnrollments(slotId)
      setView(v)
      setPending(new Map())
      setRowErrors(new Map())
    } catch (err) {
      setFailed(true)
      if (err instanceof ApiError) {
        toast.error("Couldn't load enrollments", { description: err.message })
      }
    } finally {
      setLoading(false)
    }
  }, [slotId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Server-side pick for a student (before any pending edits applied).
  const serverPickFor = React.useCallback(
    (studentId: number): Pick => {
      const s = view?.students.find((x) => x.student_id === studentId)
      if (!s || s.option_id === null || s.employee_id === null) return null
      return { option_id: s.option_id, employee_id: s.employee_id }
    },
    [view],
  )

  // Effective pick = pending if set, else server. This is what the UI shows.
  const pickFor = React.useCallback(
    (studentId: number): Pick => {
      if (pending.has(studentId)) return pending.get(studentId) ?? null
      return serverPickFor(studentId)
    },
    [pending, serverPickFor],
  )

  const togglePick = React.useCallback(
    (studentId: number, next: Pick) => {
      const server = serverPickFor(studentId)
      setPending((prev) => {
        const m = new Map(prev)
        if (picksEqual(next, server)) {
          // Reverted to server's value — drop the pending change so the
          // "unsaved" badge reflects only real diffs.
          m.delete(studentId)
        } else {
          m.set(studentId, next)
        }
        return m
      })
      // The user is fixing this row — clear any prior server error on it.
      setRowErrors((prev) => {
        if (prev.size === 0) return prev
        const s = view?.students.find((x) => x.student_id === studentId)
        if (!s) return prev
        const key = s.student_code.toUpperCase()
        if (!prev.has(key)) return prev
        const m = new Map(prev)
        m.delete(key)
        return m
      })
    },
    [serverPickFor, view],
  )

  const optionsById = React.useMemo(() => {
    const m = new Map<number, SlotEnrollmentOptionView>()
    for (const o of view?.options ?? []) m.set(o.option_id, o)
    return m
  }, [view])

  // Per-(option, faculty) projected count — sum what each pair would have
  // after pending changes commit. Drives the per-cell badge.
  const projectedCellCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    if (!view) return counts
    for (const s of view.students) {
      const p = pickFor(s.student_id)
      if (p === null) continue
      const key = `${p.option_id}:${p.employee_id}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [view, pickFor])

  // Per-option totals across all faculty — feed the candidate strip header.
  const projectedOptionCounts = React.useMemo(() => {
    const m = new Map<number, number>()
    for (const [key, count] of projectedCellCounts) {
      const optionId = Number(key.split(":")[0])
      m.set(optionId, (m.get(optionId) ?? 0) + count)
    }
    return m
  }, [projectedCellCounts])

  const filteredStudents = React.useMemo(() => {
    if (!view) return [] as SlotEnrollmentStudentView[]
    const q = filter.trim().toLowerCase()
    if (!q) return view.students
    return view.students.filter(
      (s) =>
        s.student_code.toLowerCase().includes(q) ||
        s.display_name.toLowerCase().includes(q),
    )
  }, [view, filter])

  const totalPending = pending.size
  const totalAssigned = React.useMemo(() => {
    if (!view) return 0
    return view.students.filter((s) => pickFor(s.student_id) !== null).length
  }, [view, pickFor])

  // Pre-flight: any pending pick that targets a candidate with no faculty?
  // The DB will reject it, so warn the admin inline before they hit Save.
  const facultylessPicks = React.useMemo(() => {
    if (!view) return [] as { studentCode: string; optionCode: string }[]
    const out: { studentCode: string; optionCode: string }[] = []
    for (const s of view.students) {
      const p = pickFor(s.student_id)
      if (p === null) continue
      const opt = optionsById.get(p.option_id)
      if (opt && opt.faculty.length === 0) {
        out.push({ studentCode: s.student_code, optionCode: opt.subject_code })
      }
    }
    return out
  }, [view, pickFor, optionsById])

  // Bulk upload commits to the server directly — no second Save click. Only
  // the file's "change" rows are POSTed; errors and unchanged rows are
  // dropped silently. The matrix's manual `pending` edits are left alone so
  // they don't get wiped by a bulk upload.
  const applyPreview = async () => {
    if (!view || !preview) return
    const rows: BulkSetSlotEnrollmentRow[] = []
    for (const r of preview.rows) {
      if (r.kind !== "change") continue
      const s = view.students.find((x) => x.student_id === r.studentId)
      if (!s) continue
      if (r.pick === null) {
        rows.push({
          student_id: s.student_code,
          option_subject_code: null,
          faculty_emp_code: null,
        })
        continue
      }
      const opt = optionsById.get(r.pick.option_id)
      const fac = opt?.faculty.find((f) => f.employee_id === r.pick!.employee_id)
      if (!opt || !fac) continue
      rows.push({
        student_id: s.student_code,
        option_subject_code: opt.subject_code,
        faculty_emp_code: fac.emp_code,
      })
    }
    if (rows.length === 0) {
      setPreview(null)
      return
    }
    setSubmitting(true)
    try {
      const res = await bulkSetSlotEnrollments(slotId, rows)
      toast.success(
        `Saved ${res.applied} enrollment${res.applied === 1 ? "" : "s"}${
          res.cleared > 0 ? ` and cleared ${res.cleared}` : ""
        }.`,
      )
      setPreview(null)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as
          | { rowErrors?: SlotEnrollmentRowError[] }
          | null
        const serverErrors = body?.rowErrors ?? []
        if (serverErrors.length > 0) {
          // Surface server-side rejections inside the same preview sheet so
          // the admin can read the messages without leaving the dialog.
          setPreview((prev) => {
            if (!prev) return prev
            // Map server rowIndex back to the parsed change-row at the same
            // position in `rows` (which only contains "change" entries).
            const changeRows = prev.rows.filter(
              (r) => r.kind === "change",
            ) as Extract<PreviewRow, { kind: "change" }>[]
            const errorByStudentCode = new Map<string, string>()
            for (const se of serverErrors) {
              const cr = changeRows[se.rowIndex]
              if (!cr) continue
              errorByStudentCode.set(cr.studentCode, se.message)
            }
            // Turn the rejected change-rows into error-rows in place so the
            // sheet redraws with them in the error section.
            const newRows: PreviewRow[] = prev.rows.map((r) => {
              if (r.kind !== "change") return r
              const msg = errorByStudentCode.get(r.studentCode)
              if (!msg) return r
              return {
                kind: "error",
                sheetRowIndex: r.sheetRowIndex,
                studentCode: r.studentCode,
                message: msg,
              }
            })
            const changed = newRows.filter((r) => r.kind === "change").length
            const errors = newRows.filter((r) => r.kind === "error").length
            return {
              rows: newRows,
              totals: { changed, unchanged: prev.totals.unchanged, errors },
            }
          })
          toast.error(
            `Server rejected ${serverErrors.length} row${serverErrors.length === 1 ? "" : "s"}. Fix the highlighted issues and re-apply.`,
          )
        } else {
          toast.error("Couldn't save", { description: err.message })
        }
      } else {
        toast.error("Couldn't save", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const cancelPreview = () => {
    if (submitting) return
    setPreview(null)
  }

  const handleSave = async () => {
    if (!view || pending.size === 0) return
    const rows: BulkSetSlotEnrollmentRow[] = []
    for (const [studentId, next] of pending.entries()) {
      const s = view.students.find((x) => x.student_id === studentId)
      if (!s) continue
      if (next === null) {
        rows.push({
          student_id: s.student_code,
          option_subject_code: null,
          faculty_emp_code: null,
        })
        continue
      }
      const opt = optionsById.get(next.option_id)
      const fac = opt?.faculty.find((f) => f.employee_id === next.employee_id)
      if (!opt || !fac) continue
      rows.push({
        student_id: s.student_code,
        option_subject_code: opt.subject_code,
        faculty_emp_code: fac.emp_code,
      })
    }
    setSubmitting(true)
    setRowErrors(new Map())
    try {
      const res = await bulkSetSlotEnrollments(slotId, rows)
      toast.success(
        `Saved ${res.applied} enrollment${res.applied === 1 ? "" : "s"}${
          res.cleared > 0 ? ` and cleared ${res.cleared}` : ""
        }.`,
      )
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.data as
          | { rowErrors?: SlotEnrollmentRowError[] }
          | null
        if (body?.rowErrors && body.rowErrors.length > 0) {
          const m = new Map<string, string>()
          for (const re of body.rowErrors) {
            const row = rows[re.rowIndex]
            if (!row) continue
            m.set(row.student_id.toUpperCase(), re.message)
          }
          setRowErrors(m)
          toast.error(
            `Server rejected ${m.size} row${m.size === 1 ? "" : "s"}. Hover the row to see why.`,
          )
        } else {
          toast.error("Couldn't save", { description: err.message })
        }
      } else {
        toast.error("Couldn't save", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const discard = () => {
    setPending(new Map())
    setRowErrors(new Map())
  }

  // Download an Excel matrix the admin can edit offline. The shape is
  // intentionally simple: one row per student, the admin fills in
  // `selected_code` + `selected_faculty` (both or neither — neither = clear).
  const downloadTemplate = async () => {
    if (!view) return
    const ExcelJSModule = await import("exceljs")
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Enrollments")

    const header = [
      "student_id",
      "student_name",
      "selected_code",
      "selected_faculty",
    ]
    ws.addRow(header)
    ws.getRow(1).font = { bold: true }
    ws.getColumn(1).width = 18
    ws.getColumn(2).width = 32
    ws.getColumn(3).width = 18
    ws.getColumn(4).width = 20

    // Data rows mirror current state so admins see what's already set.
    for (const s of view.students) {
      const p = pickFor(s.student_id)
      const opt = p ? optionsById.get(p.option_id) : null
      const fac = opt && p ? opt.faculty.find((f) => f.employee_id === p.employee_id) : null
      ws.addRow([
        s.student_code,
        s.display_name,
        opt?.subject_code ?? "",
        fac?.emp_code ?? "",
      ])
    }

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
    const dv = (ws as unknown as { dataValidations: DataValidationsApi })
      .dataValidations

    // Dropdown for selected_code (column C) listing candidate codes.
    const candidateCodes = view.options.map((o) => o.subject_code)
    if (candidateCodes.length > 0 && view.students.length > 0) {
      dv.add(`C2:C${view.students.length + 1}`, {
        type: "list",
        allowBlank: true,
        formulae: [`"${candidateCodes.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid subject",
        error: `Pick one of: ${candidateCodes.join(", ")}`,
      })
    }
    // Dropdown for selected_faculty (column D) — union of every faculty
    // across all candidates (the parser checks the actual (cand, fac)
    // pairing). Plenty good enough as a UX nudge.
    const allFacultyCodes = Array.from(
      new Set(view.options.flatMap((o) => o.faculty.map((f) => f.emp_code))),
    )
    if (allFacultyCodes.length > 0 && view.students.length > 0) {
      dv.add(`D2:D${view.students.length + 1}`, {
        type: "list",
        allowBlank: true,
        formulae: [`"${allFacultyCodes.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid faculty",
        error: `Pick one of: ${allFacultyCodes.join(", ")}`,
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `enrollments-slot-${slotId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  const handleFile = async (file: File) => {
    if (!view) return
    setParsing(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    try {
      const [XLSX, buf] = await Promise.all([loadXlsx(), file.arrayBuffer()])
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
      const studentByCode = new Map(
        view.students.map((s) => [s.student_code.toUpperCase(), s]),
      )
      const optionByCode = new Map(
        view.options.map((o) => [o.subject_code.toUpperCase(), o]),
      )

      // Header tolerance: strip non-alphanumerics + lowercase so "Selected
      // Code", "selected-code", "selected_code" all map to the same key.
      const normHdr = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase()
      const KEY_STUDENT = "studentid"
      const KEY_CODE = "selectedcode"
      const KEY_FAC = "selectedfaculty"

      const firstRow = json[0] as Record<string, unknown>
      const headerKeys = new Set(Object.keys(firstRow).map(normHdr))
      const missing: string[] = []
      if (!headerKeys.has(KEY_STUDENT)) missing.push("student_id")
      if (!headerKeys.has(KEY_CODE)) missing.push("selected_code")
      if (!headerKeys.has(KEY_FAC)) missing.push("selected_faculty")
      if (missing.length > 0) {
        toast.error("Upload header mismatch", {
          description: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Use the downloaded template.`,
        })
        return
      }

      // Resolve a Pick into the human-friendly labels the preview shows.
      const labelFor = (
        p: Pick,
      ): { code: string; faculty: string } | null => {
        if (p === null) return null
        const opt = view.options.find((o) => o.option_id === p.option_id)
        const fac = opt?.faculty.find(
          (f) => f.employee_id === p.employee_id,
        )
        return {
          code: opt?.subject_code ?? `#${p.option_id}`,
          faculty: fac?.emp_code ?? `#${p.employee_id}`,
        }
      }

      const previewRows: PreviewRow[] = []
      let changed = 0
      let unchanged = 0
      let errors = 0
      json.forEach((raw, idx) => {
        const sheetRowIndex = idx + 2 // header is row 1, data starts at row 2
        const norm: Record<string, unknown> = {}
        for (const k of Object.keys(raw)) norm[normHdr(k)] = raw[k]

        const sid = String(norm[KEY_STUDENT] ?? "").trim().toUpperCase()
        if (!sid) {
          previewRows.push({
            kind: "error",
            sheetRowIndex,
            studentCode: "",
            message: "Row has no student_id",
          })
          errors += 1
          return
        }
        const student = studentByCode.get(sid)
        if (!student) {
          previewRows.push({
            kind: "error",
            sheetRowIndex,
            studentCode: sid,
            message: `No active student in this batch with student_id "${sid}"`,
          })
          errors += 1
          return
        }

        const selCode = String(norm[KEY_CODE] ?? "").trim().toUpperCase()
        const selFac = String(norm[KEY_FAC] ?? "").trim().toUpperCase()

        let picked: Pick = null
        if (selCode && selFac) {
          const opt = optionByCode.get(selCode)
          if (!opt) {
            previewRows.push({
              kind: "error",
              sheetRowIndex,
              studentCode: sid,
              message: `Unknown subject code "${selCode}"`,
            })
            errors += 1
            return
          }
          const fac = opt.faculty.find(
            (f) => f.emp_code.toUpperCase() === selFac,
          )
          if (!fac) {
            previewRows.push({
              kind: "error",
              sheetRowIndex,
              studentCode: sid,
              message: `"${selFac}" isn't a faculty of subject "${selCode}"`,
            })
            errors += 1
            return
          }
          picked = { option_id: opt.option_id, employee_id: fac.employee_id }
        } else if (selCode || selFac) {
          previewRows.push({
            kind: "error",
            sheetRowIndex,
            studentCode: sid,
            message:
              "Only one of selected_code / selected_faculty filled — both required, or both blank to clear",
          })
          errors += 1
          return
        }

        const server = serverPickFor(student.student_id)
        if (picksEqual(picked, server)) {
          previewRows.push({
            kind: "unchanged",
            sheetRowIndex,
            studentCode: sid,
            studentName: student.display_name,
          })
          unchanged += 1
          return
        }
        previewRows.push({
          kind: "change",
          sheetRowIndex,
          studentId: student.student_id,
          studentCode: sid,
          studentName: student.display_name,
          from: labelFor(server),
          to: labelFor(picked),
          pick: picked,
        })
        changed += 1
      })

      setPreview({
        rows: previewRows,
        totals: { changed, unchanged, errors },
      })
    } catch (err) {
      toast.error("Couldn't parse file", {
        description: err instanceof Error ? err.message : "Try again.",
      })
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to student allocation">
          <Link
            to="/masters/programme-configuration/semester/$programmeSemesterId/student-allocation"
            params={{
              programmeSemesterId: params.programmeSemesterId ?? "",
            }}
            search={{
              programmeId: search.programmeId,
              admissionYearId: search.admissionYearId,
            }}
          />
        </BackLink>
      }
      title={view?.slot_name || "Slot"}
    />
  )

  return (
    <div className="mx-auto max-w-[100rem] space-y-4 py-2">
      {header}

      {loading ? (
        <EnrollmentsSkeleton />
      ) : failed || !view ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load this slot"
            description="It may have been removed, or you opened it without its programme context."
          />
        </div>
      ) : (
        <>
          {/* Sticky toolbar — pins to the top of the page's scroll container
              so Download / Upload stay reachable while scrolling through a
              long student list. z-50 puts it above the matrix's sticky
              header (z-30 on thead, z-40 on the rowSpanned Student cell) so
              the table headers can't paint over this toolbar when both are
              pinned at top:0 of `main`.

              The `before:` pseudo extends a bg-background panel ABOVE the
              header. When the toolbar pins, that panel covers `main`'s 2rem
              top padding so scrolling content can't peek through the gap
              between the app shell header and this toolbar. The pseudo is
              -z-10 + bg-background so it stays invisible when not stuck
              (it sits behind the back link with a matching color). */}
          <header className="sticky top-0 z-50 rounded-lg border bg-card px-5 py-3 text-card-foreground shadow-sm before:pointer-events-none before:absolute before:-top-12 before:left-0 before:right-0 before:-z-10 before:h-12 before:bg-background before:content-['']">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {view.slot_type && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    {SLOT_TYPE_LABEL[view.slot_type]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void downloadTemplate()}
                >
                  <Download />
                  Download matrix
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                >
                  <Upload />
                  {parsing ? "Parsing…" : "Upload matrix"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                  }}
                />
              </div>
            </div>
          </header>

          <CandidateStrip
            options={view.options}
            projectedOptionCounts={projectedOptionCounts}
            totalStudents={view.students.length}
            totalAssigned={totalAssigned}
          />

          {facultylessPicks.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <div className="font-medium">
                  {facultylessPicks.length} pick
                  {facultylessPicks.length === 1 ? "" : "s"} target a subject
                  with no faculty allocated.
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Allocate at least one faculty to those subjects first, or
                  change the pick.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <span>
                <span className="font-medium tabular-nums">
                  {totalAssigned}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums">
                  {view.students.length}
                </span>{" "}
                {view.students.length === 1 ? "student" : "students"} assigned
              </span>
              {totalPending > 0 && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                  {totalPending} unsaved
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Filter by ID or name…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 w-56"
                autoComplete="off"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={discard}
                disabled={submitting || totalPending === 0}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={submitting || totalPending === 0}
              >
                {submitting
                  ? "Saving…"
                  : totalPending > 0
                    ? `Save ${totalPending}`
                    : "Save"}
              </Button>
            </div>
          </div>

          {view.students.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={Users}
                title="No students in this batch yet"
                description="Bulk-upload students for this programme & admission year before assigning them to subjects."
              />
            </div>
          ) : view.options.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={AlertTriangle}
                title="No subjects offered for this slot"
                description="Open the slot in the subjects screen and add at least one subject to offer before assigning students."
              />
            </div>
          ) : (
            <EnrollmentMatrix
              students={filteredStudents}
              options={view.options}
              pickFor={pickFor}
              togglePick={togglePick}
              rowErrors={rowErrors}
              cellCounts={projectedCellCounts}
            />
          )}
        </>
      )}

      <Sheet
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) cancelPreview()
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          {preview && (
            <UploadPreview
              preview={preview}
              submitting={submitting}
              onCancel={cancelPreview}
              onApply={() => void applyPreview()}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function UploadPreview({
  preview,
  submitting,
  onCancel,
  onApply,
}: {
  preview: Preview
  submitting: boolean
  onCancel: () => void
  onApply: () => void
}) {
  const { rows, totals } = preview
  const errors = rows.filter((r) => r.kind === "error") as Extract<
    PreviewRow,
    { kind: "error" }
  >[]
  const changes = rows.filter((r) => r.kind === "change") as Extract<
    PreviewRow,
    { kind: "change" }
  >[]
  const canApply = totals.changed > 0

  // Cap rendered rows to keep huge uploads snappy. Counts above the lists
  // already convey the total — we just stop drawing past N.
  const MAX_VISIBLE = 200
  const visibleErrors = errors.slice(0, MAX_VISIBLE)
  const visibleChanges = changes.slice(0, MAX_VISIBLE)

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Upload preview</SheetTitle>
        <SheetDescription>
          Review the parsed rows below. Clicking Apply saves the changes
          straight to the server — no second confirmation. Errors and
          unchanged rows are dropped.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <PreviewStat label="Changes" value={totals.changed} tone="primary" />
          <PreviewStat
            label="Unchanged"
            value={totals.unchanged}
            tone="muted"
          />
          <PreviewStat label="Errors" value={totals.errors} tone="destructive" />
        </div>

        {errors.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
              Errors ({errors.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              These rows won't be applied. Fix the file and re-upload, or
              proceed with just the valid changes.
            </p>
            <ul className="divide-y rounded-md border">
              {visibleErrors.map((r, i) => (
                <li key={i} className="px-3 py-2 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-muted-foreground">
                      Row {r.sheetRowIndex}
                    </span>
                    {r.studentCode && (
                      <span className="font-mono font-medium">
                        {r.studentCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-destructive">{r.message}</div>
                </li>
              ))}
              {errors.length > visibleErrors.length && (
                <li className="px-3 py-2 text-xs italic text-muted-foreground">
                  + {errors.length - visibleErrors.length} more error
                  {errors.length - visibleErrors.length === 1 ? "" : "s"} not
                  shown
                </li>
              )}
            </ul>
          </section>
        )}

        {changes.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
              Changes ({changes.length})
            </h3>
            <ul className="divide-y rounded-md border">
              {visibleChanges.map((r, i) => (
                <li key={i} className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono font-medium">{r.studentCode}</span>
                    <span className="text-muted-foreground">{r.studentName}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono">
                    <PickLabel pick={r.from} muted />
                    <span className="text-muted-foreground">→</span>
                    <PickLabel pick={r.to} />
                  </div>
                </li>
              ))}
              {changes.length > visibleChanges.length && (
                <li className="px-3 py-2 text-xs italic text-muted-foreground">
                  + {changes.length - visibleChanges.length} more change
                  {changes.length - visibleChanges.length === 1 ? "" : "s"} not
                  shown
                </li>
              )}
            </ul>
          </section>
        )}

        {changes.length === 0 && errors.length === 0 && (
          <div className="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            All {totals.unchanged} row{totals.unchanged === 1 ? "" : "s"} already
            match the current state — nothing to apply.
          </div>
        )}
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onApply} disabled={!canApply || submitting}>
          {submitting
            ? "Saving…"
            : canApply
              ? `Save ${totals.changed} change${totals.changed === 1 ? "" : "s"}`
              : "Nothing to save"}
        </Button>
      </SheetFooter>
    </div>
  )
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "primary" | "muted" | "destructive"
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "primary" && "border-primary/30 bg-primary/5",
        tone === "muted" && "border-input bg-muted/30",
        tone === "destructive" &&
          value > 0 &&
          "border-destructive/30 bg-destructive/5",
        tone === "destructive" && value === 0 && "border-input bg-muted/30",
      )}
    >
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "destructive" && value > 0 && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function PickLabel({
  pick,
  muted = false,
}: {
  pick: { code: string; faculty: string } | null
  muted?: boolean
}) {
  if (pick === null) {
    return (
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
          muted
            ? "border-input bg-background text-muted-foreground"
            : "border-muted-foreground/30 bg-muted text-muted-foreground",
        )}
      >
        Unassigned
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        muted
          ? "border-input/60 bg-muted/30 text-muted-foreground"
          : "border-primary/40 bg-primary/5 text-foreground",
      )}
    >
      <span className="font-medium">{pick.code}</span>
      <span className="text-muted-foreground">/</span>
      <span>{pick.faculty}</span>
    </span>
  )
}

function CandidateStrip({
  options,
  projectedOptionCounts,
  totalStudents,
  totalAssigned,
}: {
  options: SlotEnrollmentView["options"]
  projectedOptionCounts: Map<number, number>
  totalStudents: number
  totalAssigned: number
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Subjects offered
        </div>
        <div className="text-xs text-muted-foreground">
          {totalAssigned}/{totalStudents} assigned
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {options.map((o) => {
          const projected = projectedOptionCounts.get(o.option_id) ?? 0
          const noFaculty = o.faculty.length === 0
          return (
            <div
              key={o.option_id}
              className={cn(
                "rounded-md border bg-background px-2 py-1.5",
                noFaculty ? "border-destructive/40" : "border-input/60",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 rounded border border-input bg-muted/40 px-1 py-0 font-mono text-[10px] font-medium text-foreground">
                  {o.subject_code}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {o.subject_name}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                    projected > 0
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground",
                  )}
                  title={
                    projected !== o.student_count
                      ? `${projected} after pending (was ${o.student_count})`
                      : `${projected} enrolled`
                  }
                >
                  {projected}
                  {projected !== o.student_count && (
                    <span className="ml-0.5 text-warning">•</span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                {noFaculty ? (
                  <span className="font-medium text-destructive">
                    No faculty
                  </span>
                ) : (
                  o.faculty.map((f) => (
                    <span
                      key={f.employee_id}
                      className="inline-flex items-center gap-1 rounded border border-input/60 bg-muted/30 px-1 py-0"
                      title={f.emp_display_name}
                    >
                      <span className="font-mono font-medium text-foreground">
                        {f.emp_code}
                      </span>
                      <span className="max-w-[8rem] truncate">
                        {f.emp_display_name}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EnrollmentMatrix({
  students,
  options,
  pickFor,
  togglePick,
  rowErrors,
  cellCounts,
}: {
  students: SlotEnrollmentStudentView[]
  options: SlotEnrollmentOptionView[]
  pickFor: (studentId: number) => Pick
  togglePick: (studentId: number, next: Pick) => void
  rowErrors: Map<string, string>
  cellCounts: Map<string, number>
}) {
  // Each subject groups its faculty into a colSpan'd header. Subjects with
  // no faculty still take one column (a disabled placeholder).
  const optionGroups = options.map((o) => ({
    option: o,
    span: Math.max(1, o.faculty.length),
    isEmpty: o.faculty.length === 0,
  }))

  // Solid sticky-cell background. Tailwind opacity utilities (bg-card/30)
  // let scrolling cells bleed through — the matrix needs FULLY opaque
  // sticky cells to occlude the columns sliding underneath them.
  const stickyBg = "bg-card"
  // Inset shadow on the inner edge (right edge of left-sticky, left edge of
  // right-sticky) so the sticky columns visually "lift" off the scroll area.
  const stickyShadowLeft = "shadow-[inset_-1px_0_0_var(--border)]"
  const stickyShadowRight = "shadow-[inset_1px_0_0_var(--border)]"

  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
      <Table containerClassName="overflow-auto thin-scrollbar">
        {/* Override TableHeader's default `sticky top-0`: in this matrix the
            page toolbar above already stays pinned, so a sticky thead would
            just collide with it. Letting the header scroll away with the
            rows is the calmer behaviour the admin asked for. */}
        <TableHeader className="!static">
          <TableRow className="hover:bg-transparent">
            <TableHead
              rowSpan={2}
              className={cn(
                "min-w-[18rem] border-r border-b px-3 align-middle text-xs",
                "sticky left-0 z-30",
                stickyBg,
                stickyShadowLeft,
              )}
            >
              Student
            </TableHead>
            {optionGroups.map((g) => (
              <TableHead
                key={g.option.option_id}
                colSpan={g.span}
                className={cn(
                  "border-l-2 border-b text-center text-xs",
                  g.isEmpty
                    ? "border-l-destructive/40 text-destructive/80"
                    : "border-l-border",
                )}
                title={g.option.subject_name}
              >
                <div className="space-y-0.5 px-2 py-1.5">
                  <div className="font-mono text-[12px] font-semibold tracking-tight text-foreground">
                    {g.option.subject_code}
                  </div>
                  <div className="truncate text-[10px] font-normal leading-tight text-muted-foreground">
                    {g.option.subject_name}
                  </div>
                </div>
              </TableHead>
            ))}
            <TableHead
              rowSpan={2}
              className={cn(
                "min-w-[6.5rem] border-l-2 border-b text-center align-middle text-xs",
                "sticky right-0 z-30",
                stickyBg,
                stickyShadowRight,
              )}
            >
              Unassigned
            </TableHead>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            {optionGroups.map((g) =>
              g.isEmpty ? (
                <TableHead
                  key={`fac-empty-${g.option.option_id}`}
                  className="border-l-2 border-l-destructive/40 border-b text-center text-[10px] font-normal text-destructive/80"
                >
                  No faculty
                </TableHead>
              ) : (
                g.option.faculty.map((f, idx) => {
                  const c =
                    cellCounts.get(`${g.option.option_id}:${f.employee_id}`) ??
                    0
                  return (
                    <TableHead
                      key={`fac-${g.option.option_id}-${f.employee_id}`}
                      className={cn(
                        "min-w-[8rem] border-b text-center text-[10px] font-normal",
                        idx === 0 && "border-l-2 border-l-border",
                      )}
                      title={f.emp_display_name}
                    >
                      <div className="space-y-0.5 px-1.5 py-1.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {f.emp_code}
                          </span>
                          {c > 0 && (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary tabular-nums">
                              {c}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] leading-tight text-muted-foreground">
                          {f.emp_display_name}
                        </div>
                      </div>
                    </TableHead>
                  )
                })
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s, rowIdx) => {
            const pick = pickFor(s.student_id)
            const err = rowErrors.get(s.student_code.toUpperCase())
            const zebra = rowIdx % 2 === 1
            // Sticky cell bg MUST be 100% opaque (no /N alpha) so the
            // candidate columns can't show through it on horizontal scroll.
            // Error rows tint the body cells but keep the sticky cell solid
            // and flag the error with a red left border + red text.
            const stickyCellBg = zebra ? "bg-muted" : "bg-card"
            const bodyRowBg = err
              ? "bg-destructive/10"
              : zebra
                ? "bg-muted"
                : "bg-card"
            return (
              <TableRow
                key={s.student_id}
                className={cn("group/row border-0", bodyRowBg)}
                title={err}
              >
                <TableCell
                  className={cn(
                    "sticky left-0 z-20 border-r border-b px-3 py-2 align-middle",
                    stickyCellBg,
                    err && "border-l-2 border-l-destructive",
                    stickyShadowLeft,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-input bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium">
                      {s.student_code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {s.display_name}
                    </span>
                    <PickIndicator pick={pick} options={options} />
                  </div>
                  {err && (
                    <div className="mt-0.5 text-[10px] leading-tight text-destructive">
                      {err}
                    </div>
                  )}
                </TableCell>
                {optionGroups.map((g) =>
                  g.isEmpty ? (
                    <TableCell
                      key={`empty-${g.option.option_id}`}
                      className="border-l-2 border-l-destructive/40 border-b text-center text-muted-foreground/40"
                      title="No faculty allocated — can't enroll"
                    >
                      —
                    </TableCell>
                  ) : (
                    g.option.faculty.map((f, fi) => {
                      const selected =
                        pick !== null &&
                        pick.option_id === g.option.option_id &&
                        pick.employee_id === f.employee_id
                      const next: Pick = selected
                        ? null
                        : {
                            option_id: g.option.option_id,
                            employee_id: f.employee_id,
                          }
                      return (
                        <TableCell
                          key={`${g.option.option_id}-${f.employee_id}`}
                          className={cn(
                            "border-b p-1.5 text-center align-middle",
                            fi === 0 && "border-l-2 border-l-border",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => togglePick(s.student_id, next)}
                            aria-pressed={selected}
                            aria-label={`${selected ? "Unassign" : "Assign"} ${s.display_name} to ${g.option.subject_code} / ${f.emp_code}`}
                            className={cn(
                              "mx-auto flex h-7 w-full max-w-[6rem] items-center justify-center rounded-md border text-[11px] font-medium transition-all",
                              selected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-input/60 bg-background/50 text-muted-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
                            )}
                          >
                            {selected ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" />
                                <span>Picked</span>
                              </span>
                            ) : (
                              <span className="text-[11px]">Pick</span>
                            )}
                          </button>
                        </TableCell>
                      )
                    })
                  ),
                )}
                <TableCell
                  className={cn(
                    "sticky right-0 z-20 border-l-2 border-l-border border-b p-1.5 text-center align-middle",
                    stickyCellBg,
                    stickyShadowRight,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => togglePick(s.student_id, null)}
                    aria-pressed={pick === null}
                    aria-label={`Unassign ${s.display_name}`}
                    className={cn(
                      "mx-auto flex h-7 w-full max-w-[5rem] items-center justify-center rounded-md border text-[11px] font-medium transition-all",
                      pick === null
                        ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                        : "border-input/60 bg-background/50 text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    {pick === null ? (
                      <span>None</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <X className="size-3" />
                        <span>Clear</span>
                      </span>
                    )}
                  </button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Small "currently picked" badge shown in the sticky Student column. Lets
// the admin see each student's pick without scanning across the matrix.
// Native `title` attribute provides the full subject + faculty on hover.
function PickIndicator({
  pick,
  options,
}: {
  pick: Pick
  options: SlotEnrollmentOptionView[]
}) {
  if (pick === null) {
    return (
      <span
        className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70"
        title="No pick yet"
      >
        —
      </span>
    )
  }
  const opt = options.find((o) => o.option_id === pick.option_id)
  const fac = opt?.faculty.find((f) => f.employee_id === pick.employee_id)
  const codeLabel = opt?.subject_code ?? `#${pick.option_id}`
  const facLabel = fac?.emp_code ?? `#${pick.employee_id}`
  const tooltip = [
    opt?.subject_name ? `${codeLabel} — ${opt.subject_name}` : codeLabel,
    fac?.emp_display_name ? `Faculty: ${facLabel} (${fac.emp_display_name})` : `Faculty: ${facLabel}`,
  ].join("\n")
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
      title={tooltip}
    >
      <CheckCircle2 className="size-3" />
      <span className="font-mono">{codeLabel}</span>
    </span>
  )
}

function EnrollmentsSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border bg-card px-5 py-3 shadow-xs">
        <Skeleton className="h-5 w-24 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
    </>
  )
}
