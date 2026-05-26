import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Home,
  IdCard,
  LayoutGrid,
  Menu,
  Monitor,
  Search,
  Smartphone,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { ModuleDef, RolePlatform, ScreenDef } from "@/lib/rbac"

type SelectionEntry = {
  screen_key: string
  allowed_platforms: RolePlatform[]
}

/**
 * Read-only preview of what the employee side menu will render when this
 * role is the only one a user holds. Mirrors the layouts in
 * `nucleus-ui/.../employee-portal-layout.tsx` (web) and a representative
 * mobile drawer pattern, but lays them out side by side so the admin can
 * sanity-check both at a glance before saving.
 *
 * Pure derived view: nothing here writes back to the role state.
 */
export function RoleMenuPreview({
  open,
  onClose,
  roleName,
  modules,
  screens,
  selectedScreens,
}: {
  open: boolean
  onClose: () => void
  roleName: string
  modules: ReadonlyArray<ModuleDef>
  screens: ReadonlyArray<ScreenDef>
  /** What the builder currently has selected — screen_key → allowed_platforms */
  selectedScreens: SelectionEntry[]
}) {
  const selectionMap = React.useMemo(() => {
    const m = new Map<string, RolePlatform[]>()
    for (const s of selectedScreens) m.set(s.screen_key, s.allowed_platforms)
    return m
  }, [selectedScreens])

  const screenByKey = React.useMemo(() => {
    const m = new Map<string, ScreenDef>()
    for (const s of screens) m.set(s.key, s)
    return m
  }, [screens])

  // For each platform, group reachable screens by module in catalog order.
  const buildPlatformView = React.useCallback(
    (platform: RolePlatform) => {
      const groups: { module: ModuleDef; screens: ScreenDef[] }[] = []
      const orderedModules = [...modules].sort((a, b) => a.order - b.order)
      for (const mod of orderedModules) {
        const moduleScreens: ScreenDef[] = []
        for (const [key, allowedPlatforms] of selectionMap) {
          const def = screenByKey.get(key)
          if (!def) continue
          if (def.module_key !== mod.key) continue
          if (!allowedPlatforms.includes(platform)) continue
          if (!def.platforms.includes(platform)) continue
          // Web entries need a web_route, mobile entries need a mobile_route.
          if (platform === "web" && !def.web_route) continue
          if (platform === "mobile" && !def.mobile_route) continue
          moduleScreens.push(def)
        }
        if (moduleScreens.length > 0) {
          groups.push({ module: mod, screens: moduleScreens })
        }
      }
      return groups
    },
    [modules, screenByKey, selectionMap],
  )

  const webGroups = React.useMemo(() => buildPlatformView("web"), [
    buildPlatformView,
  ])
  const mobileGroups = React.useMemo(() => buildPlatformView("mobile"), [
    buildPlatformView,
  ])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[min(96vw,1100px)] max-h-[92vh] overflow-hidden",
            "rounded-xl border bg-background text-foreground shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <header className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <DialogPrimitive.Title className="text-sm font-semibold">
                Menu preview
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground">
                How {roleName ? `"${roleName}"` : "this role"} will appear in
                the employee web portal and mobile app, with current platform
                grants applied.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close preview"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="grid max-h-[78vh] grid-cols-1 gap-4 overflow-auto bg-muted/40 p-5 lg:grid-cols-2">
            <PreviewFrame
              icon={Monitor}
              title="Web portal"
              subtitle="nucleus-ui staff portal"
              emptyHint="No screens granted on web — the employee will see a Home-only sidebar."
              groups={webGroups}
              variant="web"
            />
            <PreviewFrame
              icon={Smartphone}
              title="Mobile app"
              subtitle="nucleus-employee-mobile"
              emptyHint="No screens granted on mobile — the employee will not see any mobile menu entries."
              groups={mobileGroups}
              variant="mobile"
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Users,
  Wallet,
  IdCard,
  Briefcase,
  LayoutGrid,
}

function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutGrid
}

type ToneName =
  | "violet"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "orange"

