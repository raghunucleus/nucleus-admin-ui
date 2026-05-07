import * as React from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sidebar } from "@/components/sidebar"
import { logout } from "@/lib/auth"
import { useAuthStore } from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate({ to: "/login" })
    }
  }

  const initials = (user?.username ?? user?.email ?? "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </div>
                  <div className="hidden leading-tight hd:block">
                    <div className="text-sm font-medium">{user?.username ?? "Guest"}</div>
                    <div className="text-xs text-muted-foreground">{user?.email}</div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>
                  <div className="leading-tight">
                    <div className="truncate text-sm font-medium text-foreground">
                      {user?.username ?? "Guest"}
                    </div>
                    {user?.email && (
                      <div className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    navigate({ to: "/profile", search: { section: "profile" } })
                  }
                >
                  <Settings /> Profile settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={loggingOut}
                  onSelect={(e) => {
                    e.preventDefault()
                    void handleLogout()
                  }}
                  className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                >
                  <LogOut /> {loggingOut ? "Signing out…" : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
