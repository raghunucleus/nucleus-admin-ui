import { Link } from "@tanstack/react-router"
import { Compass } from "lucide-react"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center text-card-foreground shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" />
        </div>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go back
          </Button>
          <Button asChild>
            <Link to="/">Take me home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
