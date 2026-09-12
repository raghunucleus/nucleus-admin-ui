import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  Award,
  Briefcase,
  ClipboardList,
  Copy,
  ExternalLink,
  GraduationCap,
  IdCard,
  Link2,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  School,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { Detail, StatusBadge } from "@/components/detail-item"
import { LoginSecurityCard } from "@/components/login-security-card"
import { PageHeader } from "@/components/page-header"
import {
  SignedInDevicesCard,
  type SignedInDevicesResult,
} from "@/components/signed-in-devices-card"
import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  listCountries,
  listDistricts,
  listStates,
  type State,
} from "@/lib/address-attributes"
import { listDiplomaBoards } from "@/lib/diploma-boards"
import { listEntranceExams } from "@/lib/entrance-exams"
import { listIndustryCertifications } from "@/lib/industry-certifications"
import { listSchoolBoardsX } from "@/lib/school-boards-x"
import { listSchoolBoardsXii } from "@/lib/school-boards-xii"
import {
  ENTRY_TYPE_LABELS,
  GENDER_LABELS,
  addStudentCertification,
  clearStudentResumeExternalUrl,
  getStudent,
  listStudentCertifications,
  removeStudentCertification,
  resetStudentLoginPassword,
  setStudentLoginPassword,
  setStudentResumeExternalUrl,
  updateStudent,
  type Student,
  type StudentCertification,
  type UpdateStudentInput,
} from "@/lib/students"
import {
  GUARDIAN_RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  createGuardian,
  getGuardiansByStudent,
  removeGuardian,
  updateGuardian,
  type GuardianRelationship,
  type StudentGuardianRow,
} from "@/lib/guardians"
import { listStudentSessions, revokeStudentSession } from "@/lib/sessions"

const MOBILE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const AADHAAR_REGEX = /^\d{12}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const PINCODE_REGEX = /^\d{6}$/
const CURRENT_YEAR = new Date().getFullYear()

// Sections of the student detail screen. New areas (parent details, academic
// records, …) slot in here without touching the page shell.
const SECTIONS = [
  { key: "overview", label: "Overview", icon: UserRound },
  { key: "login", label: "Login & security", icon: ShieldCheck },
  { key: "parent", label: "Parent details", icon: Users },
  { key: "personal", label: "Personal", icon: IdCard },
  { key: "academic", label: "Academic", icon: GraduationCap },
  { key: "certifications", label: "Certifications", icon: Award },
  { key: "address", label: "Address", icon: MapPin },
  { key: "entrance", label: "Entrance & gap", icon: ClipboardList },
  { key: "education", label: "Education history", icon: School },
  { key: "placements", label: "Placements", icon: Briefcase },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

export function StudentDetailsPage() {
  const params = useParams({ strict: false }) as { studentId?: string }
  const id = Number(params.studentId)

  const [student, setStudent] = React.useState<Student | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [section, setSection] = React.useState<SectionKey>("overview")

  const load = React.useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setLoading(false)
      setFailed(true)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const result = await getStudent(id)
      setStudent(result)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  // Silent refetch after a section saves — the PATCH response omits the loaded
  // relations (board/state names, resume_url) and server-recomputed fields, so
  // re-pull the full detail without flashing the skeleton.
  const refresh = React.useCallback(async () => {
    try {
      setStudent(await getStudent(id))
    } catch {
      /* keep showing the last good copy */
    }
  }, [id])

  // Stable per student id — the devices card re-fetches when these change.
  const loadSessions = React.useCallback(
    async (): Promise<SignedInDevicesResult> => ({
      sessions: await listStudentSessions(id),
    }),
    [id],
  )
  const revokeSession = React.useCallback(
    (sessionId: string) => revokeStudentSession(id, sessionId),
    [id],
  )

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to students">
          <Link to="/students/all" />
        </BackLink>
      }
      title={student?.display_name ?? "Student"}
    />
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      {header}

      {loading ? (
        <StudentDetailsSkeleton />
      ) : failed || !student ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load student"
            description="The student record could not be found or the server is unreachable."
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void load()}>
                  Try again
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/students/all">Back to students</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{student.student_id}</span>
            <StatusBadge active={student.is_active} />
          </div>

          <div className="flex flex-wrap gap-1 border-b">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const active = section === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={cn(
                    "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {s.label}
                </button>
              )
            })}
          </div>

          {section === "overview" && <OverviewSection student={student} />}
          {section === "login" && (
            <div className="space-y-4">
              <LoginSecurityCard
                subject={{
                  type: "student",
                  id: student.id,
                  displayName: student.display_name,
                  code: student.student_id,
                  email: student.email,
                }}
                setPassword={setStudentLoginPassword}
                resetPassword={resetStudentLoginPassword}
              />
              <SignedInDevicesCard
                load={loadSessions}
                revoke={revokeSession}
                noun="student"
                subjectName={student.display_name}
              />
            </div>
          )}
          {section === "parent" && (
            <ParentDetailsSection student={student} onSaved={refresh} />
          )}
          {section === "personal" && (
            <PersonalSection student={student} onSaved={refresh} />
          )}
          {section === "academic" && (
            <AcademicSection student={student} onSaved={refresh} />
          )}
          {section === "certifications" && (
            <CertificationsSection student={student} />
          )}
          {section === "address" && (
            <AddressSection student={student} onSaved={refresh} />
          )}
          {section === "entrance" && (
            <EntranceGapSection student={student} onSaved={refresh} />
          )}
          {section === "education" && (
            <EducationHistorySection student={student} onSaved={refresh} />
          )}
          {section === "placements" && (
            <PlacementsSection student={student} onSaved={refresh} />
          )}
        </>
      )}
    </div>
  )
}

function OverviewSection({ student }: { student: Student }) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="text-sm font-semibold">Student information</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Detail label="Student ID" value={student.student_id} mono />
        <Detail label="Display name" value={student.display_name} />
        <Detail label="Gender" value={GENDER_LABELS[student.gender]} />
        <Detail
          label="Entry type"
          value={ENTRY_TYPE_LABELS[student.entry_type] ?? "—"}
        />
        <Detail label="Date of birth" value={student.dob || "—"} mono />
        <Detail label="Blood group" value={student.blood_group ?? "—"} />
        <Detail label="ABC ID" value={student.abc_id ?? "—"} mono />
        <Detail label="Mobile" value={student.mobile_number} mono />
        <Detail label="Email" value={student.email} />
        <Detail
          label="Programme"
          value={
            student.programme
              ? `${student.programme.name} (${student.programme.code})`
              : "—"
          }
        />
        <Detail
          label="Admission year"
          value={student.admission_year?.display_year ?? "—"}
        />
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Shared bits for the editable profile sections                              */
/* ------------------------------------------------------------------------- */

type SectionProps = {
  student: Student
  onSaved: () => Promise<void> | void
}

/** Drains a paginated master-list endpoint (active rows can exceed one page). */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ rows: T[]; pageCount: number }>,
): Promise<T[]> {
  const first = await fetchPage(1)
  const rows = [...first.rows]
  for (let page = 2; page <= first.pageCount; page++) {
    rows.push(...(await fetchPage(page)).rows)
  }
  return rows
}

/**
 * Ensure the student's current selection is present in a combobox option list
 * — the row may have been deactivated after it was picked, and hiding it would
 * silently clear the field on save.
 */
