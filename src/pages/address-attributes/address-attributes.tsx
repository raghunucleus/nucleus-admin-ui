import { Link, useSearch } from "@tanstack/react-router"
import { Globe, Map as MapIcon, MapPin, SlidersHorizontal, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AddressAttributeTab } from "@/router"
import { CountriesTab } from "./countries-tab"
import { DistrictsTab } from "./districts-tab"
import { StatesTab } from "./states-tab"

type TabDef = { key: AddressAttributeTab; label: string; icon: LucideIcon }

// Adding a tab: append an entry here, add its key to `addressAttributeTabs` in
// router.tsx, and render it below. Each tab component owns its own data loading
// and list state, so nothing else changes.
const TABS: TabDef[] = [
  { key: "countries", label: "Countries", icon: Globe },
  { key: "states", label: "States", icon: MapIcon },
  { key: "districts", label: "Districts", icon: MapPin },
]

export function AddressAttributesPage() {
  const search = useSearch({ strict: false }) as { tab?: AddressAttributeTab }
  const tab: AddressAttributeTab = search.tab ?? "countries"

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <div className="rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          Additional attributes
        </div>
        <h1 className="mt-1 text-base font-semibold tracking-tight">
          Address attributes
        </h1>
      </div>

      {/* Each tab is a Link carrying ?tab= rather than a button flipping local
          state, so the tab is deep-linkable and survives back/forward. */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <Link
              key={t.key}
              to="/additional-attributes/address"
              search={{ tab: t.key }}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" />
              {t.label}
            </Link>
          )
        })}
      </div>

      {tab === "countries" && <CountriesTab />}
      {tab === "states" && <StatesTab />}
      {tab === "districts" && <DistrictsTab />}
    </div>
  )
}
