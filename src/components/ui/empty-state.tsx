import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon component to render in the badge. Ignored if `image` is set. */
  icon?: LucideIcon
  /** Optional image URL (e.g. illustration). Wins over `icon` when provided. */
  image?: string
  /** Alt text for the image (defaults to ""). */
  imageAlt?: string
  /** Main heading. Required. */
  title: string
  /** Optional secondary line. */
  description?: React.ReactNode
  /** Optional action area (e.g. a Button). Rendered below the description. */
  action?: React.ReactNode
  /** Tweak the badge size if needed ("sm" | "md" | "lg"). */
  size?: "sm" | "md" | "lg"
}

const badgeSize = {
  sm: { wrap: "size-10", icon: "size-4", img: "size-10" },
  md: { wrap: "size-12", icon: "size-5", img: "size-12" },
  lg: { wrap: "size-16", icon: "size-7", img: "size-20" },
} as const

function EmptyState({
  icon: Icon = Inbox,
  image,
  imageAlt = "",
  title,
  description,
  action,
  size = "md",
  className,
  ...rest
}: EmptyStateProps) {
  const sz = badgeSize[size]
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
      {...rest}
    >
      {image ? (
        <img
          src={image}
          alt={imageAlt}
          className={cn("mb-4 object-contain opacity-90", sz.img)}
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "mb-4 grid place-items-center rounded-full bg-muted text-muted-foreground",
            sz.wrap,
          )}
        >
          <Icon className={sz.icon} />
        </div>
      )}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
