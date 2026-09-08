import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Native checkbox, styled to match the inline ones already used across the
 * pages (`size-4 rounded border-input accent-primary`). No Radix dependency —
 * the only thing the native element can't express declaratively is the
 * indeterminate state, which a header "select all on page" box needs, so that
 * is applied through a ref.
 */
export function Checkbox({
  indeterminate,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  indeterminate?: boolean
}) {
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