function withCurrent(
  options: ComboboxOption[],
  current: { id: number; name: string } | null | undefined,
): ComboboxOption[] {
  if (!current) return options
  if (options.some((o) => o.value === current.id)) return options
  return [{ value: current.id, label: current.name, sublabel: "inactive" }, ...options]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** `''` → null; otherwise the trimmed string. */
function normStr(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** `''` → null; otherwise the parsed number (validation runs before this). */
function normNum(v: string): number | null {
  const t = v.trim()
  return t === "" ? null : Number(t)
}

/** Numeric columns serialize as strings — normalize for change detection. */
function prevNum(v: number | string | null): number | null {
  return v === null || v === undefined ? null : Number(v)
}

/**
 * Range check for an optional numeric text input. Returns an error message or
 * null when the (possibly empty) value is acceptable.
 */
function rangeError(
  v: string,
  min: number,
  max: number,
  integer = false,
): string | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return "Enter a number"
  if (integer && !Number.isInteger(n)) return "Enter a whole number"
  if (n < min || n > max) return `Must be between ${min} and ${max}`
  return null
}

function triStateLabel(v: boolean | null): string {
  return v === null ? "Not set" : v ? "Yes" : "No"
}

/** Card shell with a header row and an Edit button (hidden while editing). */
function EditableCard({
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  title: string
  description?: React.ReactNode
  editing: boolean
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={onEdit}
          >
            <Pencil />
            Edit
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EditFooter({
  saving,
  onCancel,
}: {
  saving: boolean
  onCancel: () => void
}) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  )
}

/**
 * Shared PATCH plumbing: skips the request when nothing changed, toasts, closes
 * the edit form and silently refreshes the page-level student.
 */
function useSectionSave(
  student: Student,
  onSaved: () => Promise<void> | void,
  close: () => void,
) {
  const [saving, setSaving] = React.useState(false)

  const save = async (
    patch: UpdateStudentInput,
    onConflict?: (err: ApiError) => void,
  ) => {
    if (Object.keys(patch).length === 0) {
      close()
      return
    }
    setSaving(true)
    try {
      await updateStudent(student.id, patch)
      toast.success("Saved")
      close()
      await onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && onConflict) {
        onConflict(err)
      } else {
        toast.error("Couldn't save", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return { saving, save }
}

function Textarea({
  invalid,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-[5.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-destructive",
        className,
      )}
      {...props}
    />
  )
}

function TriState({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null
  onChange: (v: boolean | null) => void
  disabled?: boolean
}) {
  const options: { v: boolean | null; label: string }[] = [
    { v: true, label: "Yes" },
    { v: false, label: "No" },
    { v: null, label: "Not set" },
  ]
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Personal                                                                   */
/* ------------------------------------------------------------------------- */

function PersonalSection({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Personal"
      description="Name split, personal email and government IDs."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <PersonalForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail label="First name" value={student.first_name ?? "—"} />
          <Detail label="Middle name" value={student.middle_name ?? "—"} />
          <Detail label="Last name" value={student.last_name ?? "—"} />
          <Detail
            label="Personal email"
            value={student.personal_email ?? "—"}
          />
          {student.personal_email_pending && (
            <Detail
              label="Pending email (awaiting student OTP)"
              value={student.personal_email_pending}
            />
          )}
          <Detail
            label="Aadhaar number"
            value={student.aadhaar_number ?? "—"}
            mono
          />
          <Detail label="PAN" value={student.pan_number ?? "—"} mono />
        </dl>
      )}
    </EditableCard>
  )
}

function PersonalForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [firstName, setFirstName] = React.useState(student.first_name ?? "")
  const [middleName, setMiddleName] = React.useState(student.middle_name ?? "")
  const [lastName, setLastName] = React.useState(student.last_name ?? "")
  const [personalEmail, setPersonalEmail] = React.useState(
    student.personal_email ?? "",
  )
  const [aadhaar, setAadhaar] = React.useState(student.aadhaar_number ?? "")
  const [pan, setPan] = React.useState(student.pan_number ?? "")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    for (const [key, value] of [
      ["first_name", firstName],
      ["middle_name", middleName],
      ["last_name", lastName],
    ] as const) {
      if (value.trim().length > 64) e[key] = "Max 64 characters"
    }
    if (personalEmail.trim() && !EMAIL_REGEX.test(personalEmail.trim())) {
      e.personal_email = "Invalid email"
    }
    if (aadhaar.trim() && !AADHAAR_REGEX.test(aadhaar.trim())) {
      e.aadhaar_number = "Aadhaar must be exactly 12 digits"
    }
    const panUp = pan.trim().toUpperCase()
    if (panUp && !PAN_REGEX.test(panUp)) {
      e.pan_number = "Enter a valid PAN (AAAAA9999A)"
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    const fn = normStr(firstName)
    if (fn !== student.first_name) p.first_name = fn
    const mn = normStr(middleName)
    if (mn !== student.middle_name) p.middle_name = mn
    const ln = normStr(lastName)
    if (ln !== student.last_name) p.last_name = ln
    const pe = normStr(personalEmail.toLowerCase())
    if (pe !== student.personal_email) p.personal_email = pe
    const aad = normStr(aadhaar)
    if (aad !== student.aadhaar_number) p.aadhaar_number = aad
    const pn = normStr(panUp)
    if (pn !== student.pan_number) p.pan_number = pn

    await save(p, (err) => {
      // 409 — Aadhaar uniqueness clash.
      setErrors({ aadhaar_number: err.message })
      toast.error("Couldn't save", { description: err.message })
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.first_name}>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field label="Middle name" error={errors.middle_name}>
          <Input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </Field>
        <Field label="Last name" error={errors.last_name}>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        <Field
          label="Personal email"
          error={errors.personal_email}
          hint="Student changes require email OTP verification; admin edits apply directly and cancel any pending OTP."
        >
          <Input
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
            aria-invalid={!!errors.personal_email}
          />
        </Field>
        <Field
          label="Aadhaar number"
          error={errors.aadhaar_number}
          hint="12 digits. Must be unique across students."
        >
          <Input
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value)}
            inputMode="numeric"
            maxLength={12}
            aria-invalid={!!errors.aadhaar_number}
          />
        </Field>
        <Field
          label="PAN"
          error={errors.pan_number}
          hint="Format AAAAA9999A. Stored uppercased."
        >
          <Input
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            maxLength={10}
            className="font-mono uppercase"
            aria-invalid={!!errors.pan_number}
          />
        </Field>
      </div>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

/* ------------------------------------------------------------------------- */
/* Academic (record + resume)                                                 */
/* ------------------------------------------------------------------------- */

function AcademicSection({ student, onSaved }: SectionProps) {
  return (
    <div className="space-y-4">
      <AcademicRecordCard student={student} onSaved={onSaved} />
      <ResumeCard student={student} onSaved={onSaved} />
    </div>
  )
}

function AcademicRecordCard({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  const pct = (v: string | null) => (v === null ? "—" : `${v}%`)
  return (
    <EditableCard
      title="Academic record"
      description="Qualifying percentages, current UG standing and pass-out year."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <AcademicRecordForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail label="10th percentage" value={pct(student.tenth_percentage)} />
          <Detail
            label="12th percentage"
            value={pct(student.twelfth_percentage)}
          />
          <Detail
            label="Diploma percentage"
            value={pct(student.diploma_percentage)}
          />
          <Detail label="UG CGPA" value={student.ug_cgpa ?? "—"} />
          <Detail
            label="Current backlogs"
            value={
              student.current_backlogs === null
                ? "—"
                : String(student.current_backlogs)
            }
          />
          <Detail
            label="Backlog history"
            value={student.backlog_history ? "Yes" : "No"}
          />
          <Detail
            label="Pass-out year"
            value={
              student.pass_out_year === null
                ? "—"
                : String(student.pass_out_year)
            }
            mono
          />
        </dl>
      )}
    </EditableCard>
  )
}

function AcademicRecordForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [tenth, setTenth] = React.useState(student.tenth_percentage ?? "")
  const [twelfth, setTwelfth] = React.useState(student.twelfth_percentage ?? "")
  const [diploma, setDiploma] = React.useState(student.diploma_percentage ?? "")
  const [cgpa, setCgpa] = React.useState(student.ug_cgpa ?? "")
  const [backlogs, setBacklogs] = React.useState(
    student.current_backlogs === null ? "" : String(student.current_backlogs),
  )
  const [backlogHistory, setBacklogHistory] = React.useState(
    student.backlog_history,
  )
  const [passOutYear, setPassOutYear] = React.useState(
    student.pass_out_year === null ? "" : String(student.pass_out_year),
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    const checks: [string, string | null][] = [
      ["tenth_percentage", rangeError(tenth, 0, 100)],
      ["twelfth_percentage", rangeError(twelfth, 0, 100)],
      ["diploma_percentage", rangeError(diploma, 0, 100)],
      ["ug_cgpa", rangeError(cgpa, 0, 10)],
      ["current_backlogs", rangeError(backlogs, 0, 60, true)],
      ["pass_out_year", rangeError(passOutYear, 1950, 2100, true)],
    ]
    for (const [key, msg] of checks) if (msg) e[key] = msg
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    const t = normNum(tenth)
    if (t !== prevNum(student.tenth_percentage)) p.tenth_percentage = t
    const tw = normNum(twelfth)
    if (tw !== prevNum(student.twelfth_percentage)) p.twelfth_percentage = tw
    const d = normNum(diploma)
    if (d !== prevNum(student.diploma_percentage)) p.diploma_percentage = d
    const c = normNum(cgpa)
    if (c !== prevNum(student.ug_cgpa)) p.ug_cgpa = c
    const b = normNum(backlogs)
    if (b !== student.current_backlogs) p.current_backlogs = b
    if (backlogHistory !== student.backlog_history)
      p.backlog_history = backlogHistory
    const poy = normNum(passOutYear)
    if (poy !== student.pass_out_year) p.pass_out_year = poy

    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="10th percentage" error={errors.tenth_percentage}>
          <Input
            value={tenth}
            onChange={(e) => setTenth(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="12th percentage" error={errors.twelfth_percentage}>
          <Input
            value={twelfth}
            onChange={(e) => setTwelfth(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="Diploma percentage" error={errors.diploma_percentage}>
          <Input
            value={diploma}
            onChange={(e) => setDiploma(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field
          label="UG CGPA"
          error={errors.ug_cgpa}
          hint="Auto-synced from posted marks; manual edits are overwritten by the next marks upload."
        >
          <Input
            value={cgpa}
            onChange={(e) => setCgpa(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field
          label="Current backlogs"
          error={errors.current_backlogs}
          hint="Auto-synced from posted marks; manual edits are overwritten by the next marks upload."
        >
          <Input
            value={backlogs}
            onChange={(e) => setBacklogs(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <Field
          label="Pass-out year"
          error={errors.pass_out_year}
          hint="Auto-computed as admission year + degree duration; recomputed when the programme or admission year changes unless set explicitly."
        >
          <Input
            value={passOutYear}
            onChange={(e) => setPassOutYear(e.target.value)}
            inputMode="numeric"
          />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-2.5 rounded-md border bg-muted/30 p-3">
        <input
          type="checkbox"
          checked={backlogHistory}
          onChange={(e) => setBacklogHistory(e.target.checked)}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Backlog history</span>
          <span className="block text-xs text-muted-foreground">
            The student has had a backlog at some point. Auto-synced from
            posted marks; manual edits are overwritten by the next marks
            upload.
          </span>
        </span>
      </label>

      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

const RESUME_EXTERNAL_URL_MAX = 512

function resumeExternalUrlError(value: string): string | null {
  if (!/^https:\/\//i.test(value)) return "Must be an https:// link."
  if (value.length > RESUME_EXTERNAL_URL_MAX)
    return `Must be at most ${RESUME_EXTERNAL_URL_MAX} characters.`
  try {
    new URL(value)
  } catch {
    return "Enter a valid URL."
  }
  return null
}

async function copyLink(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Link copied")
  } catch {
    toast.error("Couldn't copy the link.")
  }
}

function ResumeCard({ student, onSaved }: SectionProps) {
  // Link editor. `editingExternal` distinguishes "editing the saved link"
  // (shows Cancel) from "no link yet" (bare input).
  const [editingExternal, setEditingExternal] = React.useState(false)
  const [externalDraft, setExternalDraft] = React.useState("")
  const [externalError, setExternalError] = React.useState<string | null>(null)
  const [externalBusy, setExternalBusy] = React.useState(false)

  const externalUrl = student.resume_external_url

  const saveExternal = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const value = externalDraft.trim()
    const error = resumeExternalUrlError(value)
    setExternalError(error)
    if (error) return
    setExternalBusy(true)
    try {
      await setStudentResumeExternalUrl(student.id, value)
      toast.success("Resume link saved")
      setEditingExternal(false)
      setExternalDraft("")
      await onSaved()
    } catch (err) {
      toast.error("Couldn't save the link", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setExternalBusy(false)
    }
  }

  const clearExternal = async () => {
    setExternalBusy(true)
    try {
      await clearStudentResumeExternalUrl(student.id)
      toast.success("Resume link cleared")
      await onSaved()
    } catch (err) {
      toast.error("Couldn't clear the link", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setExternalBusy(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Resume</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A link the student hosts elsewhere (Drive, portfolio…). Recruiters
          open it directly — Nucleus does not host resume files.
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div className="space-y-3">
          {externalUrl && !editingExternal ? (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Link2 className="size-5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-mono text-xs">
                  {externalUrl}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copyLink(externalUrl)}
                >
                  <Copy />
                  Copy
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={externalBusy}
                  onClick={() => {
                    setExternalDraft(externalUrl)
                    setExternalError(null)
                    setEditingExternal(true)
                  }}
                >
                  <Pencil />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={externalBusy}
                  onClick={() => void clearExternal()}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                  {externalBusy ? "Clearing…" : "Clear"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={(ev) => void saveExternal(ev)} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={externalDraft}
                  onChange={(e) => {
                    setExternalDraft(e.target.value)
                    if (externalError) setExternalError(null)
                  }}
                  maxLength={RESUME_EXTERNAL_URL_MAX}
                  aria-invalid={!!externalError}
                  className="sm:flex-1"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="submit" size="sm" disabled={externalBusy}>
                    {externalBusy ? "Saving…" : "Save link"}
                  </Button>
                  {editingExternal && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={externalBusy}
                      onClick={() => {
                        setEditingExternal(false)
                        setExternalDraft("")
                        setExternalError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              <p
                className={cn(
                  "text-xs",
                  externalError ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {externalError ??
                  "https:// links only — e.g. a Drive or portfolio link. It must stay publicly viewable for recruiters to open it."}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Certifications                                                             */
/* ------------------------------------------------------------------------- */

function CertificationsSection({ student }: { student: Student }) {
  const [rows, setRows] = React.useState<StudentCertification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] =
    React.useState<StudentCertification | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Bumped to refetch (retry, after delete). `loading` starts true and only
  // event handlers flip it back on, keeping the effect free of sync setState.
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listStudentCertifications(student.id)
        if (!cancelled) {
          setRows(list)
          setFailed(false)
        }
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student.id, reloadKey])

  const retry = () => {
    setLoading(true)
    setFailed(false)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Industry certifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Certifications the student holds, each with its supporting
            certificate file.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => setAddOpen(true)}
          disabled={loading || failed}
        >
          <Plus />
          Add certification
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState
          icon={Award}
          title="Couldn't load certifications"
          description="There was a problem reaching the server."
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certifications yet"
          description="Add an industry certification along with its certificate file."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus />
              Add certification
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5">Certification</th>
                <th className="px-5 py-2.5">Uploaded</th>
                <th className="px-5 py-2.5">Certificate</th>
                <th className="w-12 px-5 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    {r.certificate_file_url ? (
                      <a
                        href={r.certificate_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        View file
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(r)}
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddCertificationSheet
          student={student}
          heldIds={new Set(rows.map((r) => r.industry_certification_id))}
          onClose={() => setAddOpen(false)}
          onAdded={(list) => {
            setRows(list)
            setAddOpen(false)
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        title="Delete certification?"
        tone="destructive"
        description={
          deleteTarget ? (
            <>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.name}
              </span>{" "}
              for {student.display_name} and deletes the certificate file.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeleting(true)
          try {
            await removeStudentCertification(student.id, deleteTarget.id)
            toast.success("Certification deleted")
            setDeleteTarget(null)
            setReloadKey((k) => k + 1)
          } catch (err) {
            toast.error("Couldn't delete certification", {
              description:
                err instanceof ApiError ? err.message : "Please try again.",
            })
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}

const CERTIFICATE_MAX_BYTES = 5 * 1024 * 1024
const CERTIFICATE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
])

function AddCertificationSheet({
  student,
  heldIds,
  onClose,
  onAdded,
}: {
  student: Student
  heldIds: Set<number>
  onClose: () => void
  onAdded: (rows: StudentCertification[]) => void
}) {
  const [options, setOptions] = React.useState<ComboboxOption[]>([])
  const [optionsLoading, setOptionsLoading] = React.useState(true)
  const [certificationId, setCertificationId] = React.useState<number | null>(
    null,
  )
  const [file, setFile] = React.useState<File | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllPages((page) =>
          listIndustryCertifications({
            page,
            pageSize: 100,
            status: "active",
            sortBy: "name",
            sortOrder: "asc",
          }),
        )
        if (!cancelled) {
          setOptions(
            rows
              .filter((r) => !heldIds.has(r.id))
              .map((r) => ({ value: r.id, label: r.name, sublabel: r.code })),
          )
        }
      } catch {
        if (!cancelled) toast.error("Couldn't load certifications list")
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // heldIds is stable for the lifetime of the sheet (built when it opens).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (certificationId === null) e.certification = "Pick a certification"
    if (!file) {
      e.file = "Attach the certificate file"
    } else if (!CERTIFICATE_MIME_TYPES.has(file.type)) {
      e.file = "Use PDF, JPEG, or PNG"
    } else if (file.size > CERTIFICATE_MAX_BYTES) {
      e.file = "File must be 5 MB or smaller"
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)
    try {
      const rows = await addStudentCertification(
        student.id,
        certificationId!,
        file!,
      )
      toast.success("Certification added")
      onAdded(rows)
    } catch (err) {
      toast.error("Couldn't add certification", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add certification</SheetTitle>
          <SheetDescription>
            For {student.student_id} · {student.display_name}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit}>
          <SheetBody className="space-y-4">
            <Field label="Certification" error={errors.certification} required>
              <Combobox
                id="cert-pick"
                value={certificationId}
                options={options}
                onChange={setCertificationId}
                placeholder={
                  optionsLoading ? "Loading…" : "Select a certification"
                }
                searchPlaceholder="Search certifications…"
                emptyMessage={
                  optionsLoading
                    ? "Loading…"
                    : "No certifications available to add"
                }
                disabled={optionsLoading}
                invalid={!!errors.certification}
              />
            </Field>

            <Field
              label="Certificate file"
              error={errors.file}
              required
              hint="PDF, JPEG, or PNG — 5 MB max."
            >
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={cn(
                  "block w-full cursor-pointer rounded-md border border-input bg-background text-sm text-muted-foreground shadow-xs outline-none transition",
                  "file:mr-3 file:cursor-pointer file:rounded-l-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring/60",
                  errors.file && "border-destructive",
                )}
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------- */
/* Address                                                                    */
/* ------------------------------------------------------------------------- */

function AddressSection({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Home address"
      description="Permanent address on record, down to the district."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <AddressForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Detail label="Address" value={student.home_address ?? "—"} />
          </div>
          <Detail
            label="Country"
            value={student.home_country?.name ?? "—"}
          />
          <Detail label="State" value={student.home_state?.name ?? "—"} />
          <Detail
            label="District"
            value={student.home_district?.name ?? "—"}
          />
          <Detail label="Pincode" value={student.home_pincode ?? "—"} mono />
        </dl>
      )}
    </EditableCard>
  )
}

function AddressForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [address, setAddress] = React.useState(student.home_address ?? "")
  const [countryId, setCountryId] = React.useState<number | null>(
    student.home_country_id,
  )
  const [stateId, setStateId] = React.useState<number | null>(
    student.home_state_id,
  )
  const [districtId, setDistrictId] = React.useState<number | null>(
    student.home_district_id,
  )
  const [pincode, setPincode] = React.useState(student.home_pincode ?? "")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const [countries, setCountries] = React.useState<ComboboxOption[]>([])
  // Keyed by the parent id they were fetched for, so switching the parent
  // never offers a stale child list while the refetch is in flight.
  const [statesFor, setStatesFor] = React.useState<{
    countryId: number
    options: ComboboxOption[]
  } | null>(null)
  const [districtsFor, setDistrictsFor] = React.useState<{
    stateId: number
    options: ComboboxOption[]
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllPages((page) =>
          listCountries({
            page,
            pageSize: 100,
            status: "active",
            sortBy: "name",
            sortOrder: "asc",
          }),
        )
        if (!cancelled)
          setCountries(rows.map((r) => ({ value: r.id, label: r.name })))
      } catch {
        if (!cancelled) toast.error("Couldn't load countries")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (countryId === null) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllPages((page) =>
          listStates({
            page,
            pageSize: 100,
            countryId,
            effectiveActive: true,
            sortBy: "name",
            sortOrder: "asc",
          }),
        )
        if (!cancelled)
          setStatesFor({
            countryId,
            options: rows.map((r) => ({ value: r.id, label: r.name })),
          })
      } catch {
        if (!cancelled) toast.error("Couldn't load states")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [countryId])

  React.useEffect(() => {
    if (stateId === null) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllPages((page) =>
          listDistricts({
            page,
            pageSize: 100,
            stateId,
            effectiveActive: true,
            sortBy: "name",
            sortOrder: "asc",
          }),
        )
        if (!cancelled)
          setDistrictsFor({
            stateId,
            options: rows.map((r) => ({ value: r.id, label: r.name })),
          })
      } catch {
        if (!cancelled) toast.error("Couldn't load districts")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stateId])

  const states =
    countryId !== null && statesFor?.countryId === countryId
      ? statesFor.options
      : []
  const districts =
    stateId !== null && districtsFor?.stateId === stateId
      ? districtsFor.options
      : []

  // Keep a deactivated current selection pickable — but only while the parent
  // level still matches the student's stored chain.
  const countryOptions = withCurrent(countries, student.home_country)
  const stateOptions =
    countryId === student.home_country_id
      ? withCurrent(states, student.home_state)
      : states
  const districtOptions =
    stateId === student.home_state_id
      ? withCurrent(districts, student.home_district)
      : districts

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (address.trim().length > 1000) e.home_address = "Max 1000 characters"
    if (pincode.trim() && !PINCODE_REGEX.test(pincode.trim())) {
      e.home_pincode = "Pincode must be exactly 6 digits"
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    const a = normStr(address)
    if (a !== student.home_address) p.home_address = a
    if (countryId !== student.home_country_id) p.home_country_id = countryId
    if (stateId !== student.home_state_id) p.home_state_id = stateId
    if (districtId !== student.home_district_id)
      p.home_district_id = districtId
    const pin = normStr(pincode)
    if (pin !== student.home_pincode) p.home_pincode = pin

    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <Field label="Address" error={errors.home_address}>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            invalid={!!errors.home_address}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Combobox
              id="home-country"
              value={countryId}
              options={countryOptions}
              onChange={(v) => {
                setCountryId(v)
                setStateId(null)
                setDistrictId(null)
              }}
              placeholder="Select country"
              searchPlaceholder="Search countries…"
              clearLabel="No country"
            />
          </Field>
          <Field label="State">
            <Combobox
              id="home-state"
              value={stateId}
              options={stateOptions}
              onChange={(v) => {
                setStateId(v)
                setDistrictId(null)
              }}
              placeholder={
                countryId === null ? "Pick a country first" : "Select state"
              }
              searchPlaceholder="Search states…"
              clearLabel="No state"
              disabled={countryId === null}
            />
          </Field>
          <Field label="District">
            <Combobox
              id="home-district"
              value={districtId}
              options={districtOptions}
              onChange={setDistrictId}
              placeholder={
                stateId === null ? "Pick a state first" : "Select district"
              }
              searchPlaceholder="Search districts…"
              clearLabel="No district"
              disabled={stateId === null}
            />
          </Field>
          <Field label="Pincode" error={errors.home_pincode}>
            <Input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              aria-invalid={!!errors.home_pincode}
            />
          </Field>
        </div>
      </div>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

/* ------------------------------------------------------------------------- */
/* Entrance & gap                                                             */
/* ------------------------------------------------------------------------- */

function EntranceGapSection({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Entrance exam & gap"
      description="How the student qualified, and any gap years before joining."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <EntranceGapForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail
            label="Entrance exam"
            value={
              student.entrance_exam_na
                ? "Not applicable"
                : (student.entrance_exam?.name ?? "—")
            }
          />
          <Detail
            label="Rank"
            value={
              student.entrance_exam_na
                ? "Not applicable"
                : student.entrance_exam_rank === null
                  ? "—"
                  : String(student.entrance_exam_rank)
            }
            mono
          />
          <Detail
            label="Exam year"
            value={
              student.entrance_exam_na
                ? "Not applicable"
                : student.entrance_exam_year === null
                  ? "—"
                  : String(student.entrance_exam_year)
            }
            mono
          />
          <Detail
            label="Years of gap"
            value={
              student.year_of_gap === null ? "—" : String(student.year_of_gap)
            }
          />
          <div className="sm:col-span-2">
            <Detail
              label="Reason for gap"
              value={student.reason_of_gap ?? "—"}
            />
          </div>
        </dl>
      )}
    </EditableCard>
  )
}

function EntranceGapForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [na, setNa] = React.useState(student.entrance_exam_na)
  const [examId, setExamId] = React.useState<number | null>(
    student.entrance_exam_id,
  )
  const [rank, setRank] = React.useState(
    student.entrance_exam_rank === null
      ? ""
      : String(student.entrance_exam_rank),
  )
  const [year, setYear] = React.useState(
    student.entrance_exam_year === null
      ? ""
      : String(student.entrance_exam_year),
  )
  const [gapYears, setGapYears] = React.useState(
    student.year_of_gap === null ? "" : String(student.year_of_gap),
  )
  const [gapReason, setGapReason] = React.useState(student.reason_of_gap ?? "")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const [exams, setExams] = React.useState<ComboboxOption[]>([])
  const [examsLoading, setExamsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllPages((page) =>
          listEntranceExams({
            page,
            pageSize: 100,
            status: "active",
            sortBy: "name",
            sortOrder: "asc",
          }),
        )
        if (!cancelled)
          setExams(
            rows.map((r) => ({ value: r.id, label: r.name, sublabel: r.code })),
          )
      } catch {
        if (!cancelled) toast.error("Couldn't load entrance exams")
      } finally {
        if (!cancelled) setExamsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const gapIsZero = gapYears.trim() === "" || Number(gapYears.trim()) === 0

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (!na) {
      const rankErr = rangeError(rank, 1, Number.MAX_SAFE_INTEGER, true)
      if (rankErr) e.entrance_exam_rank = "Enter a positive whole number"
      const yearErr = rangeError(year, 1950, CURRENT_YEAR, true)
      if (yearErr) e.entrance_exam_year = yearErr
    }
    const gapErr = rangeError(gapYears, 0, 10, true)
    if (gapErr) e.year_of_gap = gapErr
    if (!gapIsZero && gapReason.trim().length > 1000)
      e.reason_of_gap = "Max 1000 characters"
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    if (na !== student.entrance_exam_na) p.entrance_exam_na = na
    if (!na) {
      // na=true must travel alone — the server clears the trio itself and
      // rejects a patch that sets the flag alongside exam/rank/year.
      if (examId !== student.entrance_exam_id) p.entrance_exam_id = examId
      const r = normNum(rank)
      if (r !== student.entrance_exam_rank) p.entrance_exam_rank = r
      const y = normNum(year)
      if (y !== student.entrance_exam_year) p.entrance_exam_year = y
    }
    const g = normNum(gapYears)
    if (g !== student.year_of_gap) p.year_of_gap = g
    if (!gapIsZero) {
      // With gap 0/empty the server clears the reason itself.
      const reason = normStr(gapReason)
      if (reason !== student.reason_of_gap) p.reason_of_gap = reason
    }

    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <label className="flex items-start gap-2.5 rounded-md border bg-muted/30 p-3">
          <input
            type="checkbox"
            checked={na}
            onChange={(e) => {
              setNa(e.target.checked)
              if (e.target.checked) {
                setExamId(null)
                setRank("")
                setYear("")
              }
            }}
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Entrance exam not applicable
            </span>
            <span className="block text-xs text-muted-foreground">
              The student did not qualify through an entrance exam. Saving
              this clears the exam, rank and year.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Entrance exam">
            <Combobox
              id="entrance-exam"
              value={examId}
              options={withCurrent(exams, student.entrance_exam)}
              onChange={setExamId}
              placeholder={examsLoading ? "Loading…" : "Select exam"}
              searchPlaceholder="Search exams…"
              clearLabel="No exam"
              disabled={na || examsLoading}
            />
          </Field>
          <Field label="Rank" error={errors.entrance_exam_rank}>
            <Input
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              inputMode="numeric"
              disabled={na}
              aria-invalid={!!errors.entrance_exam_rank}
            />
          </Field>
          <Field label="Exam year" error={errors.entrance_exam_year}>
            <Input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              disabled={na}
              aria-invalid={!!errors.entrance_exam_year}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Years of gap"
            error={errors.year_of_gap}
            hint="0 to 10. Setting 0 clears the reason."
          >
            <Input
              value={gapYears}
              onChange={(e) => setGapYears(e.target.value)}
              inputMode="numeric"
              aria-invalid={!!errors.year_of_gap}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reason for gap" error={errors.reason_of_gap}>
              <Textarea
                value={gapReason}
                onChange={(e) => setGapReason(e.target.value)}
                rows={2}
                className="min-h-9"
                disabled={gapIsZero}
                invalid={!!errors.reason_of_gap}
              />
            </Field>
          </div>
        </div>
      </div>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

/* ------------------------------------------------------------------------- */
/* Education history                                                          */
/* ------------------------------------------------------------------------- */

function ApplicabilityPill({
  applies,
  label,
}: {
  applies: boolean
  label: string
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        applies
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function EducationBlockHeader({
  title,
  student,
  block,
}: {
  title: string
  student: Student
  block: "tenth" | "twelfth" | "diploma"
}) {
  const isRegular = student.entry_type === 1
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {block === "twelfth" && (
        <ApplicabilityPill
          applies={isRegular}
          label={
            isRegular
              ? "Applies · regular entry"
              : "Usually N/A · lateral entry"
          }
        />
      )}
      {block === "diploma" && (
        <ApplicabilityPill
          applies={!isRegular}
          label={
            !isRegular
              ? "Applies · lateral entry"
              : "Usually N/A · regular entry"
          }
        />
      )}
    </div>
  )
}

function EducationHistorySection({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Education history"
      description="Schooling before this programme. 12th applies to regular entrants, diploma to lateral entrants — admins can edit all three."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <EducationHistoryForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            <EducationBlockHeader
              title="10th (SSC)"
              student={student}
              block="tenth"
            />
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Board" value={student.tenth_board?.name ?? "—"} />
              <Detail
                label="Institution"
                value={student.tenth_institution ?? "—"}
              />
              <Detail
                label="Year of pass"
                value={
                  student.tenth_year_of_pass === null
                    ? "—"
                    : String(student.tenth_year_of_pass)
                }
                mono
              />
              <Detail label="State" value={student.tenth_state?.name ?? "—"} />
            </dl>
          </div>
          <div className="space-y-3 border-t pt-5">
            <EducationBlockHeader
              title="12th (Intermediate)"
              student={student}
              block="twelfth"
            />
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail
                label="Board"
                value={student.twelfth_board?.name ?? "—"}
              />
              <Detail
                label="Institution"
                value={student.twelfth_institution ?? "—"}
              />
              <Detail
                label="Year of pass"
                value={
                  student.twelfth_year_of_pass === null
                    ? "—"
                    : String(student.twelfth_year_of_pass)
                }
                mono
              />
              <Detail
                label="State"
                value={student.twelfth_state?.name ?? "—"}
              />
            </dl>
          </div>
          <div className="space-y-3 border-t pt-5">
            <EducationBlockHeader
              title="Diploma"
              student={student}
              block="diploma"
            />
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail
                label="Board"
                value={student.diploma_board?.name ?? "—"}
              />
              <Detail
                label="Institution"
                value={student.diploma_institution ?? "—"}
              />
              <Detail
                label="Year of pass"
                value={
                  student.diploma_year_of_pass === null
                    ? "—"
                    : String(student.diploma_year_of_pass)
                }
                mono
              />
              <Detail
                label="Specialization"
                value={student.diploma_specialization ?? "—"}
              />
              <Detail
                label="State"
                value={student.diploma_state?.name ?? "—"}
              />
            </dl>
          </div>
        </div>
      )}
    </EditableCard>
  )
}

function EducationHistoryForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [tenthBoardId, setTenthBoardId] = React.useState<number | null>(
    student.tenth_board_id,
  )
  const [tenthInstitution, setTenthInstitution] = React.useState(
    student.tenth_institution ?? "",
  )
  const [tenthYear, setTenthYear] = React.useState(
    student.tenth_year_of_pass === null
      ? ""
      : String(student.tenth_year_of_pass),
  )
  const [tenthStateId, setTenthStateId] = React.useState<number | null>(
    student.tenth_state_id,
  )

  const [twelfthBoardId, setTwelfthBoardId] = React.useState<number | null>(
    student.twelfth_board_id,
  )
  const [twelfthInstitution, setTwelfthInstitution] = React.useState(
    student.twelfth_institution ?? "",
  )
  const [twelfthYear, setTwelfthYear] = React.useState(
    student.twelfth_year_of_pass === null
      ? ""
      : String(student.twelfth_year_of_pass),
  )
  const [twelfthStateId, setTwelfthStateId] = React.useState<number | null>(
    student.twelfth_state_id,
  )

  const [diplomaBoardId, setDiplomaBoardId] = React.useState<number | null>(
    student.diploma_board_id,
  )
  const [diplomaInstitution, setDiplomaInstitution] = React.useState(
    student.diploma_institution ?? "",
  )
  const [diplomaYear, setDiplomaYear] = React.useState(
    student.diploma_year_of_pass === null
      ? ""
      : String(student.diploma_year_of_pass),
  )
  const [diplomaSpecialization, setDiplomaSpecialization] = React.useState(
    student.diploma_specialization ?? "",
  )
  const [diplomaStateId, setDiplomaStateId] = React.useState<number | null>(
    student.diploma_state_id,
  )

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const [boardsX, setBoardsX] = React.useState<ComboboxOption[]>([])
  const [boardsXii, setBoardsXii] = React.useState<ComboboxOption[]>([])
  const [diplomaBoards, setDiplomaBoards] = React.useState<ComboboxOption[]>([])
  const [states, setStates] = React.useState<ComboboxOption[]>([])
  const [listsLoading, setListsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const toOption = (r: { id: number; name: string; code?: string }) => ({
          value: r.id,
          label: r.name,
          sublabel: r.code,
        })
        const [x, xii, dip, st] = await Promise.all([
          fetchAllPages((page) =>
            listSchoolBoardsX({
              page,
              pageSize: 100,
              status: "active",
              sortBy: "name",
              sortOrder: "asc",
            }),
          ),
          fetchAllPages((page) =>
            listSchoolBoardsXii({
              page,
              pageSize: 100,
              status: "active",
              sortBy: "name",
              sortOrder: "asc",
            }),
          ),
          fetchAllPages((page) =>
            listDiplomaBoards({
              page,
              pageSize: 100,
              status: "active",
              sortBy: "name",
              sortOrder: "asc",
            }),
          ),
          fetchAllPages<State>((page) =>
            listStates({
              page,
              pageSize: 100,
              effectiveActive: true,
              sortBy: "name",
              sortOrder: "asc",
            }),
          ),
        ])
        if (cancelled) return
        setBoardsX(x.map(toOption))
        setBoardsXii(xii.map(toOption))
        setDiplomaBoards(dip.map(toOption))
        setStates(st.map((r) => ({ value: r.id, label: r.name })))
      } catch {
        if (!cancelled) toast.error("Couldn't load boards / states lists")
      } finally {
        if (!cancelled) setListsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    const yearChecks: [string, string][] = [
      ["tenth_year_of_pass", tenthYear],
      ["twelfth_year_of_pass", twelfthYear],
      ["diploma_year_of_pass", diplomaYear],
    ]
    for (const [key, value] of yearChecks) {
      const msg = rangeError(value, 1950, CURRENT_YEAR + 1, true)
      if (msg) e[key] = msg
    }
    const lenChecks: [string, string, number][] = [
      ["tenth_institution", tenthInstitution, 255],
      ["twelfth_institution", twelfthInstitution, 255],
      ["diploma_institution", diplomaInstitution, 255],
      ["diploma_specialization", diplomaSpecialization, 128],
    ]
    for (const [key, value, max] of lenChecks) {
      if (value.trim().length > max) e[key] = `Max ${max} characters`
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    if (tenthBoardId !== student.tenth_board_id) p.tenth_board_id = tenthBoardId
    const ti = normStr(tenthInstitution)
    if (ti !== student.tenth_institution) p.tenth_institution = ti
    const ty = normNum(tenthYear)
    if (ty !== student.tenth_year_of_pass) p.tenth_year_of_pass = ty
    if (tenthStateId !== student.tenth_state_id) p.tenth_state_id = tenthStateId

    if (twelfthBoardId !== student.twelfth_board_id)
      p.twelfth_board_id = twelfthBoardId
    const twi = normStr(twelfthInstitution)
    if (twi !== student.twelfth_institution) p.twelfth_institution = twi
    const twy = normNum(twelfthYear)
    if (twy !== student.twelfth_year_of_pass) p.twelfth_year_of_pass = twy
    if (twelfthStateId !== student.twelfth_state_id)
      p.twelfth_state_id = twelfthStateId

    if (diplomaBoardId !== student.diploma_board_id)
      p.diploma_board_id = diplomaBoardId
    const di = normStr(diplomaInstitution)
    if (di !== student.diploma_institution) p.diploma_institution = di
    const dy = normNum(diplomaYear)
    if (dy !== student.diploma_year_of_pass) p.diploma_year_of_pass = dy
    const ds = normStr(diplomaSpecialization)
    if (ds !== student.diploma_specialization) p.diploma_specialization = ds
    if (diplomaStateId !== student.diploma_state_id)
      p.diploma_state_id = diplomaStateId

    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-5">
        <div className="space-y-3">
          <EducationBlockHeader
            title="10th (SSC)"
            student={student}
            block="tenth"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Board">
              <Combobox
                id="tenth-board"
                value={tenthBoardId}
                options={withCurrent(boardsX, student.tenth_board)}
                onChange={setTenthBoardId}
                placeholder={listsLoading ? "Loading…" : "Select board"}
                searchPlaceholder="Search boards…"
                clearLabel="No board"
                disabled={listsLoading}
              />
            </Field>
            <Field label="Institution" error={errors.tenth_institution}>
              <Input
                value={tenthInstitution}
                onChange={(e) => setTenthInstitution(e.target.value)}
              />
            </Field>
            <Field label="Year of pass" error={errors.tenth_year_of_pass}>
              <Input
                value={tenthYear}
                onChange={(e) => setTenthYear(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                aria-invalid={!!errors.tenth_year_of_pass}
              />
            </Field>
            <Field label="State">
              <Combobox
                id="tenth-state"
                value={tenthStateId}
                options={withCurrent(states, student.tenth_state)}
                onChange={setTenthStateId}
                placeholder={listsLoading ? "Loading…" : "Select state"}
                searchPlaceholder="Search states…"
                clearLabel="No state"
                disabled={listsLoading}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <EducationBlockHeader
            title="12th (Intermediate)"
            student={student}
            block="twelfth"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Board">
              <Combobox
                id="twelfth-board"
                value={twelfthBoardId}
                options={withCurrent(boardsXii, student.twelfth_board)}
                onChange={setTwelfthBoardId}
                placeholder={listsLoading ? "Loading…" : "Select board"}
                searchPlaceholder="Search boards…"
                clearLabel="No board"
                disabled={listsLoading}
              />
            </Field>
            <Field label="Institution" error={errors.twelfth_institution}>
              <Input
                value={twelfthInstitution}
                onChange={(e) => setTwelfthInstitution(e.target.value)}
              />
            </Field>
            <Field label="Year of pass" error={errors.twelfth_year_of_pass}>
              <Input
                value={twelfthYear}
                onChange={(e) => setTwelfthYear(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                aria-invalid={!!errors.twelfth_year_of_pass}
              />
            </Field>
            <Field label="State">
              <Combobox
                id="twelfth-state"
                value={twelfthStateId}
                options={withCurrent(states, student.twelfth_state)}
                onChange={setTwelfthStateId}
                placeholder={listsLoading ? "Loading…" : "Select state"}
                searchPlaceholder="Search states…"
                clearLabel="No state"
                disabled={listsLoading}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 border-t pt-5">
          <EducationBlockHeader
            title="Diploma"
            student={student}
            block="diploma"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Board">
              <Combobox
                id="diploma-board"
                value={diplomaBoardId}
                options={withCurrent(diplomaBoards, student.diploma_board)}
                onChange={setDiplomaBoardId}
                placeholder={listsLoading ? "Loading…" : "Select board"}
                searchPlaceholder="Search boards…"
                clearLabel="No board"
                disabled={listsLoading}
              />
            </Field>
            <Field label="Institution" error={errors.diploma_institution}>
              <Input
                value={diplomaInstitution}
                onChange={(e) => setDiplomaInstitution(e.target.value)}
              />
            </Field>
            <Field label="Year of pass" error={errors.diploma_year_of_pass}>
              <Input
                value={diplomaYear}
                onChange={(e) => setDiplomaYear(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                aria-invalid={!!errors.diploma_year_of_pass}
              />
            </Field>
            <Field
              label="Specialization"
              error={errors.diploma_specialization}
            >
              <Input
                value={diplomaSpecialization}
                onChange={(e) => setDiplomaSpecialization(e.target.value)}
              />
            </Field>
            <Field label="State">
              <Combobox
                id="diploma-state"
                value={diplomaStateId}
                options={withCurrent(states, student.diploma_state)}
                onChange={setDiplomaStateId}
                placeholder={listsLoading ? "Loading…" : "Select state"}
                searchPlaceholder="Search states…"
                clearLabel="No state"
                disabled={listsLoading}
              />
            </Field>
          </div>
        </div>
      </div>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

/* ------------------------------------------------------------------------- */
/* Placements                                                                 */
/* ------------------------------------------------------------------------- */

function PlacementsSection({ student, onSaved }: SectionProps) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Placements"
      description="Eligibility and interest flags read by the placements module. “Not set” means the question hasn't been answered yet."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <PlacementsForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail
            label="Allowed by department for placements"
            value={triStateLabel(student.allowed_by_dept_for_placements)}
          />
          <Detail
            label="Interested in placements (self-declared)"
            value={triStateLabel(student.interested_in_placements_self)}
          />
        </dl>
      )}
    </EditableCard>
  )
}

function PlacementsForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [allowed, setAllowed] = React.useState<boolean | null>(
    student.allowed_by_dept_for_placements,
  )
  const [interested, setInterested] = React.useState<boolean | null>(
    student.interested_in_placements_self,
  )
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const p: UpdateStudentInput = {}
    if (allowed !== student.allowed_by_dept_for_placements)
      p.allowed_by_dept_for_placements = allowed
    if (interested !== student.interested_in_placements_self)
      p.interested_in_placements_self = interested
    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              Allowed by department for placements
            </p>
            <p className="text-xs text-muted-foreground">
              Department's call — read-only for the student.
            </p>
          </div>
          <TriState value={allowed} onChange={setAllowed} disabled={saving} />
        </div>
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              Interested in placements (self-declared)
            </p>
            <p className="text-xs text-muted-foreground">
              Whether the student wants to sit for placements.
            </p>
          </div>
          <TriState
            value={interested}
            onChange={setInterested}
            disabled={saving}
          />
        </div>
      </div>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

/* ------------------------------------------------------------------------- */
/* Parent details — flat profile fields + guardian contacts                   */
/* ------------------------------------------------------------------------- */

function ParentProfileFieldsCard({
  student,
  onSaved,
}: {
  student: Student
  onSaved: () => Promise<void> | void
}) {
  const [editing, setEditing] = React.useState(false)
  return (
    <EditableCard
      title="Parent & guardian details"
      description="Profile fields from the student record. Saving mirrors them into the parent-portal contacts below (the “parent” and “default guardian” rows)."
      editing={editing}
      onEdit={() => setEditing(true)}
    >
      {editing ? (
        <ParentProfileFieldsForm
          student={student}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail label="Parent name" value={student.parent_name ?? "—"} />
          <Detail
            label="Parent mobile"
            value={student.parent_mobile ?? "—"}
            mono
          />
          <Detail label="Parent email" value={student.parent_email ?? "—"} />
          <Detail label="Guardian name" value={student.guardian_name ?? "—"} />
          <Detail
            label="Guardian mobile"
            value={student.guardian_mobile ?? "—"}
            mono
          />
          <Detail
            label="Guardian email"
            value={student.guardian_email ?? "—"}
          />
        </dl>
      )}
    </EditableCard>
  )
}

function ParentProfileFieldsForm({
  student,
  onSaved,
  onClose,
}: SectionProps & { onClose: () => void }) {
  const [parentName, setParentName] = React.useState(student.parent_name ?? "")
  const [parentMobile, setParentMobile] = React.useState(
    student.parent_mobile ?? "",
  )
  const [parentEmail, setParentEmail] = React.useState(
    student.parent_email ?? "",
  )
  const [guardianName, setGuardianName] = React.useState(
    student.guardian_name ?? "",
  )
  const [guardianMobile, setGuardianMobile] = React.useState(
    student.guardian_mobile ?? "",
  )
  const [guardianEmail, setGuardianEmail] = React.useState(
    student.guardian_email ?? "",
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const { saving, save } = useSectionSave(student, onSaved, onClose)

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (parentName.trim().length > 128) e.parent_name = "Max 128 characters"
    if (guardianName.trim().length > 128)
      e.guardian_name = "Max 128 characters"
    if (parentMobile.trim() && !MOBILE_REGEX.test(parentMobile.trim()))
      e.parent_mobile = "10-digit Indian mobile (starts 6-9)"
    if (guardianMobile.trim() && !MOBILE_REGEX.test(guardianMobile.trim()))
      e.guardian_mobile = "10-digit Indian mobile (starts 6-9)"
    if (parentEmail.trim() && !EMAIL_REGEX.test(parentEmail.trim()))
      e.parent_email = "Invalid email"
    if (guardianEmail.trim() && !EMAIL_REGEX.test(guardianEmail.trim()))
      e.guardian_email = "Invalid email"
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const p: UpdateStudentInput = {}
    const pn = normStr(parentName)
    if (pn !== student.parent_name) p.parent_name = pn
    const pm = normStr(parentMobile)
    if (pm !== student.parent_mobile) p.parent_mobile = pm
    const pe = normStr(parentEmail.toLowerCase())
    if (pe !== student.parent_email) p.parent_email = pe
    const gn = normStr(guardianName)
    if (gn !== student.guardian_name) p.guardian_name = gn
    const gm = normStr(guardianMobile)
    if (gm !== student.guardian_mobile) p.guardian_mobile = gm
    const ge = normStr(guardianEmail.toLowerCase())
    if (ge !== student.guardian_email) p.guardian_email = ge

    await save(p)
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent name" error={errors.parent_name}>
          <Input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
        </Field>
        <Field label="Guardian name" error={errors.guardian_name}>
          <Input
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
          />
        </Field>
        <Field label="Parent mobile" error={errors.parent_mobile}>
          <Input
            value={parentMobile}
            onChange={(e) => setParentMobile(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            aria-invalid={!!errors.parent_mobile}
          />
        </Field>
        <Field label="Guardian mobile" error={errors.guardian_mobile}>
          <Input
            value={guardianMobile}
            onChange={(e) => setGuardianMobile(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            aria-invalid={!!errors.guardian_mobile}
          />
        </Field>
        <Field label="Parent email" error={errors.parent_email}>
          <Input
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            aria-invalid={!!errors.parent_email}
          />
        </Field>
        <Field label="Guardian email" error={errors.guardian_email}>
          <Input
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            aria-invalid={!!errors.guardian_email}
          />
        </Field>
      </div>
      <p className="mt-3 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Saving syncs these into the parent-portal contacts list below — the
        parent fields update the “parent” row and the guardian fields the
        “default guardian” row.
      </p>
      <EditFooter saving={saving} onCancel={onClose} />
    </form>
  )
}

function ParentDetailsSection({ student, onSaved }: SectionProps) {
  const [rows, setRows] = React.useState<StudentGuardianRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [formTarget, setFormTarget] = React.useState<
    StudentGuardianRow | "create" | null
  >(null)
  const [deleteTarget, setDeleteTarget] =
    React.useState<StudentGuardianRow | null>(null)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setRows(await getGuardiansByStudent(student.id))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [student.id])

  React.useEffect(() => {
    void load()
  }, [load])

  // Relationships already in use — the backend enforces one contact per
  // relationship per student, so don't offer a taken one when adding.
  const usedRelationships = new Set(rows.map((r) => r.relationship))
  // Every relationship type is taken — there's nothing left to add.
  const allRelationshipsUsed =
    usedRelationships.size >= GUARDIAN_RELATIONSHIPS.length

  return (
    <div className="space-y-4">
      <ParentProfileFieldsCard
        student={student}
        onSaved={async () => {
          // The flat fields mirror into the contacts rows server-side, so the
          // list below must re-pull alongside the student refresh.
          await onSaved()
          void load()
        }}
      />
      <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Parent / guardian contacts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contacts attached to this student. Each parent signs in to the
            parent portal with their mobile number.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => setFormTarget("create")}
          disabled={loading || failed || allRelationshipsUsed}
          title={
            allRelationshipsUsed
              ? "All relationship types (father, mother, guardian, other) already have a contact. Edit or remove one to make changes."
              : undefined
          }
        >
          <Plus />
          Add contact
        </Button>
      </div>

      {allRelationshipsUsed && !loading && !failed && (
        <p className="border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
          All relationship types have a contact. Edit or remove one to make
          changes.
        </p>
      )}

      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState
          icon={Users}
          title="Couldn't load contacts"
          description="There was a problem reaching the server."
          action={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No parent contacts yet"
          description="Add a father, mother, or guardian contact for this student."
          action={
            <Button size="sm" onClick={() => setFormTarget("create")}>
              <Plus />
              Add contact
            </Button>
          }
        />
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] capitalize">
                    {RELATIONSHIP_LABELS[r.relationship]}
                  </span>
                  {r.is_primary && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      <Star className="size-3" />
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    <Phone className="size-3.5" />
                    {r.mobile_number}
                  </span>
                  {r.email && (
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <Mail className="size-3.5" />
                      {r.email}
                    </span>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormTarget(r)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setDeleteTarget(r)}
                    className="text-destructive data-[highlighted]:text-destructive"
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <ParentFormSheet
          student={student}
          target={formTarget}
          usedRelationships={usedRelationships}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null)
            void load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete parent contact?"
        tone="destructive"
        description={
          deleteTarget ? (
            <>
              This removes the{" "}
              {RELATIONSHIP_LABELS[deleteTarget.relationship]} contact{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.name}
              </span>{" "}
              for {student.display_name}. If this mobile is no longer attached
              to any student, its login sessions are revoked.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        loading={busyId === deleteTarget?.id}
        onConfirm={async () => {
          if (!deleteTarget) return
          setBusyId(deleteTarget.id)
          try {
            await removeGuardian(deleteTarget.id)
            toast.success("Contact deleted")
            setDeleteTarget(null)
            void load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Delete failed")
          } finally {
            setBusyId(null)
          }
        }}
      />
      </div>
    </div>
  )
}

function ParentFormSheet({
  student,
  target,
  usedRelationships,
  onClose,
  onSaved,
}: {
  student: Student
  target: StudentGuardianRow | "create"
  usedRelationships: Set<GuardianRelationship>
  onClose: () => void
  onSaved: () => void
}) {
  const isCreate = target === "create"
  const existing = isCreate ? null : target

  // When adding, default to the first relationship not already used.
  const firstFree =
    GUARDIAN_RELATIONSHIPS.find((r) => !usedRelationships.has(r)) ?? "guardian"

  const [relationship, setRelationship] = React.useState<GuardianRelationship>(
    existing?.relationship ?? firstFree,
  )
  const [name, setName] = React.useState(existing?.name ?? "")
  const [mobile, setMobile] = React.useState(existing?.mobile_number ?? "")
  const [email, setEmail] = React.useState(existing?.email ?? "")
  const [isPrimary, setIsPrimary] = React.useState(existing?.is_primary ?? false)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = "Required"
    if (!MOBILE_REGEX.test(mobile.trim()))
      e.mobile = "10-digit Indian mobile (starts 6-9)"
    if (email.trim() && !EMAIL_REGEX.test(email.trim()))
      e.email = "Invalid email"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (isCreate) {
        await createGuardian({
          student_id: student.id,
          relationship,
          name: name.trim(),
          mobile_number: mobile.trim(),
          email: email.trim() || null,
          is_primary: isPrimary,
        })
        toast.success("Contact added")
      } else {
        await updateGuardian(existing!.id, {
          relationship,
          name: name.trim(),
          mobile_number: mobile.trim(),
          email: email.trim() || null,
          is_primary: isPrimary,
        })
        toast.success("Contact updated")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isCreate ? "Add parent contact" : "Edit parent contact"}
          </SheetTitle>
          <SheetDescription>
            For {student.student_id} · {student.display_name}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit}>
          <SheetBody className="space-y-4">
            <Field label="Relationship" required>
              <select
                value={relationship}
                onChange={(e) =>
                  setRelationship(e.target.value as GuardianRelationship)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {GUARDIAN_RELATIONSHIPS.map((r) => {
                  // A relationship taken by another contact can't be reused.
                  const taken =
                    usedRelationships.has(r) && r !== existing?.relationship
                  return (
                    <option key={r} value={r} disabled={taken}>
                      {RELATIONSHIP_LABELS[r]}
                      {taken ? " (already added)" : ""}
                    </option>
                  )
                })}
              </select>
            </Field>

            <Field label="Contact name" error={errors.name} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Mobile number" error={errors.mobile} required>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="numeric"
              />
            </Field>

            <Field label="Email (optional)" error={errors.email}>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <label className="flex items-start gap-2.5 rounded-md border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Primary contact
                </span>
                <span className="block text-xs text-muted-foreground">
                  The main point of contact for this student.
                </span>
              </span>
            </label>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isCreate ? "Add" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function StudentDetailsSkeleton() {
  return (
    <>
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="rounded-lg border bg-card p-5 shadow-xs">
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
