import * as React from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"

import { useHeaderSlot } from "@/hooks/use-header-slot"
import { cn } from "@/lib/utils"

/**
 * The one page heading for every console page.
 *
 * `AppLayout`'s header owns a title slot (`HeaderSlotContext`, where the
 * hamburger used to be), and the heading — `leading` (a `BackLink`), `icon`,
 * `title` — is portalled into it. What stays on the page is row 1 = `tabs`
 * (starting at the content's left edge) with `actions` at the trailing edge,
 * then `children` (toolbars, meta rows). With nothing to put in flow the
 * component renders only the portal, so a page whose heading is just a title
 * adds no empty box to `space-y-*`.
 *
 * Render exactly ONE `PageHeader` per page, at the top level of the page's
 * return and above any loading/error branches — never inside a dialog, sheet
 * or tab body. Two mounted at once show two titles in the header; one that
 * mounts only once data arrives leaves the header blank while loading, so pass
 * a static fallback (`employee?.emp_display_name ?? "Employee"`) instead.
 *
 * Outside the shell (no slot) the heading renders inline as row 1.
 */
export function PageHeader({
  title,
  icon: Icon,
  leading,
  actions,
  tabs,
  className,
  children,
}: {
  title: React.ReactNode
  /** Small muted glyph before the title (hidden on phones in the header). */
  icon?: LucideIcon
  /** Rendered before the title — normally a `BackLink`. */
  leading?: React.ReactNode
  /** Trailing controls: primary button, menus, pickers. */
  actions?: React.ReactNode
  /** A tab strip — row 1 of the page content. */
  tabs?: React.ReactNode
  className?: string
  /** Extra rows under the tabs/actions row (toolbars, meta rows). */
  children?: React.ReactNode
}) {
  const slot = useHeaderSlot()

  // Dev-only tripwire for the one-per-page rule above.
  React.useEffect(() => {
    if (import.meta.env.DEV && slot && slot.querySelectorAll("h1").length > 1) {
      console.warn(
        "PageHeader: more than one page heading is mounted — the app header shows them all.",
      )
    }
  }, [slot])

  const heading = (
    <>
      {leading ? (
        <div className="flex shrink-0 items-center">{leading}</div>
      ) : null}
      {Icon ? (
        <Icon
          className="hidden size-5 shrink-0 text-muted-foreground sm:block"
          aria-hidden
        />
      ) : null}
      <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
        {title}
      </h1>
    </>
  )

  const row =
    tabs || actions ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tabs ? <div className="min-w-0 flex-1 basis-0">{tabs}</div> : null}
        {actions ? (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    ) : null

  if (slot) {
    const portal = createPortal(heading, slot)
    if (!row && !children) return portal
    return (
      <>
        {portal}
        <div className={cn("space-y-2", className)}>
          {row}
          {children}
        </div>
      </>
    )
  }

  // No header slot: the heading is row 1 of the page.
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">{heading}</div>
        {tabs ? <div className="min-w-0 flex-1 basis-0">{tabs}</div> : null}
        {actions ? (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
