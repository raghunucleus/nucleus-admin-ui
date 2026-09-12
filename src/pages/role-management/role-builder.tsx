import * as React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Monitor,
  Save,
  Search,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  createRole,
  getCatalog,
  getRole,
  updateRole,
  type Catalog,
  type RoleDetail,
  type RolePlatform,
  type RoleTypeDef,
  type ScreenDef,
} from "@/lib/rbac"
import { RoleMenuPreview } from "@/pages/role-management/role-menu-preview"

type RoleScreenSelection = {
  screen_key: string
  allowed_actions: string[] // subset of ScreenDef.actions
  /** Subset of the catalog screen's platforms this role grants. */
  allowed_platforms: RolePlatform[]
}

/**
 * Narrow a catalog screen's platforms (which can include the legacy `'both'`
 * marker) down to the concrete values storable on a role.
 */
function catalogRolePlatforms(def: ScreenDef): RolePlatform[] {
  return def.platforms.filter(
    (p): p is RolePlatform => p === "web" || p === "mobile",
  )
}

/**
 * Stable color tokens applied to role-type chips so the same role type reads
 * identically across the builder. The palette is intentionally muted — these
 * are informational tags, not call-to-action.
 */
const ROLE_TYPE_TONES = [
  "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300",
  "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  "bg-teal-500/10 text-teal-700 border-teal-500/30 dark:text-teal-300",
  "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300",
  "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/30 dark:text-fuchsia-300",
  "bg-cyan-500/10 text-cyan-700 border-cyan-500/30 dark:text-cyan-300",
]

function roleTypeTone(index: number): string {
  return ROLE_TYPE_TONES[index % ROLE_TYPE_TONES.length]
}

/**
 * Suggest a stable role code from a free-text name. Strips diacritics, keeps
 * only [A-Za-z0-9_-], collapses runs of separators, uppercases. The result is
 * a suggestion only — the user can overwrite it.
 */
function suggestCode(name: string): string {
  // ̀-ͯ covers the Unicode "Combining Diacritical Marks" block —
  // these are the marks NFKD splits accented characters into.
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toUpperCase()
}

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/

