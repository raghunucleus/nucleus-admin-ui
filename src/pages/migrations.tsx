import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import {
  fetchMigrationsStatus,
  runMigrations,
  type Migration,
  type MigrationRunErrorDetails,
  type MigrationsStatus,
  type RunMigrationsResult,
} from "@/lib/migrations"

type RunFeedback =
  | { kind: "success"; result: RunMigrationsResult; at: number }
  | { kind: "error"; message: string; details: MigrationRunErrorDetails | null; at: number }

export function MigrationsPage() {
  const [status, setStatus] = React.useState<MigrationsStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [runFeedback, setRunFeedback] = React.useState<RunFeedback | null>(null)

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchMigrationsStatus()
      setStatus(data)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not load migration status."
      setLoadError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleRun = async () => {
    if (!status) return
    setRunning(true)
    setRunFeedback(null)
    try {
      const result = await runMigrations()
      setRunFeedback({ kind: "success", result, at: Date.now() })
      await load({ silent: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setRunFeedback({
          kind: "error",
          message: err.message,
          details: pickErrorDetails(err.data),
          at: Date.now(),
        })
      } else {
        setRunFeedback({
          kind: "error",
          message: "Failed to run migrations.",
          details: null,
          at: Date.now(),
        })
      }
    } finally {
      setRunning(false)
    }
  }

  const executed = status?.executed ?? []
  const pending = status?.pending ?? []
  const runEnabled = status?.runEnabled ?? false
  const canRun = !!status && runEnabled && pending.length > 0 && !running

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader
        title="Migrations"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load({ silent: true })}
              disabled={loading || refreshing || running}
            >
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              size="sm"
              onClick={handleRun}
              disabled={!canRun}
              title={
                !runEnabled
                  ? "Running migrations is disabled on the server"
                  : pending.length === 0
                  ? "No pending migrations"
                  : undefined
              }
            >
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              {running ? "Running…" : "Run pending"}
            </Button>
          </>
        }
      />

      {loadError && (
        <Banner tone="destructive" icon={AlertTriangle} title="Couldn't load migrations">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
            Try again
          </Button>
        </Banner>
      )}

      {status && !runEnabled && (
        <Banner
          tone="warning"
          icon={ShieldAlert}
          title="Running migrations is disabled"
        >
          <p>
            The server has the run endpoint disabled. Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              ALLOW_ADMIN_MIGRATIONS=true
            </code>{" "}
            on the backend to enable the “Run pending” action from this page.
          </p>
        </Banner>
      )}

      {runFeedback?.kind === "success" && (
        <Banner tone="success" icon={CheckCircle2} title="Migrations applied">
          {runFeedback.result.executed.length === 0 ? (
            <p>No new migrations were applied.</p>
          ) : (
            <>
              <p>
                Applied {runFeedback.result.executed.length} migration
                {runFeedback.result.executed.length === 1 ? "" : "s"}:
              </p>
              <ul className="mt-2 space-y-1">
                {runFeedback.result.executed.map((m) => (
                  <li key={migrationKey(m)} className="font-mono text-xs">
                    {m.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Banner>
      )}

      {runFeedback?.kind === "error" && (
        <Banner tone="destructive" icon={AlertTriangle} title="Migration run failed">
          <p>{runFeedback.message}</p>
          <ErrorDetails details={runFeedback.details} />
        </Banner>
      )}

      <div className="grid gap-4 hd:grid-cols-2">
        <MigrationList
          title="Pending"
          subtitle={
            loading
              ? "Loading status…"
              : pending.length === 0
              ? "Up to date — no pending migrations."
              : `${pending.length} migration${pending.length === 1 ? "" : "s"} waiting to run.`
          }
          items={pending}
          loading={loading}
          tone="pending"
          emptyHint="Up to date"
        />
        <MigrationList
          title="Executed"
          subtitle={
            loading
              ? "Loading status…"
              : executed.length === 0
              ? "No migrations have been applied yet."
              : `${executed.length} migration${executed.length === 1 ? "" : "s"} applied.`
          }
          items={executed}
          loading={loading}
          tone="executed"
          emptyHint="Nothing applied yet"
        />
      </div>
    </div>
  )
}

function MigrationList({
  title,
  subtitle,
  items,
  loading,
  tone,
  emptyHint,
}: {
  title: string
  subtitle: string
  items: Migration[]
  loading: boolean
  tone: "pending" | "executed"
  emptyHint: string
}) {
  return (
    <div className="flex flex-col rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-8 rounded-full" />
        ) : (
          <span
            className={
              tone === "pending"
                ? "rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                : "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
            }
          >
            {items.length}
          </span>
        )}
      </div>
      <div className="thin-scrollbar max-h-[32rem] overflow-y-auto px-2 py-2">
        {loading ? (
          <ul className="divide-y divide-border/60">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-24" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">{emptyHint}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((m) => (
              <li
                key={migrationKey(m)}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="truncate font-mono text-xs">{m.name}</span>
                {m.timestamp !== undefined && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTimestamp(m.timestamp)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ErrorDetails({ details }: { details: MigrationRunErrorDetails | null }) {
  if (!details) return null
  const { sql, driverError } = details
  const driverEntries = driverError ? Object.entries(driverError) : []

  if (!sql && driverEntries.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      {sql && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Offending SQL</div>
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-words">
            {sql}
          </pre>
        </div>
      )}
      {driverEntries.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Driver error</div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {driverEntries.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-words">{formatDriverValue(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "success" | "warning" | "destructive"
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  const cls =
    tone === "success"
      ? "border-success/40 bg-success/10"
      : tone === "warning"
      ? "border-warning/40 bg-warning/10"
      : "border-destructive/40 bg-destructive/10"
  const iconCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : "text-destructive"
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${cls}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${iconCls}`} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{title}</div>
          <div className="mt-1 text-foreground/80">{children}</div>
        </div>
      </div>
    </div>
  )
}

function migrationKey(m: Migration): string {
  if (m.id !== undefined) return `${m.id}-${m.name}`
  if (m.timestamp !== undefined) return `${m.timestamp}-${m.name}`
  return m.name
}

function formatTimestamp(ts: number | string): string {
  const n = typeof ts === "string" ? Number(ts) : ts
  if (!Number.isFinite(n)) return String(ts)
  const ms = n < 1e12 ? n * 1000 : n
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

function formatDriverValue(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function pickErrorDetails(data: unknown): MigrationRunErrorDetails | null {
  if (!data || typeof data !== "object") return null
  return data as MigrationRunErrorDetails
}
