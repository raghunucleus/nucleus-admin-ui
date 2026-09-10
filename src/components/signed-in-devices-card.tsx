import * as React from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Laptop,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  Smartphone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import type { SessionRow } from "@/lib/sessions"
import { cn } from "@/lib/utils"

/** What a `load` call resolves to, normalized across the three audiences. */
export type SignedInDevicesResult = {
  sessions: SessionRow[]
  /**
   * The device limit the person counts against. Only employees have a
   * per-person limit, so only their loader supplies it; when present the card
   * shows "{n} of {limit} devices".
   */
  limit?: { value: number; isDefault: boolean }
}

type SignedInDevicesCardProps = {
  /**
   * Fetches the person's devices. Must be referentially stable (wrap it in
   * `useCallback`) — a new function identity re-runs the fetch.
   */
  load: () => Promise<SignedInDevicesResult>
  /** Force-signs one device out. */
  revoke: (sessionId: string) => Promise<void>
  /** "student" / "employee" / "parent" — used in the explanatory copy. */
  noun: string
  /** Named in the sign-out confirmation. */
  subjectName: string
  /**
   * `card` (default) renders the bordered section used on detail pages;
   * `plain` drops the frame and title for use inside a sheet that already
   * has its own header.
   */
  variant?: "card" | "plain"
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; result: SignedInDevicesResult; fetchedAt: number }

/** Fixed row count for the skeleton — the default limit, so it rarely jumps. */
const SKELETON_ROWS = 2

/**
 * A person's signed-in devices with a per-row force sign-out — the remedy for
 * a lost/stolen device, an offboarding, or a lowered device limit (which by
 * itself never evicts anyone). Shared by the student, employee and parent
 * screens; each passes its own loader and revoker.
 */
export function SignedInDevicesCard({
  load,
  revoke,
  noun,
  subjectName,
  variant = "card",
}: SignedInDevicesCardProps) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" })
  // Bumped to re-run the fetch effect: loudly from "Try again"/refresh (which
  // reset to the skeleton first), silently after a sign-out.
  const [reloadKey, setReloadKey] = React.useState(0)
  const [target, setTarget] = React.useState<SessionRow | null>(null)
  const [busy, setBusy] = React.useState(false)

  // State is only written after the await, so the effect never sets state
  // synchronously. `fetchedAt` is stamped here rather than read during render
  // (Date.now() in the render body is impure) and drives the "3m ago" labels.
  React.useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const result = await load()
        if (alive) setState({ status: "ready", result, fetchedAt: Date.now() })
      } catch {
        // A failed silent refresh keeps the last good list on screen.
        if (alive) {
          setState((prev) =>
            prev.status === "ready" ? prev : { status: "error" },
          )
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [load, reloadKey])

  const reload = () => {
    setState({ status: "loading" })
    setReloadKey((k) => k + 1)
  }

  const handleRevoke = async () => {
    if (!target) return
    const session = target
    setBusy(true)
    try {
      await revoke(session.id)
      toast.success(`Signed out of ${session.device_name}`, {
        description: `${subjectName} will need to sign in again on that device.`,
      })
      setTarget(null)
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              result: {
                ...prev.result,
                sessions: prev.result.sessions.filter(
                  (s) => s.id !== session.id,
                ),
              },
            }
          : prev,
      )
      // Silent refetch so the list reflects anything else that changed.
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error("Couldn't sign the device out", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  const summary = state.status === "ready" && (
    <DeviceSummary result={state.result} />
  )

  const body =
    state.status === "loading" ? (
      <DevicesSkeleton />
    ) : state.status === "error" ? (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load signed-in devices"
        description="There was a problem reaching the server."
        action={
          <Button size="sm" onClick={reload}>
            <RefreshCw />
            Try again
          </Button>
        }
      />
    ) : state.result.sessions.length === 0 ? (
      <EmptyState
        icon={MonitorSmartphone}
        title="Not signed in on any device"
        description={`Devices appear here once the ${noun} signs in.`}
      />
    ) : (
      <ul className="divide-y">
        {state.result.sessions.map((s) => (
          <DeviceRow
            key={s.id}
            session={s}
            now={state.fetchedAt}
            disabled={busy}
            onSignOut={() => setTarget(s)}
          />
        ))}
      </ul>
    )

  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={reload}
      disabled={state.status === "loading"}
      title="Refresh"
      aria-label="Refresh signed-in devices"
    >
      <RefreshCw className={cn(state.status === "loading" && "animate-spin")} />
    </Button>
  )

  const confirm = (
    <ConfirmDialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !busy) setTarget(null)
      }}
      title="Sign out of this device?"
      icon={LogOut}
      tone="destructive"
      description={
        target ? (
          <>
            {subjectName} will be signed out of this device immediately and
            will need to sign in again to use it.
            <div className="mt-2 font-medium text-foreground">
              {target.device_name}
            </div>
            <div className="font-mono text-muted-foreground">
              {target.ip ?? "IP unavailable"}
            </div>
          </>
        ) : undefined
      }
      confirmLabel="Sign out"
      loading={busy}
      onConfirm={handleRevoke}
    />
  )

  if (variant === "plain") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-4 text-xs text-muted-foreground">{summary}</div>
          {refreshButton}
        </div>
        <div className="rounded-lg border">{body}</div>
        {confirm}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Signed-in devices</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Devices this {noun} is signed in on. Signing a device out takes
            effect immediately.
          </p>
          {summary && (
            <div className="mt-2 text-xs text-muted-foreground">{summary}</div>
          )}
        </div>
        {refreshButton}
      </div>
      <div className="border-t">{body}</div>
      {confirm}
    </div>
  )
}

function DeviceSummary({ result }: { result: SignedInDevicesResult }) {
  const count = result.sessions.length
  if (!result.limit) {
    return (
      <span className="tabular-nums">
        {count} device{count === 1 ? "" : "s"} signed in
      </span>
    )
  }
  const { value, isDefault } = result.limit
  return (
    <span>
      <span className="font-medium text-foreground tabular-nums">
        {count} of {value}
      </span>{" "}
      allowed devices in use
      {isDefault ? " (default limit)" : " (custom limit)"}
      {count > value &&
        ". Lowering a limit doesn't sign anyone out — sign a device out to enforce it now."}
    </span>
  )
}

function DeviceRow({
  session,
  now,
  disabled,
  onSignOut,
}: {
  session: SessionRow
  now: number
  disabled: boolean
  onSignOut: () => void
}) {
  const mobile = /Mobile|iOS|iPhone|iPad|Android/i.test(session.device_name)
  const Icon = mobile ? Smartphone : Laptop
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{session.device_name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-mono">{session.ip ?? "IP unavailable"}</span>
          <span aria-hidden="true">·</span>
          <span title={formatDateTime(session.created_at)}>
            Signed in {formatDate(session.created_at)}
          </span>
          <span aria-hidden="true">·</span>
          <span title={formatDateTime(session.last_used_at)}>
            Active {formatRelative(session.last_used_at, now)}
          </span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={disabled}
        onClick={onSignOut}
      >
        <LogOut />
        Sign out
      </Button>
    </li>
  )
}

function DevicesSkeleton() {
  return (
    <ul className="divide-y" aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="size-9 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** "just now" / "3m ago" / "5h ago" / "2d ago", then a short date. */
function formatRelative(iso: string, now: number): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "—"
  const seconds = Math.max(0, Math.floor((now - t) / 1000))
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return `on ${formatDate(iso)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
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
