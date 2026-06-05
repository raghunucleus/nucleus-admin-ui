import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
  ENTRY_TYPE_LABELS,
  GENDER_LABELS,
  getStudent,
  resetStudentLoginPassword,
  setStudentLoginPassword,
  type Student,
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

const MOBILE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Sections of the student detail screen. New areas (parent details, academic
// records, …) slot in here without touching the page shell.
const SECTIONS = [
  { key: "overview", label: "Overview", icon: UserRound },
  { key: "login", label: "Login & security", icon: ShieldCheck },
  { key: "parent", label: "Parent details", icon: Users },
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/students/all"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Students
        </Link>
      </div>

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
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {student.display_name}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {student.student_id}
                  </span>
                  <StatusBadge active={student.is_active} />
                </div>
              </div>
            </div>
          </header>

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
          {section === "login" && <LoginSection student={student} />}
          {section === "parent" && <ParentDetailsSection student={student} />}
        </>
      )}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-success" : "bg-destructive",
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
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

function LoginSection({ student }: { student: Student }) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="text-sm font-semibold">Login &amp; security</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Manage how this student signs in to the Nucleus student portal.
      </p>
      <div className="mt-4 space-y-3">
        <SetPasswordPanel student={student} />
        <ResetByEmailPanel student={student} />
      </div>
    </div>
  )
}

function SetPasswordPanel({ student }: { student: Student }) {
  const [password, setPassword] = React.useState("")
  const [shown, setShown] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const handleSet = async () => {
    const policyError = validatePassword(password)
    if (policyError) {
      setError(policyError)
      return
    }
    setBusy(true)
    try {
      await setStudentLoginPassword(student.id, password)
      toast.success("Password set", {
        description: `${student.display_name} can sign in with this password. They must change it on first sign-in.`,
      })
      setPassword("")
      setShown(false)
      setError(null)
    } catch (err) {
      toast.error("Couldn't set password", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-medium">Set a password manually</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Set the password directly to a value you choose — no email is sent.
        Share it with the student yourself. They must change it on first
        sign-in, and any active sessions are signed out.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <div className="relative">
            <Input
              type={shown ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder="New password"
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={!!error}
            />
            <button
              type="button"
              onClick={() => setShown((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={shown ? "Hide password" : "Show password"}
            >
              {shown ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error ??
              "At least 8 characters, including a letter and a number."}
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={handleSet}
          disabled={busy || password.length === 0}
        >
          {busy ? "Setting…" : "Set password"}
        </Button>
      </div>
    </div>
  )
}

function ResetByEmailPanel({ student }: { student: Student }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const handleReset = async () => {
    setBusy(true)
    try {
      const { email } = await resetStudentLoginPassword(student.id)
      toast.success("Login reset", {
        description: `A temporary password was emailed to ${email}. The student must change it on first sign-in.`,
      })
      setConfirmOpen(false)
    } catch (err) {
      toast.error("Couldn't reset student login", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">Email a temporary password</p>
        <p className="text-xs text-muted-foreground">
          Emails a new random temporary password to{" "}
          <span className="font-medium text-foreground">{student.email}</span>.
          The student must change it on first sign-in, and any active sessions
          are signed out.
        </p>
      </div>
      <Button
        variant="outline"
        className="shrink-0"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
      >
        <KeyRound />
        Reset &amp; email
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open)
        }}
        title="Reset student login?"
        icon={KeyRound}
        description={
          <>
            A new temporary password will be emailed to the student. They must
            change it on first sign-in, and any active sessions will be signed
            out.
            <div className="mt-2 font-medium text-foreground">
              {student.display_name}{" "}
              <span className="text-muted-foreground">
                ({student.student_id})
              </span>
            </div>
            <div className="text-muted-foreground">{student.email}</div>
          </>
        }
        confirmLabel="Send reset email"
        loading={busy}
        onConfirm={handleReset}
      />
    </div>
  )
}

function ParentDetailsSection({ student }: { student: Student }) {
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
  required,
  children,
}: {
  label: string
  error?: string
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-1 break-words text-sm", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  )
}

/** Mirrors the server-side strongPasswordSchema so the admin gets instant feedback. */
function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters."
  if (!/[A-Za-z]/.test(password)) {
    return "Password must contain at least one letter."
  }
  if (!/\d/.test(password)) return "Password must contain at least one number."
  return null
}

function StudentDetailsSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
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