const MODULE_TONES: Record<ToneName, { bg: string; text: string }> = {
  violet: { bg: "bg-violet-500/12", text: "text-violet-500" },
  blue: { bg: "bg-blue-500/12", text: "text-blue-500" },
  emerald: { bg: "bg-emerald-500/12", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/14", text: "text-amber-500" },
  rose: { bg: "bg-rose-500/12", text: "text-rose-500" },
  cyan: { bg: "bg-cyan-500/12", text: "text-cyan-500" },
  orange: { bg: "bg-orange-500/12", text: "text-orange-500" },
}

const ICON_TONE: Record<string, ToneName> = {
  BookOpen: "violet",
  GraduationCap: "blue",
  ClipboardCheck: "emerald",
  Users: "cyan",
  Wallet: "amber",
  IdCard: "rose",
  Briefcase: "orange",
  LayoutGrid: "blue",
}

function toneFor(icon: string): ToneName {
  return ICON_TONE[icon] ?? "blue"
}

function PreviewFrame({
  icon: Icon,
  title,
  subtitle,
  emptyHint,
  groups,
  variant,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  emptyHint: string
  groups: { module: ModuleDef; screens: ScreenDef[] }[]
  variant: "web" | "mobile"
}) {
  const totalScreens = groups.reduce((n, g) => n + g.screens.length, 0)
  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            <div className="text-xs font-semibold">{title}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <div className="text-[10px] tabular-nums text-muted-foreground">
          {totalScreens} screen{totalScreens === 1 ? "" : "s"}
        </div>
      </div>
      {variant === "web" ? (
        <WebPreviewChrome groups={groups} emptyHint={emptyHint} />
      ) : (
        <MobilePreviewChrome groups={groups} emptyHint={emptyHint} />
      )}
    </div>
  )
}

function WebPreviewChrome({
  groups,
  emptyHint,
}: {
  groups: { module: ModuleDef; screens: ScreenDef[] }[]
  emptyHint: string
}) {
  return (
    <div className="flex h-[460px] bg-background">
      {/* Sidebar */}
      <aside className="flex w-44 shrink-0 flex-col border-r bg-card/40">
        <div className="flex h-10 items-center gap-2 border-b px-3">
          <div className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-primary to-secondary text-primary-foreground">
            <Briefcase className="size-3.5" />
          </div>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold">Nucleus</div>
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">
              Staff portal
            </div>
          </div>
        </div>
        <div className="border-b p-2">
          <div className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-[10px] text-muted-foreground">
            <Search className="size-3" />
            <span>Search menu</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
          <div className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-secondary px-2 py-1 text-[11px] font-medium text-primary-foreground">
            <Home className="size-3" />
            Home
          </div>
          {groups.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed bg-muted/20 px-2 py-3 text-center text-[10px] text-muted-foreground">
              {emptyHint}
            </div>
          ) : (
            groups.map(({ module, screens }) => (
              <WebSidebarModule
                key={module.key}
                module={module}
                screens={screens}
              />
            ))
          )}
        </nav>
      </aside>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b bg-card/60 px-3">
          <Menu className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <div className="grid size-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              EM
            </div>
          </div>
        </header>
        <WebDashboardBody groups={groups} />
      </div>
    </div>
  )
}

/**
 * Abstract dashboard mockup used as the preview body. Renders a greeting,
 * a row of module-tinted stat cards seeded from the role's modules, and a
 * pair of content panels. The point is to look like a polished employee
 * portal — not to show real data, which we don't have.
 */
