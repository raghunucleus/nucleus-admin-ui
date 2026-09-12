import * as React from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The one back control for a sub-page. Pass it as `PageHeader`'s `leading` so
 * it sits in the app header beside the title, where it is always visible.
 *
 * Slot-based so the call site keeps TanStack Router's typed `<Link>` (with its
 * `params` / `search`) instead of this component re-declaring a generic
 * `to` prop:
 *
 *   <BackLink label="Back to employees">
 *     <Link to="/employees/all" />
 *   </BackLink>
 *
 * The child element receives the button styling and the accessible name; its
 * content is replaced by the arrow.
 */
export function BackLink({
  label,
  children,
  className,
}: {
  label: string
  /** A single `<Link …/>` (or `<a>`); its children are ignored. */
  children: React.ReactElement
  className?: string
}) {
  const child = React.Children.only(children)
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn("-ml-2 text-muted-foreground hover:text-foreground", className)}
    >
      {React.cloneElement(child, undefined, <ArrowLeft className="size-4" />)}
    </Button>
  )
}
