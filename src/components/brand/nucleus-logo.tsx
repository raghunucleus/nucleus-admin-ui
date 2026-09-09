import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { NucleusMark } from "./nucleus-mark"
import { NucleusWordmark } from "./nucleus-wordmark"

export interface NucleusLogoProps {
  /** `horizontal` — mark beside the wordmark (headers, sidebars). `stacked` — mark above it. */
  variant?: "horizontal" | "stacked"
  markSize?: number
  wordmarkHeight?: number
  /** Small uppercase line under the wordmark, e.g. "Admin Console". */
  eyebrow?: ReactNode
  /** White tile behind the mark for dark/coloured surfaces. */
  tile?: boolean
  className?: string
  wordmarkClassName?: string
  eyebrowClassName?: string
}

/**
 * Mark + wordmark lockup. Renders a plain `<span>` so callers wrap it in a
 * `Link`/`button` themselves.
 */
export function NucleusLogo({
  variant = "horizontal",
  markSize,
  wordmarkHeight,
  eyebrow,
  tile = false,
  className,
  wordmarkClassName,
  eyebrowClassName,
}: NucleusLogoProps) {
  const stacked = variant === "stacked"
  const mark = markSize ?? (stacked ? 64 : 36)
  const word = wordmarkHeight ?? (stacked ? 22 : 16)

  return (
    <span
      className={cn(
        "inline-flex items-center",
        stacked ? "flex-col gap-3" : "gap-2",
        className,
      )}
    >
      <NucleusMark size={mark} tile={tile} />
      <span
        className={cn(
          "flex min-w-0 flex-col leading-tight",
          stacked ? "items-center gap-1" : "gap-0.5",
        )}
      >
        <NucleusWordmark height={word} className={wordmarkClassName} />
        {eyebrow ? (
          <span
            className={cn(
              "truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
              eyebrowClassName,
            )}
          >
            {eyebrow}
          </span>
        ) : null}
      </span>
    </span>
  )
}
