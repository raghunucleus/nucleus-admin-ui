import { Link, useSearch } from "@tanstack/react-router"
import {
  BadgeCheck,
  ClipboardCheck,
  GraduationCap,
  School,
  ScrollText,
  type LucideIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import type { StudentAttributeTab } from "@/router"
import { DiplomaBoardsTab } from "./diploma-boards-tab"
import { EntranceExamsTab } from "./entrance-exams-tab"
import { IndustryCertificationsTab } from "./industry-certifications-tab"
import { XiithBoardsTab } from "./xiith-boards-tab"
import { XthBoardsTab } from "./xth-boards-tab"

type TabDef = { key: StudentAttributeTab; label: string; icon: LucideIcon }

// Adding a tab: append an entry here, add its key to `studentAttributeTabs` in
// router.tsx, and render it in the switch below. Each tab component owns its
// own data loading and list state, so nothing else changes.
const TABS: TabDef[] = [
  {
    key: "industry-certification",
    label: "Industry Certification",
    icon: BadgeCheck,
  },
  {
    key: "entrance-exam",
    label: "Entrance Exam",
    icon: ClipboardCheck,
  },
  {
    key: "xth-board",
    label: "Xth Board",
    icon: School,
  },
  {
    key: "xiith-board",
    label: "XIIth Board",
    icon: GraduationCap,
  },
  {
    key: "diploma-board",
    label: "Diploma Board",
    icon: ScrollText,
  },
]

export function StudentAttributesPage() {
  const search = useSearch({ strict: false }) as { tab?: StudentAttributeTab }
  const tab: StudentAttributeTab = search.tab ?? "industry-certification"

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader title="Student attributes" />

      {/* Each tab is a Link carrying ?tab= rather than a button flipping local
          state, so the tab is deep-linkable and survives back/forward. */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <Link
              key={t.key}
              to="/additional-attributes/student"
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

      {tab === "industry-certification" && <IndustryCertificationsTab />}
      {tab === "entrance-exam" && <EntranceExamsTab />}
      {tab === "xth-board" && <XthBoardsTab />}
      {tab === "xiith-board" && <XiithBoardsTab />}
      {tab === "diploma-board" && <DiplomaBoardsTab />}
    </div>
  )
}
