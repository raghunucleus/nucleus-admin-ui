import { Link } from "@tanstack/react-router"
import { ArrowLeft, Compass, Home } from "lucide-react"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-12">
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

      <div className="relative w-full max-w-lg text-center">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <span
            aria-hidden
            className="select-none font-semibold leading-none tracking-tighter text-[7rem] sm:text-[9rem]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--primary), color-mix(in oklab, var(--primary) 35%, transparent))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            4
          </span>
          <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full border bg-card text-primary shadow-sm sm:size-32">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-primary/10"
              style={{ animationDuration: "3s" }}
            />
            <Compass className="size-10 sm:size-14" strokeWidth={1.5} />
          </div>
          <span
            aria-hidden
            className="select-none font-semibold leading-none tracking-tighter text-[7rem] sm:text-[9rem]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--primary), color-mix(in oklab, var(--primary) 35%, transparent))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            4
          </span>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Error 404 · Page not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          You've wandered off the map
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist, has been moved, or the link
          you followed is out of date.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft />
            Go back
          </Button>
          <Button asChild>
            <Link to="/">
              <Home />
              Take me home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
