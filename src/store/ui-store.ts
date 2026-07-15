import { create } from "zustand"
import { persist } from "zustand/middleware"

type UiState = {
  // `locked` = pinned open. When false, the sidebar auto-hides to an icon rail
  // and re-expands on hover. Only this is persisted; hover/search-focus state
  // is ephemeral and lives in the Sidebar component.
  sidebarLocked: boolean
  toggleSidebarLock: () => void
  setSidebarLocked: (locked: boolean) => void
}

// First visit: pinned open on desktop, auto-hide rail on mobile.
function defaultLocked() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true
  }
  return !window.matchMedia("(max-width: 767px)").matches
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarLocked: defaultLocked(),
      toggleSidebarLock: () => set({ sidebarLocked: !get().sidebarLocked }),
      setSidebarLocked: (sidebarLocked) => set({ sidebarLocked }),
    }),
    { name: "nucleus-ui" },
  ),
)
