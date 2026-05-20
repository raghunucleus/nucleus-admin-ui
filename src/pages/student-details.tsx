import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  GENDER_LABELS,
  getStudent,
  resetStudentLoginPassword,
  setStudentLoginPassword,
  type Student,
} from "@/lib/students"

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
          {section === "parent" && (
            <ComingSoonSection
              title="Parent details coming soon"
              description="Parent contact information and parent portal access will be managed from this section."
            />
          )}
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

function ComingSoonSection({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <EmptyState icon={Users} title={title} description={description} />
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
