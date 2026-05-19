import * as React from "react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Briefcase,
  ChevronRight,
  Database,
  GraduationCap,
  Home,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Users,
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

]

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const pathname = useLocation({ select: (l) => l.pathname })

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        {!collapsed && (
          <span className="truncate text-base font-semibold">Nucleus Admin</span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {nav.map((item) =>
          item.type === "leaf" ? (
            <LeafLink key={item.to} item={item} collapsed={collapsed} />
          ) : (
            <GroupItem
              key={item.key}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
              expandSidebar={() => setSidebarCollapsed(false)}
            />
          ),
        )}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          "flex h-12 items-center gap-2 border-t px-4 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
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

function LeafLink({ item, collapsed }: { item: NavLeaf; collapsed: boolean }) {
  const { icon: Icon, to, label, exact } = item
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        className: "bg-sidebar-accent text-sidebar-accent-foreground",
      }}
      inactiveProps={{
        className:
          "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      }}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function GroupItem({
  item,
  collapsed,
  pathname,
  expandSidebar,
}: {
  item: NavGroup
  collapsed: boolean
  pathname: string
  expandSidebar: () => void
}) {
  const isActiveBranch = item.children.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = React.useState(isActiveBranch)

  React.useEffect(() => {
    if (isActiveBranch) setOpen(true)
  }, [isActiveBranch])

  const { icon: Icon, label, children } = item

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
          "flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActiveBranch
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
      </button>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActiveBranch
            ? "text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRight
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-3 ml-4">
          {children.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              className="rounded-md px-3 py-1.5 text-sm transition-colors"
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground",
              }}
              inactiveProps={{
                className:
                  "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              }}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
