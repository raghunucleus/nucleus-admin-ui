import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { MarkSvg } from "./nucleus-mark"
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion"

export interface NucleusLoaderProps {
  /** Mark size in px. */
  size?: number
  /** Copy shown under the mark. */
  message?: ReactNode
  /** Screen-reader label when `message` is not a string. */
  label?: string
  /** Fill the viewport (boot splashes). */
  fullScreen?: boolean
  className?: string
}

/**
 * Loading indicator built from the logo: the rings and core hold still while
 * the electrons revolve around the nucleus like planets around the sun — three
 * on the outer ring (4 s), the smallest on the inner ring (1.8 s). Under
 * `prefers-reduced-motion` it shows the exact static logo with a soft fade
 * instead. Use for full-screen and blocking waits; in-button spinners stay as
 * they are.
 */
export function NucleusLoader({
  size = 56,
  message,
  label = "Loading",
  fullScreen = false,
  className,
}: NucleusLoaderProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={typeof message === "string" ? message : label}
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
        fullScreen && "min-h-svh bg-background",
        className,
      )}
    >
      <MarkSvg
        size={size}
        animated={!reducedMotion}
        className={reducedMotion ? "nucleus-breathe" : undefined}
        aria-hidden="true"
      />
      {message ? (
        <p className="text-sm font-medium text-foreground">{message}</p>
      ) : null}
    </div>
  )
}
