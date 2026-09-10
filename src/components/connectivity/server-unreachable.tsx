import { CloudOff, RefreshCw } from "lucide-react"

import { NucleusLogo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ServerUnreachableProps = {
  /** Trigger an immediate reachability re-check. */
  onRetry: () => void
  /** A manual re-check is in flight (drives the button's spinner/label). */
  checking?: boolean
}

/**
 * Full-screen "can't reach the server" takeover, rendered by
 * `ConnectivityMonitor` when the API is unreachable. Styled after the 404 page
 * (`pages/not-found.tsx`): a `fixed inset-0` overlay with a faded grid, a radial
 * glow, and a pinging icon. Disappears automatically once the server answers.
 */
export function ServerUnreachable({
  onRetry,
  checking = false,
}: ServerUnreachableProps) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 30%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 55%)",
        }}
      />

      <div
        role="alert"
        aria-live="assertive"
        className="relative w-full max-w-lg text-center"
      >
        <div className="mb-8 inline-flex items-center">
          <NucleusLogo eyebrow="Admin Console" className="text-left" />
        </div>

        {/* Radar/sonar: concentric rings pulse outward around the icon,
            reading as "searching for the server" — echoes the retry loop. */}
        <div className="flex justify-center">
          <div className="relative size-24 sm:size-28">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-primary/30 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-primary/25 animate-ping"
              style={{ animationDuration: "2.4s", animationDelay: "0.8s" }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-primary/20 animate-ping"
              style={{ animationDuration: "2.4s", animationDelay: "1.6s" }}
            />
            <div className="relative grid size-24 place-items-center rounded-full border bg-card text-primary shadow-sm sm:size-28">
              <CloudOff className="size-10 sm:size-12" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Connection lost
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Can't reach the server
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          We're having trouble connecting to Nucleus. We'll keep trying and
          reconnect automatically as soon as it's back.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button onClick={onRetry} disabled={checking}>
            <RefreshCw className={cn(checking && "animate-spin")} />
            {checking ? "Checking…" : "Try again"}
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Dot />
            <Dot className="[animation-delay:180ms]" />
            <Dot className="[animation-delay:360ms]" />
            <span className="ml-1.5">Reconnecting…</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** A single pulsing dot for the "Reconnecting…" indicator. */
function Dot({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-1.5 rounded-full bg-primary animate-pulse", className)}
    />
  )
}
