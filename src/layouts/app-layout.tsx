import * as React from "react"
import { Outlet, useNavigate } from "@tanstack/react-router"
import { ChevronDown, LogOut, Settings } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sidebar } from "@/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { HeaderSlotContext } from "@/hooks/use-header-slot"
import { useIdleLogout } from "@/hooks/use-idle-logout"
import { logout } from "@/lib/auth"
import { useAuthStore } from "@/store/auth-store"
import { useConnectivityStore } from "@/store/connectivity-store"

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const reconnectNonce = useConnectivityStore((s) => s.reconnectNonce)
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = React.useState(false)
  // The header's title slot. `PageHeader` portals each page's heading into it
  // (see src/hooks/use-header-slot.ts); a callback ref keeps it in state so the
  // context re-renders consumers once the node exists.
  const [headerSlot, setHeaderSlot] = React.useState<HTMLElement | null>(null)

  useIdleLogout()

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate({ to: "/login" })
    }
  }

  const primaryName = user?.display_name?.trim() || user?.username || "Guest"
  const secondaryName = user?.display_name?.trim() ? user?.username : user?.email
  const initials = primaryName
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?"

  return (
    <HeaderSlotContext.Provider value={headerSlot}>
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
          {/* Page title slot — the active page's `PageHeader` portals its back
              link, icon and title here. Sidebar pin/auto-hide lives in the
              sidebar footer. */}
          <div
            ref={setHeaderSlot}
            data-slot="header-title"
            className="flex min-w-0 flex-1 items-center gap-2"
          />
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </div>
                  <div className="hidden max-w-[14rem] leading-tight hd:block">
                    <div className="truncate text-sm font-medium">{primaryName}</div>
                    {secondaryName && (
                      <div className="truncate text-xs text-muted-foreground">
                        {secondaryName}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>
                  <div className="leading-tight">
                    <div className="truncate text-sm font-medium text-foreground">
                      {primaryName}
                    </div>
                    {user?.display_name?.trim() && user?.username && (
                      <div className="truncate text-xs text-muted-foreground">
                        @{user.username}
                      </div>
                    )}
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
        <main className="flex-1 overflow-auto px-6 py-6">
          {/* Keyed on the reconnect nonce: on recovery the active page remounts
              and its data-loading effects re-run, clearing stale empty states. */}
          <Outlet key={reconnectNonce} />
        </main>
      </div>
    </div>
    </HeaderSlotContext.Provider>
  )
}