function WebDashboardBody({
  groups,
}: {
  groups: { module: ModuleDef; screens: ScreenDef[] }[]
}) {
  // Up to three modules surface as stat cards so the body visually reflects
  // what the role actually grants. Falls back to a single neutral card when
  // the role has no web access.
  const cards = groups.slice(0, 3)

  return (
    <div className="scrollbar-themed relative flex-1 overflow-y-auto bg-muted/15">
      {/* Soft brand wash so the body doesn't look flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/[0.07] via-secondary/[0.03] to-transparent"
      />

      <div className="relative space-y-3 p-3">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div className="leading-tight">
            <div className="text-[11px] font-semibold">Good morning</div>
            <div className="text-[8px] text-muted-foreground">
              Here's what's on your plate today.
            </div>
          </div>
          <span className="rounded-full border bg-card/60 px-1.5 py-0.5 text-[7px] uppercase tracking-wider text-muted-foreground">
            Today
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-1.5">
          {cards.length > 0 ? (
            cards.map(({ module, screens }) => {
              const Icon = iconFor(module.icon)
              const tone = MODULE_TONES[toneFor(module.icon)]
              return (
                <div
                  key={module.key}
                  className="overflow-hidden rounded-md border bg-card/80 p-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-sm",
                        tone.bg,
                        tone.text,
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="text-[7px] text-muted-foreground">
                      {screens.length} screen{screens.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 text-[8px] font-semibold truncate">
                    {module.label}
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted/40">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        tone.bg,
                        "opacity-90",
                      )}
                      style={{
                        width: `${Math.min(100, 30 + screens.length * 18)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="col-span-3 rounded-md border border-dashed bg-card/40 px-2 py-3 text-center text-[8px] text-muted-foreground">
              This role has no web access — the dashboard would be mostly
              empty.
            </div>
          )}
        </div>

        {/* Two-column content panels */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Left: list panel — represents a typical list view */}
          <div className="rounded-md border bg-card/80 p-1.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[8px] font-semibold">Recent activity</span>
              <span className="text-[7px] text-muted-foreground">View all</span>
            </div>
            <div className="space-y-1">
              {[0.85, 0.7, 0.55, 0.4].map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="size-1 shrink-0 rounded-full bg-primary/50" />
                  <span
                    className="block h-1 rounded bg-muted-foreground/15"
                    style={{ width: `${w * 100}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: quick actions card — visually rich */}
          <div className="rounded-md border bg-gradient-to-br from-primary/10 via-card/80 to-secondary/10 p-1.5">
            <div className="pb-1 text-[8px] font-semibold">Quick actions</div>
            <div className="grid grid-cols-2 gap-1">
              {(cards.length > 0
                ? cards.slice(0, 4)
                : []
              ).map(({ module }) => {
                const Icon = iconFor(module.icon)
                const tone = MODULE_TONES[toneFor(module.icon)]
                return (
                  <div
                    key={module.key}
                    className="flex items-center gap-1 rounded-sm border bg-background/60 px-1 py-0.5"
                  >
                    <span
                      className={cn(
                        "grid size-3.5 place-items-center rounded-sm",
                        tone.bg,
                        tone.text,
                      )}
                    >
                      <Icon className="size-2" />
                    </span>
                    <span className="truncate text-[7px] font-medium">
                      {module.label}
                    </span>
                  </div>
                )
              })}
              {cards.length === 0 &&
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-3 rounded-sm border border-dashed bg-background/40"
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Wide row panel — table-like preview */}
        <div className="rounded-md border bg-card/80 p-1.5">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[8px] font-semibold">Today's schedule</span>
            <div className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              <span className="text-[7px] text-muted-foreground">Live</span>
            </div>
          </div>
          <div className="space-y-1">
            {[
              { time: "09:00", w: 0.6 },
              { time: "10:30", w: 0.45 },
              { time: "12:00", w: 0.7 },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-8 shrink-0 text-[7px] font-medium tabular-nums text-muted-foreground">
                  {row.time}
                </span>
                <span
                  className="block h-1.5 rounded bg-primary/25"
                  style={{ width: `${row.w * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function WebSidebarModule({
  module,
  screens,
}: {
  module: ModuleDef
  screens: ScreenDef[]
}) {
  const [open, setOpen] = React.useState(true)
  const Icon = iconFor(module.icon)
  const tone = MODULE_TONES[toneFor(module.icon)]
  return (
    <div className="pt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent/40"
      >
        <span
          className={cn(
            "grid size-5 place-items-center rounded-sm",
            tone.bg,
            tone.text,
          )}
        >
          <Icon className="size-3" />
        </span>
        <span className="flex-1 truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {module.label}
        </span>
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-1.5">
          {screens.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-foreground/75 hover:bg-accent/30"
            >
              <span className="size-1 shrink-0 rounded-full bg-foreground/25" />
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Two-pane employee mobile layout: a thin left rail of module icons and a
 * right pane showing the selected module's screens as a grid of tiles. Models
 * the Amazon Pay / Amazon-app pattern. See
 * [[project-employee-mobile-menu-pattern]] in memory.
 */
function MobilePreviewChrome({
  groups,
  emptyHint,
}: {
  groups: { module: ModuleDef; screens: ScreenDef[] }[]
  emptyHint: string
}) {
  // Selected module index in the rail. Auto-reset whenever the available
  // modules change (e.g. admin toggled platforms) so we never point at a
  // stale index.
  const [selectedIdx, setSelectedIdx] = React.useState(0)
  React.useEffect(() => {
    setSelectedIdx(0)
  }, [groups])
  const activeGroup =
    groups.length > 0
      ? groups[Math.min(selectedIdx, groups.length - 1)]
      : undefined

  return (
    <div className="flex h-[460px] items-center justify-center bg-muted/30 p-3">
      {/* Phone frame */}
      <div className="flex h-full w-60 flex-col overflow-hidden rounded-[24px] border-2 border-foreground/20 bg-background shadow-lg">
        {/* Status bar */}
        <div className="flex h-5 items-center justify-between border-b bg-card/60 px-3 text-[8px] text-muted-foreground">
          <span>9:41</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
        </div>
        {/* App header */}
        <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-card/40 px-3">
          <Briefcase className="size-3.5 text-primary" />
          <span className="text-[10px] font-semibold">Nucleus</span>
          <span className="ml-auto text-[8px] text-muted-foreground">
            {activeGroup?.module.label ?? "Menu"}
          </span>
        </div>

        {/* Two-pane body */}
        {groups.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3">
            <div className="rounded-md border border-dashed bg-muted/20 px-2 py-3 text-center text-[9px] text-muted-foreground">
              {emptyHint}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Left rail — module icons */}
            <nav className="flex w-12 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r bg-card/40 py-2">
              {groups.map((g, i) => {
                const Icon = iconFor(g.module.icon)
                const tone = MODULE_TONES[toneFor(g.module.icon)]
                const active = i === selectedIdx
                return (
                  <button
                    key={g.module.key}
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    title={g.module.label}
                    className={cn(
                      "relative flex w-full flex-col items-center gap-0.5 px-1 py-1 transition-colors",
                      active ? "" : "opacity-70 hover:opacity-100",
                    )}
                  >
                    {/* Active indicator bar on the inside edge */}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-l-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-lg transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : cn(tone.bg, tone.text),
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span
                      className={cn(
                        "max-w-full truncate text-[7px] font-medium leading-tight",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {g.module.label}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Right pane — selected module's screens as icon tiles */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
              {activeGroup && (
                <MobileModuleDetail group={activeGroup} />
              )}
            </div>
          </div>
        )}

        {/* Home indicator */}
        <div className="flex h-3 items-end justify-center pb-1">
          <span className="h-0.5 w-12 rounded-full bg-foreground/30" />
        </div>
      </div>
    </div>
  )
}

function MobileModuleDetail({
  group,
}: {
  group: { module: ModuleDef; screens: ScreenDef[] }
}) {
  const Icon = iconFor(group.module.icon)
  const tone = MODULE_TONES[toneFor(group.module.icon)]
  return (
    <>
      {/* Module banner */}
      <div className="flex items-center gap-1.5 border-b bg-muted/30 px-2.5 py-2">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-md",
            tone.bg,
            tone.text,
          )}
        >
          <Icon className="size-3" />
        </span>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold">{group.module.label}</div>
          <div className="text-[7px] text-muted-foreground">
            {group.screens.length} screen{group.screens.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Sub-icon grid */}
      <div className="scrollbar-themed flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {group.screens.map((s) => (
            <div
              key={s.key}
              className="flex flex-col items-center gap-1 rounded-md border bg-card/40 px-1 py-1.5 text-center"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-md",
                  tone.bg,
                  tone.text,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span
                className="line-clamp-2 text-[7.5px] font-medium leading-tight text-foreground/85"
                title={s.label}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
