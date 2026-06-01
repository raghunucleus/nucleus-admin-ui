import * as React from "react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Briefcase,
  CalendarRange,
  ChevronRight,
  Database,
  GraduationCap,
  Home,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useUiStore } from "@/store/ui-store"

type NavLeaf = { type: "leaf"; to: string; label: string; icon: LucideIcon; exact?: boolean }
type NavGroup = {
  type: "group"
  key: string
  label: string
  icon: LucideIcon
  children: { to: string; label: string }[]
}
type NavItem = NavLeaf | NavGroup

const nav: NavItem[] = [
  { type: "leaf", to: "/", label: "Welcome", icon: Home, exact: true },
  { type: "leaf", to: "/migrations", label: "Migrations", icon: Database },
  { type: "leaf", to: "/admin-users", label: "Admin users", icon: Users },
  {
    type: "leaf",
    to: "/academic-holidays",
    label: "Academic holidays",
    icon: CalendarRange,
  },
  {
    type: "group",
    key: "masters",
    label: "Masters",
    icon: Layers,
    children: [
      { to: "/masters/admission-years", label: "Admission years" },
      { to: "/masters/degrees", label: "Degree" },
      { to: "/masters/departments", label: "Department" },
      { to: "/masters/semesters", label: "Semester" },
      { to: "/masters/regulations", label: "Regulation" },
      { to: "/masters/subjects", label: "Subject" },
      { to: "/masters/subject-types", label: "Subject Types" },
      { to: "/masters/programmes", label: "Programme" },
      { to: "/masters/programme-configuration", label: "Programme Configuration" },
    ],
  },
  {
    type: "group",
    key: "employees",
    label: "Employees",
    icon: Briefcase,
    children: [
      { to: "/employees/designations", label: "Designations" },
      { to: "/employees/all", label: "All Employees" },
      { to: "/employees/bulk-upload", label: "Emp Bulk upload" },
    ],
  },
  {
    type: "group",
    key: "students",
    label: "Students",
    icon: GraduationCap,
    children: [
      { to: "/students/all", label: "All Students" },
      { to: "/students/bulk-upload", label: "Students Bulk Upload" },
    ],
  },
  {
    type: "group",
    key: "guardians",
    label: "Guardians/Parents",
    icon: Users,
    children: [
      { to: "/guardians/all", label: "All Guardians" },
      { to: "/guardians/bulk-upload", label: "Guardian Bulk Upload" },
    ],
  },
  {
    type: "group",
    key: "role-management",
    label: "Role management",
    icon: ShieldCheck,
    children: [
      { to: "/role-management/roles", label: "Roles" },
      { to: "/role-management/assignments", label: "Role assignments" },
    ],
  },
]

type FilteredGroup = NavGroup & { children: { to: string; label: string }[] }
type FilteredItem = NavLeaf | FilteredGroup

function matches(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function filterNav(items: NavItem[], query: string): FilteredItem[] {
  const q = query.trim()
  if (!q) return items
  const result: FilteredItem[] = []
  for (const item of items) {
    if (item.type === "leaf") {
      if (matches(item.label, q)) result.push(item)
      continue
    }
    const groupMatches = matches(item.label, q)
    const matchedChildren = groupMatches
      ? item.children
      : item.children.filter((c) => matches(c.label, q))
    if (matchedChildren.length > 0) {
      result.push({ ...item, children: matchedChildren })
    }
  }
  return result
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const pathname = useLocation({ select: (l) => l.pathname })

  const [query, setQuery] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (collapsed && query) setQuery("")
  }, [collapsed, query])

  const filtered = React.useMemo(() => filterNav(nav, query), [query])
  const searching = query.trim().length > 0

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border/70 bg-gradient-to-b from-sidebar to-sidebar/95 text-sidebar-foreground shadow-sm transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border/70 px-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm ring-1 ring-primary/20">
          <Sparkles className="size-4" />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold leading-tight">Nucleus</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              Admin Console
            </span>
          </div>
        )}
      </div>

      <div className={cn("border-b border-sidebar-border/70 p-2", collapsed && "px-1.5")}>
        {collapsed ? (
          <button
            type="button"
            title="Search"
            onClick={() => {
              setSidebarCollapsed(false)
              requestAnimationFrame(() => searchInputRef.current?.focus())
            }}
            className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <Search className="size-4" />
          </button>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu..."
              className="h-9 w-full rounded-md border border-sidebar-border/70 bg-background/40 pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {filtered.length === 0 && searching ? (
          <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
            <Search className="size-5 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">No matches for</p>
            <p className="truncate text-xs font-medium text-foreground">"{query}"</p>
          </div>
        ) : (
          filtered.map((item) =>
            item.type === "leaf" ? (
              <LeafLink key={item.to} item={item} collapsed={collapsed} query={query} />
            ) : (
              <GroupItem
                key={item.key}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                expandSidebar={() => setSidebarCollapsed(false)}
                forceOpen={searching}
                query={query}
              />
            ),
          )
        )}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          "flex h-11 items-center gap-2 border-t border-sidebar-border/70 px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function LeafLink({
  item,
  collapsed,
  query,
}: {
  item: NavLeaf
  collapsed: boolean
  query: string
}) {
  const { icon: Icon, to, label, exact } = item
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        className:
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary",
      }}
      inactiveProps={{
        className:
          "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      }}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <span className="truncate">
          <HighlightedText text={label} query={query} />
        </span>
      )}
    </Link>
  )
}

function GroupItem({
  item,
  collapsed,
  pathname,
  expandSidebar,
  forceOpen,
  query,
}: {
  item: FilteredGroup
  collapsed: boolean
  pathname: string
  expandSidebar: () => void
  forceOpen: boolean
  query: string
}) {
  const isActiveBranch = item.children.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = React.useState(isActiveBranch)

  React.useEffect(() => {
    if (isActiveBranch) setOpen(true)
  }, [isActiveBranch])

  const { icon: Icon, label, children } = item
  const effectiveOpen = forceOpen || open

  if (collapsed) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => {
          expandSidebar()
          setOpen(true)
        }}
        className={cn(
          "relative flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActiveBranch
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {isActiveBranch && (
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={effectiveOpen}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActiveBranch
            ? "text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          <HighlightedText text={label} query={query} />
        </span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            effectiveOpen && "rotate-90",
          )}
        />
      </button>
      {effectiveOpen && (
        <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-2 py-1">
          {children.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              className={cn(
                "group relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              )}
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              }}
              inactiveProps={{
                className:
                  "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              }}
            >
              <span className="size-1 shrink-0 rounded-full bg-current opacity-40 transition-opacity group-hover:opacity-100" />
              <span className="truncate">
                <HighlightedText text={child.label} query={query} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