export function RoleBuilderPage() {
  const { roleId } = useParams({ strict: false }) as { roleId: string }
  const navigate = useNavigate()
  const isCreate = roleId === "new"

  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [code, setCode] = React.useState("")
  // Track whether the user has typed in the code field; until then we mirror
  // a slug derived from the name so first-time creation needs only one input.
  const codeTouchedRef = React.useRef(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [selectedRoleTypes, setSelectedRoleTypes] = React.useState<string[]>([])
  const [screens, setScreens] = React.useState<RoleScreenSelection[]>([])

  // UI state for the screens picker.
  const [screenFilter, setScreenFilter] = React.useState("")
  const [showOnlySelected, setShowOnlySelected] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  // Load catalog (always) + existing role if editing.
  React.useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      try {
        const [cat, role] = await Promise.all([
          getCatalog(),
          isCreate ? Promise.resolve(null) : getRole(Number(roleId)),
        ])
        if (!alive) return
        setCatalog(cat)
        if (role) {
          setCode(role.code)
          codeTouchedRef.current = true
          setName(role.name)
          setDescription(role.description ?? "")
          setSelectedRoleTypes(role.role_type_keys)
          // Normalise legacy roles whose rows pre-date allowed_platforms —
          // default to the catalog's full platform set so the row matches the
          // pre-change behaviour (granted on every platform the catalog
          // declares).
          const screenLookup = new Map(cat.screens.map((s) => [s.key, s]))
          setScreens(
            role.screens.map((s) => ({
              screen_key: s.screen_key,
              allowed_actions: s.allowed_actions ?? [],
              allowed_platforms:
                s.allowed_platforms && s.allowed_platforms.length > 0
                  ? s.allowed_platforms
                  : (
                      screenLookup
                        .get(s.screen_key)
                        ?.platforms.filter(
                          (p): p is RolePlatform =>
                            p === "web" || p === "mobile",
                        ) ?? []
                    ),
            })),
          )
        }
      } catch (err) {
        if (!alive) return
        toast.error(
          isCreate ? "Couldn't load catalog" : "Couldn't load role",
          {
            description:
              err instanceof ApiError ? err.message : "Please try again.",
          },
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [isCreate, roleId])

  // Stable tone index per role-type key — derived from the catalog so the same
  // role type always gets the same color regardless of insertion order.
  const roleTypeToneByKey = React.useMemo(() => {
    const map = new Map<string, string>()
    if (catalog) {
      catalog.role_types.forEach((rt, i) => {
        map.set(rt.key, roleTypeTone(i))
      })
    }
    return map
  }, [catalog])

  const roleTypeByKey = React.useMemo(() => {
    const map = new Map<string, RoleTypeDef>()
    if (catalog) for (const rt of catalog.role_types) map.set(rt.key, rt)
    return map
  }, [catalog])

  // Available screens = catalog screens whose role_type_keys intersects the
  // current selection. Memoised so the tree below doesn't re-filter on every
  // keystroke.
  const availableScreens = React.useMemo(() => {
    if (!catalog) return [] as ScreenDef[]
    const allowed = new Set(selectedRoleTypes)
    if (allowed.size === 0) return []
    return catalog.screens.filter((s) =>
      s.role_type_keys.some((k) => allowed.has(k)),
    )
  }, [catalog, selectedRoleTypes])

  // Per-role-type: how many catalog screens does it contribute? Drives the
  // "X screens" hint on each role-type card so admins know what to expect
  // before they pick it.
  const screensPerRoleType = React.useMemo(() => {
    const counts = new Map<string, number>()
    if (catalog) {
      for (const s of catalog.screens) {
        for (const rt of s.role_type_keys) {
          counts.set(rt, (counts.get(rt) ?? 0) + 1)
        }
      }
    }
    return counts
  }, [catalog])

  // Keep the screen selection in sync: drop selections whose screen is no
  // longer available after toggling a role type.
  React.useEffect(() => {
    if (!catalog) return
    const availableKeys = new Set(availableScreens.map((s) => s.key))
    setScreens((prev) => prev.filter((s) => availableKeys.has(s.screen_key)))
  }, [availableScreens, catalog])

  const screenByKey = React.useMemo(() => {
    const map = new Map<string, ScreenDef>()
    if (catalog) for (const s of catalog.screens) map.set(s.key, s)
    return map
  }, [catalog])

  const selectedScreenMap = React.useMemo(() => {
    const map = new Map<string, RoleScreenSelection>()
    for (const s of screens) map.set(s.screen_key, s)
    return map
  }, [screens])

  // Filtered + grouped screens for the picker. Search matches label or key;
  // "selected only" hides every screen that isn't currently in the selection.
  const visibleScreensByModule = React.useMemo(() => {
    const q = screenFilter.trim().toLowerCase()
    const selectedKeys = new Set(selectedRoleTypes)
    const filtered = availableScreens.filter((s) => {
      if (showOnlySelected && !selectedScreenMap.has(s.key)) return false
      if (!q) return true
      const hay = `${s.label} ${s.key} ${s.description ?? ""}`.toLowerCase()
      if (hay.includes(q)) return true
      // Allow searching by role-type label or key (e.g. "hod").
      const origin = s.role_type_keys.filter((k) => selectedKeys.has(k))
      return origin.some((k) => {
        const def = roleTypeByKey.get(k)
        return (
          k.toLowerCase().includes(q) ||
          (def?.label.toLowerCase().includes(q) ?? false)
        )
      })
    })
    const map = new Map<string, ScreenDef[]>()
    for (const s of filtered) {
      const list = map.get(s.module_key) ?? []
      list.push(s)
      map.set(s.module_key, list)
    }
    return map
  }, [
    availableScreens,
    screenFilter,
    showOnlySelected,
    selectedScreenMap,
    selectedRoleTypes,
    roleTypeByKey,
  ])

  // Per-role-type breakdown of CURRENTLY selected screens — drives the review
  // section so admins can see at a glance which role type contributed what.
  const selectedScreensByRoleType = React.useMemo(() => {
    const map = new Map<string, number>()
    if (!catalog) return map
    const sel = new Set(selectedRoleTypes)
    for (const s of screens) {
      const def = screenByKey.get(s.screen_key)
      if (!def) continue
      for (const k of def.role_type_keys) {
        if (sel.has(k)) map.set(k, (map.get(k) ?? 0) + 1)
      }
    }
    return map
  }, [screens, screenByKey, selectedRoleTypes, catalog])

  // --- Mutations ----------------------------------------------------------

  const toggleRoleType = (key: string) => {
    setSelectedRoleTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const toggleScreen = (def: ScreenDef) => {
    setScreens((prev) => {
      const existingIdx = prev.findIndex((s) => s.screen_key === def.key)
      if (existingIdx >= 0) {
        // Deselect: remove from the list.
        return prev.filter((_, i) => i !== existingIdx)
      }
      // Select: include with all actions and all catalog platforms by default.
      return [
        ...prev,
        {
          screen_key: def.key,
          allowed_actions: [...def.actions],
          allowed_platforms: catalogRolePlatforms(def),
        },
      ]
    })
  }

  const toggleScreenPlatform = (def: ScreenDef, platform: RolePlatform) => {
    // Check the guard OUTSIDE the setter — React strict mode invokes state
    // updater functions twice in dev, which would fire any side effect
    // (toast) inside them twice. Side effects belong in the event handler.
    const current = screens.find((s) => s.screen_key === def.key)
    if (
      current &&
      current.allowed_platforms.includes(platform) &&
      current.allowed_platforms.length === 1
    ) {
      toast.info("At least one platform must be selected.", {
        description: "Deselect the screen entirely to remove it.",
      })
      return
    }
    setScreens((prev) =>
      prev.map((s) => {
        if (s.screen_key !== def.key) return s
        const has = s.allowed_platforms.includes(platform)
        const next = has
          ? s.allowed_platforms.filter((p) => p !== platform)
          : [...s.allowed_platforms, platform]
        return { ...s, allowed_platforms: next }
      }),
    )
  }

  const toggleScreenAction = (def: ScreenDef, action: string) => {
    const current = screens.find((s) => s.screen_key === def.key)
    if (
      current &&
      current.allowed_actions.includes(action) &&
      current.allowed_actions.length === 1
    ) {
      toast.info("At least one action must be selected.", {
        description: "Deselect the screen entirely to remove it.",
      })
      return
    }
    setScreens((prev) =>
      prev.map((s) => {
        if (s.screen_key !== def.key) return s
        const has = s.allowed_actions.includes(action)
        const next = has
          ? s.allowed_actions.filter((a) => a !== action)
          : [...s.allowed_actions, action]
        return { ...s, allowed_actions: next }
      }),
    )
  }

  /** Select every screen in a module that isn't already selected. */
  const selectAllInModule = (defs: ScreenDef[]) => {
    setScreens((prev) => {
      const have = new Set(prev.map((s) => s.screen_key))
      const additions: RoleScreenSelection[] = []
      for (const def of defs) {
        if (!have.has(def.key)) {
          additions.push({
            screen_key: def.key,
            allowed_actions: [...def.actions],
            allowed_platforms: catalogRolePlatforms(def),
          })
        }
      }
      return additions.length ? [...prev, ...additions] : prev
    })
  }

  /** Deselect every screen in the given module. */
  const clearAllInModule = (defs: ScreenDef[]) => {
    const keys = new Set(defs.map((d) => d.key))
    setScreens((prev) => prev.filter((s) => !keys.has(s.screen_key)))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Role name is required")
      return
    }
    const trimmedCode = code.trim()
    if (!trimmedCode) {
      toast.error("Role code is required")
      return
    }
    if (trimmedCode.length < 2 || trimmedCode.length > 32) {
      toast.error("Role code must be 2–32 characters")
      return
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      toast.error('Role code may only contain letters, digits, "_" and "-"')
      return
    }
    if (selectedRoleTypes.length === 0) {
      toast.error("Pick at least one role type")
      return
    }
    if (screens.length === 0) {
      toast.error("Pick at least one screen")
      return
    }
    // Ensure every selected screen has at least one action.
    for (const s of screens) {
      if (s.allowed_actions.length === 0) {
        const def = screenByKey.get(s.screen_key)
        toast.error(
          `Pick at least one action for "${def?.label ?? s.screen_key}"`,
        )
        return
      }
      if (s.allowed_platforms.length === 0) {
        const def = screenByKey.get(s.screen_key)
        toast.error(
          `Pick at least one platform (Web/Mobile) for "${def?.label ?? s.screen_key}"`,
        )
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        code: trimmedCode,
        name: name.trim(),
        description: description.trim() || null,
        role_type_keys: selectedRoleTypes,
        screens,
      }
      let saved: RoleDetail
      if (isCreate) {
        saved = await createRole(payload)
      } else {
        saved = await updateRole(Number(roleId), payload)
      }
      toast.success(`${saved.name} ${isCreate ? "created" : "saved"}.`)
      navigate({ to: "/role-management/roles" })
    } catch (err) {
      toast.error(isCreate ? "Couldn't create role" : "Couldn't save role", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to roles">
          <Link to="/role-management/roles" />
        </BackLink>
      }
      title={isCreate ? "New role" : name || "Edit role"}
    />
  )

  if (loading || !catalog) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-2">
        {header}
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const totalActions = screens.reduce(
    (sum, s) => sum + s.allowed_actions.length,
    0,
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      {header}

      {/* --- Header --- */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={saving || screens.length === 0}
            title={
              screens.length === 0
                ? "Pick at least one screen to preview"
                : "Preview how the side menu will render for this role"
            }
          >
            <Eye />
            Preview menu
          </Button>
          <Link to="/role-management/roles">
            <Button variant="ghost" size="sm" disabled={saving}>
              Cancel
            </Button>
          </Link>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {isCreate ? "Create role" : "Save changes"}
          </Button>
        </div>
      </div>

      <RoleMenuPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        roleName={name.trim()}
        modules={catalog.modules}
        screens={catalog.screens}
        selectedScreens={screens}
      />

      {/* --- Section 1: Basics --- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Basics</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Name and the role types this role combines.
          </p>
        </header>
        <div className="space-y-5 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="role-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => {
                  const next = e.target.value
                  setName(next)
                  // Auto-suggest code from the name until the user hand-edits it.
                  if (!codeTouchedRef.current) setCode(suggestCode(next))
                }}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-code"
                value={code}
                onChange={(e) => {
                  codeTouchedRef.current = true
                  setCode(e.target.value)
                }}
                autoComplete="off"
                maxLength={32}
                className="font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Unique 2–32 char identifier (A–Z, 0–9, "_" or "-").
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <Label>
                Role types <span className="text-destructive">*</span>
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedRoleTypes.length} selected · {availableScreens.length}{" "}
                screen{availableScreens.length === 1 ? "" : "s"} available
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.role_types.map((rt) => {
                const checked = selectedRoleTypes.includes(rt.key)
                const tone = roleTypeToneByKey.get(rt.key) ?? ""
                const screenCount = screensPerRoleType.get(rt.key) ?? 0
                return (
                  <button
                    key={rt.key}
                    type="button"
                    onClick={() => toggleRoleType(rt.key)}
                    className={cn(
                      "group flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-primary/40 hover:bg-accent/40",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded border-2 transition-colors",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/50 bg-background group-hover:border-primary/60",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-semibold",
                            tone,
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-current opacity-70"
                          />
                          {rt.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums">
                          {screenCount} screen{screenCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {rt.description && (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {rt.description}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 2: Screens --- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Screens &amp; actions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick the screens this role grants and the actions allowed on
              each. Each screen is tagged with the role type that contributes
              it.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="font-semibold text-foreground">
                {screens.length}
              </span>
              /{availableScreens.length} screens
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-semibold text-foreground">
                {totalActions}
              </span>{" "}
              action{totalActions === 1 ? "" : "s"}
            </span>
          </div>
        </header>
        <div className="space-y-3 px-4 py-4">
          {selectedRoleTypes.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
              Pick at least one role type above to see available screens.
            </div>
          ) : availableScreens.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
              No screens are available for the selected role types.
            </div>
          ) : (
            <>
              {/* Search + filter toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={screenFilter}
                    onChange={(e) => setScreenFilter(e.target.value)}
                    placeholder="Search screens by name, key, or role type…"
                    className="pl-8"
                    autoComplete="off"
                  />
                  {screenFilter && (
                    <button
                      type="button"
                      onClick={() => setScreenFilter("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnlySelected((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    showOnlySelected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <Check className="size-3.5" />
                  Selected only ({screens.length})
                </button>
              </div>

              {/* Module groups */}
              {catalog.modules
                .filter((m) => visibleScreensByModule.has(m.key))
                .sort((a, b) => a.order - b.order)
                .map((mod) => {
                  const moduleScreens =
                    visibleScreensByModule.get(mod.key) ?? []
                  // selectedCount + total based on FULL available set so the
                  // tally reflects reality, not the filtered view.
                  const allInModule = availableScreens.filter(
                    (s) => s.module_key === mod.key,
                  )
                  const selectedInModule = allInModule.filter((s) =>
                    selectedScreenMap.has(s.key),
                  ).length
                  return (
                    <ModuleGroup
                      key={mod.key}
                      label={mod.label}
                      screens={moduleScreens}
                      moduleScreenTotal={allInModule.length}
                      moduleSelectedCount={selectedInModule}
                      selectedScreenMap={selectedScreenMap}
                      selectedRoleTypes={selectedRoleTypes}
                      roleTypeByKey={roleTypeByKey}
                      roleTypeToneByKey={roleTypeToneByKey}
                      onToggleScreen={toggleScreen}
                      onToggleScreenAction={toggleScreenAction}
                      onToggleScreenPlatform={toggleScreenPlatform}
                      onSelectAll={() => selectAllInModule(allInModule)}
                      onClearAll={() => clearAllInModule(allInModule)}
                    />
                  )
                })}

              {visibleScreensByModule.size === 0 && (
                <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                  No screens match the current filter.
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* --- Section 3: Review --- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Review</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Summary of the composed role, broken down by contributing role
            type.
          </p>
        </header>
        <div className="space-y-4 px-4 py-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Role types
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {selectedRoleTypes.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Screens
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {screens.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Actions granted
              </dt>
              <dd className="mt-1 font-medium tabular-nums">{totalActions}</dd>
            </div>
          </dl>

          {selectedRoleTypes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3" />
                Contribution by role type
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRoleTypes.map((k) => {
                  const def = roleTypeByKey.get(k)
                  if (!def) return null
                  const tone = roleTypeToneByKey.get(k) ?? ""
                  const count = selectedScreensByRoleType.get(k) ?? 0
                  return (
                    <span
                      key={k}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                        tone,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current opacity-70"
                      />
                      {def.label}
                      <span className="rounded-full bg-background/60 px-1.5 py-px text-[10px] font-semibold tabular-nums">
                        {count}
                      </span>
                    </span>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Counts reflect screens reachable via each role type. A screen
                shared by multiple role types is counted under each.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ModuleGroup({
  label,
  screens,
  moduleScreenTotal,
  moduleSelectedCount,
  selectedScreenMap,
  selectedRoleTypes,
  roleTypeByKey,
  roleTypeToneByKey,
  onToggleScreen,
  onToggleScreenAction,
  onToggleScreenPlatform,
  onSelectAll,
  onClearAll,
}: {
  label: string
  screens: ScreenDef[]
  moduleScreenTotal: number
  moduleSelectedCount: number
  selectedScreenMap: Map<string, RoleScreenSelection>
  selectedRoleTypes: string[]
  roleTypeByKey: Map<string, RoleTypeDef>
  roleTypeToneByKey: Map<string, string>
  onToggleScreen: (def: ScreenDef) => void
  onToggleScreenAction: (def: ScreenDef, action: string) => void
  onToggleScreenPlatform: (def: ScreenDef, platform: RolePlatform) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  const [open, setOpen] = React.useState(true)
  const allSelected =
    moduleScreenTotal > 0 && moduleSelectedCount === moduleScreenTotal

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 rounded-t-md bg-muted/40 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {moduleSelectedCount}/{moduleScreenTotal}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
              "border-input bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              "disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-muted-foreground",
            )}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={moduleSelectedCount === 0}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
              "border-input bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              "disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-muted-foreground",
            )}
          >
            Clear
          </button>
        </div>
      </div>
      {open && (
        <div className="divide-y">
          {screens.map((def) => {
            const selected = selectedScreenMap.get(def.key)
            return (
              <ScreenRow
                key={def.key}
                def={def}
                selected={selected}
                selectedRoleTypes={selectedRoleTypes}
                roleTypeByKey={roleTypeByKey}
                roleTypeToneByKey={roleTypeToneByKey}
                onToggleScreen={onToggleScreen}
                onToggleAction={onToggleScreenAction}
                onTogglePlatform={onToggleScreenPlatform}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ScreenRow({
  def,
  selected,
  selectedRoleTypes,
  roleTypeByKey,
  roleTypeToneByKey,
  onToggleScreen,
  onToggleAction,
  onTogglePlatform,
}: {
  def: ScreenDef
  selected: RoleScreenSelection | undefined
  selectedRoleTypes: string[]
  roleTypeByKey: Map<string, RoleTypeDef>
  roleTypeToneByKey: Map<string, string>
  onToggleScreen: (def: ScreenDef) => void
  onToggleAction: (def: ScreenDef, action: string) => void
  onTogglePlatform: (def: ScreenDef, platform: RolePlatform) => void
}) {
  const isSelected = !!selected
  // Intersection of selected role types and screen.role_type_keys — i.e. the
  // role types that make THIS screen reachable for the current composition.
  const originRoleTypes = React.useMemo(() => {
    const sel = new Set(selectedRoleTypes)
    return def.role_type_keys.filter((k) => sel.has(k))
  }, [def.role_type_keys, selectedRoleTypes])

  const allActionsOn =
    !!selected && selected.allowed_actions.length === def.actions.length

  const toggleAllActions = () => {
    if (!selected) return
    // If all on → turn all off would leave the screen with zero actions, which
    // is invalid. Instead, toggling "all" off means deselect the entire screen.
    if (allActionsOn) {
      onToggleScreen(def)
      return
    }
    // Turn on every missing action.
    for (const a of def.actions) {
      if (!selected.allowed_actions.includes(a)) onToggleAction(def, a)
    }
  }

  return (
    <div
      className={cn(
        "px-3 py-2.5 transition-colors",
        isSelected && "bg-primary/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleScreen(def)}
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded border-2 transition-colors",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 bg-background hover:border-primary/60",
          )}
          aria-label={isSelected ? "Deselect screen" : "Select screen"}
        >
          {isSelected && <Check className="size-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => onToggleScreen(def)}
              className="text-sm font-medium text-foreground hover:underline underline-offset-4"
            >
              {def.label}
            </button>
            {/* Role-type origin chips: which selected role type(s) make this
                screen available. Always shown so admins can audit the source. */}
            {originRoleTypes.map((k) => {
              const rt = roleTypeByKey.get(k)
              if (!rt) return null
              const tone = roleTypeToneByKey.get(k) ?? ""
              return (
                <span
                  key={k}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    tone,
                  )}
                  title={`Available because role type "${rt.label}" is selected`}
                >
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-current opacity-70"
                  />
                  {rt.label}
                </span>
              )
            })}
            {def.platforms.includes("web") && (
              <PlatformToggle
                icon={Monitor}
                label="Web"
                interactive={isSelected}
                on={!selected || selected.allowed_platforms.includes("web")}
                onClick={
                  isSelected ? () => onTogglePlatform(def, "web") : undefined
                }
                title={
                  isSelected
                    ? selected!.allowed_platforms.includes("web")
                      ? "Click to remove web from this role"
                      : "Click to grant web for this role"
                    : "This screen is available on web"
                }
              />
            )}
            {def.platforms.includes("mobile") && (
              <PlatformToggle
                icon={Smartphone}
                label="Mobile"
                interactive={isSelected}
                on={!selected || selected.allowed_platforms.includes("mobile")}
                onClick={
                  isSelected
                    ? () => onTogglePlatform(def, "mobile")
                    : undefined
                }
                title={
                  isSelected
                    ? selected!.allowed_platforms.includes("mobile")
                      ? "Click to remove mobile from this role"
                      : "Click to grant mobile for this role"
                    : "This screen is available on mobile"
                }
              />
            )}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {def.key}
            </span>
          </div>
          {def.description && (
            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {def.description}
            </div>
          )}
          {isSelected && def.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Actions
              </span>
              {def.actions.map((action) => {
                const on = selected!.allowed_actions.includes(action)
                const isLast = on && selected!.allowed_actions.length === 1
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => onToggleAction(def, action)}
                    title={
                      isLast
                        ? "At least one action must remain selected. Deselect the screen entirely to remove it."
                        : undefined
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent/40",
                    )}
                  >
                    {on && <Check className="size-3" />}
                    {action}
                  </button>
                )
              })}
              {def.actions.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAllActions}
                  className="ml-1 rounded-md border border-dashed border-input px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  title={allActionsOn ? "Deselect screen" : "Select all actions"}
                >
                  {allActionsOn ? "Deselect screen" : "All actions"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Platform chip. When `interactive` is true (i.e. the screen is selected on
 * the role), the chip becomes a toggle: filled when granted, outlined and
 * muted when withheld. When false, it renders as a read-only catalog label
 * — same look as before.
 */
function PlatformToggle({
  icon: Icon,
  label,
  on,
  interactive,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  on: boolean
  interactive: boolean
  onClick?: () => void
  title?: string
}) {
  if (!interactive) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        title={title}
      >
        <Icon className="size-3" />
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-dashed border-input bg-background text-muted-foreground line-through hover:bg-accent/40 hover:text-foreground",
      )}
      aria-pressed={on}
    >
      <Icon className="size-3" />
      {label}
    </button>
  )
}
