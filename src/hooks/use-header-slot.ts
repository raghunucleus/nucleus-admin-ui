import { createContext, useContext } from "react"

/**
 * The DOM node in the app header that `PageHeader` portals the page title
 * into. Provided by `AppLayout` (the element where the sidebar hamburger used
 * to sit); `null` outside the signed-in shell, where the heading renders
 * inline instead.
 *
 * Lives in a hooks-only file because `createContext(...)` is a call, and
 * `react-refresh/only-export-components` forbids it next to a component.
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null)

export function useHeaderSlot(): HTMLElement | null {
  return useContext(HeaderSlotContext)
}
