import type { SVGAttributes } from "react"

import { cn } from "@/lib/utils"

import { NUCLEUS_WORDMARK } from "./nucleus-wordmark-path"

export interface NucleusWordmarkProps
  extends Omit<SVGAttributes<SVGSVGElement>, "width" | "height"> {
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  height?: number
  title?: string
}

/**
 * The "nucleus" wordmark (traced from the artwork). Fills with `currentColor`,
 * defaulting to the brand navy (`--nucleus-wordmark`, white in dark mode) via
 * the `nucleus-wordmark` component class — override with any `text-*` utility.
 */
export function NucleusWordmark({
  height = 16,
  title = "Nucleus",
  className,
  ...rest
}: NucleusWordmarkProps) {
  const width =
    Math.round((NUCLEUS_WORDMARK.width / NUCLEUS_WORDMARK.height) * height * 100) / 100
  return (
    <svg
      viewBox={NUCLEUS_WORDMARK.viewBox}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={cn("nucleus-wordmark shrink-0", className)}
      {...rest}
    >
      <path d={NUCLEUS_WORDMARK.d} fill="currentColor" />
    </svg>
  )
}
