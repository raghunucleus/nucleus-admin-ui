import { Outlet } from "@tanstack/react-router"
import { Sparkles } from "lucide-react"

export function AuthLayout() {
  return (
    <div className="grid min-h-full place-items-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="text-base font-semibold">Nucleus Admin</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
