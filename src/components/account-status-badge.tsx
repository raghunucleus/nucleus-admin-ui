import { cn } from "@/lib/utils"
import type { AccountStatusView } from "@/lib/account-invites"

/**
 * The "Account" column cell on the students/employees lists — whether this
 * person can actually sign in, and where their invitation got to.
 *
 * Mirrors the record-status pill markup already in those tables so the two
 * columns read as one family.
 */
export function AccountStatusBadge({
  status,
}: {
  status: AccountStatusView | undefined
}) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  if (status.status === "active") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
        title={
          status.last_login_at
            ? `Last signed in ${formatDate(status.last_login_at)}`
            : "Can sign in; has not signed in yet"
        }
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        Active
      </span>
    )
  }

  if (status.status === "invited") {
    return (
      <span
        className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        title={`Invitation sent ${formatDate(status.invited_at)} · expires ${formatDate(
          status.expires_at,
        )}`}
      >
        Invited
        {status.resend_count > 0 && (
          <span className="ml-1 tabular-nums opacity-70">
            ·{status.resend_count}
          </span>
        )}
      </span>
    )
  }

  if (status.status === "expired") {
    return (
      <span
        className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        title={`Invitation sent ${formatDate(status.invited_at)}, expired ${formatDate(
          status.expires_at,
        )}`}
      >
        Invite expired
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
      )}
    >
      Not invited
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
