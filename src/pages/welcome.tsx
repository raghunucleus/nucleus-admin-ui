import * as React from "react"
import { CalendarDays, Clock, Hourglass, Sun } from "lucide-react"

import { NucleusMark } from "@/components/brand"
import { useAuthStore } from "@/store/auth-store"

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
})

const tzFormatter = new Intl.DateTimeFormat(undefined, {
  timeZoneName: "short",
})

function greetingFor(hour: number): string {
  if (hour < 5)  return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 21) return "Good evening"
  return "Good night"
}

function dayProgress(d: Date): number {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  return ((d.getTime() - start.getTime()) / 86_400_000) * 100
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function timezoneLabel(d: Date): string {
  const parts = tzFormatter.formatToParts(d)
  return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
}

function useNow(): Date {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function WelcomePage() {
  const user = useAuthStore((s) => s.user)
  const loginAt = useAuthStore((s) => s.loginAt)
  const now = useNow()

  const greeting = greetingFor(now.getHours())
  const sessionMs = loginAt ? now.getTime() - loginAt : 0
  const progress = dayProgress(now)
  const tz = timezoneLabel(now)

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div className="rounded-lg border bg-card p-8 text-card-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <NucleusMark size={16} /> Nucleus Admin
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {greeting}
          {user?.username ? <>, <span className="text-primary">{user.username}</span></> : null}.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in to the admin console. Here's a quick read of where the day stands.
        </p>
      </div>

      <div className="grid gap-4 hd:grid-cols-2">
        <InfoTile icon={Clock} label={`Local time${tz ? ` · ${tz}` : ""}`}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {timeFormatter.format(now)}
            </span>
            <LiveDot />
          </div>
        </InfoTile>

        <InfoTile icon={CalendarDays} label="Today">
          <div className="text-xl font-semibold tracking-tight">
            {dateFormatter.format(now)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Day {dayOfYear(now)} of {now.getFullYear()} · Week {isoWeek(now)}
          </div>
        </InfoTile>

        <InfoTile icon={Hourglass} label="Session">
          <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {loginAt ? formatDuration(sessionMs) : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {loginAt
              ? `Signed in at ${timeFormatter.format(new Date(loginAt))}`
              : "Session start time unavailable"}
          </div>
        </InfoTile>

        <InfoTile icon={Sun} label="Day progress">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {progress.toFixed(1)}%
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </InfoTile>
      </div>

      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">About this console</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin UI is a thin shell for managing Nucleus. Use the sidebar to
          navigate as more sections come online.
        </p>
      </div>
    </div>
  )
}

function InfoTile({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-4" />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function LiveDot() {
  return (
    <span className="relative inline-flex size-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
      <span className="relative inline-flex size-2 rounded-full bg-success" />
    </span>
  )
}
