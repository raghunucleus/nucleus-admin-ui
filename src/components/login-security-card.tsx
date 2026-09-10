import * as React from "react"
import { toast } from "sonner"
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  SKIP_REASON_LABELS,
  listAccountInvites,
  revokeAccountInvite,
  sendAccountInvites,
  type InviteHistoryRow,
  type InviteSubjectType,
} from "@/lib/account-invites"
import { ApiError } from "@/lib/api"

/** The person whose login is being managed — a student or an employee. */
export type LoginSubject = {
  type: InviteSubjectType
  id: number
  displayName: string
  /** Institutional identifier shown in the reset confirmation (student_id / emp_code). */
  code: string
  email: string
}

const SUBJECT_COPY: Record<InviteSubjectType, { noun: string; portal: string }> =
  {
    student: { noun: "student", portal: "Nucleus student portal" },
    employee: { noun: "employee", portal: "Nucleus employee portal" },
  }

type LoginSecurityCardProps = {
  subject: LoginSubject
  setPassword: (id: number, password: string) => Promise<void>
  resetPassword: (id: number) => Promise<{ email: string }>
}

/**
 * "Login & security" section of a person's detail page: account invitation,
 * set-a-password, and email-a-temporary-password. Shared by the student and
 * employee detail screens — the server endpoints behave identically for both.
 */
export function LoginSecurityCard({
  subject,
  setPassword,
  resetPassword,
}: LoginSecurityCardProps) {
  const { noun, portal } = SUBJECT_COPY[subject.type]
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="text-sm font-semibold">Login &amp; security</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Manage how this {noun} signs in to the {portal}.
      </p>
      <div className="mt-4 space-y-3">
        <InvitePanel subject={subject} />
        <SetPasswordPanel subject={subject} setPassword={setPassword} />
        <ResetByEmailPanel subject={subject} resetPassword={resetPassword} />
      </div>
    </div>
  )
}

/**
 * Account invitation for one person, plus the history of every invitation
 * sent to them.
 *
 * The bulk equivalents live on the list pages; this is the per-person view
 * an admin lands on when someone says "I never got my link".
 */
function InvitePanel({ subject }: { subject: LoginSubject }) {
  const { noun } = SUBJECT_COPY[subject.type]
  // `fetchedAt` is captured when the rows arrive rather than read during
  // render: expiry is a comparison against "now", and calling Date.now() in
  // the render body is an impure read that stops the component memoizing.
  // Every mutation here refetches, so the stamp is never meaningfully stale.
  const [history, setHistory] = React.useState<{
    rows: InviteHistoryRow[]
    fetchedAt: number
  } | null>(null)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const rows = await listAccountInvites(subject.type, subject.id)
      setHistory({ rows, fetchedAt: Date.now() })
    } catch {
      // Non-fatal: the panel still offers to send.
      setHistory({ rows: [], fetchedAt: Date.now() })
    }
  }, [subject.type, subject.id])

  React.useEffect(() => {
    void load()
  }, [load])

  const latest = history?.rows[0]
  const outstanding =
    !!history &&
    !!latest &&
    !latest.accepted_at &&
    !latest.revoked_at &&
    new Date(latest.expires_at).getTime() > history.fetchedAt

  const handleSend = async () => {
    setBusy(true)
    try {
      const res = await sendAccountInvites({
        subject_type: subject.type,
        subject_ids: [subject.id],
        only_uninvited: false,
        // Explicit per-person action: the admin is looking at this one row and
        // asking for a link, so an outstanding invite should be replaced
        // rather than reported as a skip.
        resend: true,
      })
      if (res.sent === 1) {
        toast.success("Invitation sent", {
          description: `${subject.displayName} can now set their own password. The link expires in a few days.`,
        })
      } else if (res.skipped.length > 0) {
        toast.info("Nothing sent", {
          description: SKIP_REASON_LABELS[res.skipped[0].reason],
        })
      } else {
        toast.error("Couldn't send the invitation", {
          description: res.failed[0]?.message ?? "Please try again.",
        })
      }
      await load()
    } catch (err) {
      toast.error("Couldn't send the invitation", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async () => {
    setBusy(true)
    try {
      await revokeAccountInvite(subject.type, subject.id)
      toast.success("Invitation revoked", {
        description: "The link in that email no longer works.",
      })
      await load()
    } catch (err) {
      toast.error("Couldn't revoke the invitation", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Send an account invitation</p>
          <p className="text-xs text-muted-foreground">
            Emails a single-use link to{" "}
            <span className="font-medium text-foreground">{subject.email}</span>{" "}
            so the {noun} chooses their own password. No password is sent by
            email, and any earlier invitation stops working.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {outstanding && (
            <Button
              variant="ghost"
              onClick={() => void handleRevoke()}
              disabled={busy}
            >
              Revoke
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void handleSend()}
            disabled={busy || !subject.email}
          >
            <Mail />
            {outstanding ? "Resend invitation" : "Send invitation"}
          </Button>
        </div>
      </div>

      {history && history.rows.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Invitation history ({history.rows.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {history.rows.map((h) => (
              <li key={h.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatDateTime(h.created_at)}
                </span>{" "}
                → {h.email}
                {h.invited_by && ` · by ${h.invited_by.display_name}`}
                {" · "}
                {h.accepted_at
                  ? `accepted ${formatDateTime(h.accepted_at)}`
                  : h.revoked_at
                    ? "revoked"
                    : new Date(h.expires_at).getTime() <= history.fetchedAt
                      ? "expired"
                      : `expires ${formatDateTime(h.expires_at)}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SetPasswordPanel({
  subject,
  setPassword: submitPassword,
}: {
  subject: LoginSubject
  setPassword: LoginSecurityCardProps["setPassword"]
}) {
  const { noun } = SUBJECT_COPY[subject.type]
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
      await submitPassword(subject.id, password)
      toast.success("Password set", {
        description: `${subject.displayName} can sign in with this password. They must change it on first sign-in.`,
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
        Share it with the {noun} yourself. They must change it on first
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

function ResetByEmailPanel({
  subject,
  resetPassword,
}: {
  subject: LoginSubject
  resetPassword: LoginSecurityCardProps["resetPassword"]
}) {
  const { noun } = SUBJECT_COPY[subject.type]
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const handleReset = async () => {
    setBusy(true)
    try {
      const { email } = await resetPassword(subject.id)
      toast.success("Login reset", {
        description: `A temporary password was emailed to ${email}. The ${noun} must change it on first sign-in.`,
      })
      setConfirmOpen(false)
    } catch (err) {
      toast.error(`Couldn't reset ${noun} login`, {
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
          <span className="font-medium text-foreground">{subject.email}</span>.
          The {noun} must change it on first sign-in, and any active sessions
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
        title={`Reset ${noun} login?`}
        icon={KeyRound}
        description={
          <>
            A new temporary password will be emailed to the {noun}. They must
            change it on first sign-in, and any active sessions will be signed
            out.
            <div className="mt-2 font-medium text-foreground">
              {subject.displayName}{" "}
              <span className="text-muted-foreground">({subject.code})</span>
            </div>
            <div className="text-muted-foreground">{subject.email}</div>
          </>
        }
        confirmLabel="Send reset email"
        loading={busy}
        onConfirm={handleReset}
      />
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
