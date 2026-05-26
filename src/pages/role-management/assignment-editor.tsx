import * as React from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { listEmployees, type Employee } from "@/lib/employees"
import {
  WILDCARD_ALL,
  createAssignment,
  fetchAttributeOptions,
  getAssignment,
  getCatalog,
  getRole,
  isWildcardAll,
  listRoles,
  updateAssignment,
  type AssignmentAttribute,
  type AssignmentDetail,
  type AttributeSchemaItem,
  type AttributeTypeDef,
  type Catalog,
  type PickerOption,
  type RoleDetail,
  type ScreenDef,
} from "@/lib/rbac"

type AttrKey = string // `${screen_key}::${attribute_key}`

function attrKey(screenKey: string, attributeKey: string): AttrKey {
  return `${screenKey}::${attributeKey}`
}

export function AssignmentEditorPage() {
  const { assignmentId } = useParams({ strict: false }) as {
    assignmentId: string
  }
  const search = useSearch({ strict: false }) as {
    employee_id?: number
    role_id?: number
  }
  const navigate = useNavigate()
  const isCreate = assignmentId === "new"

  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [roles, setRoles] = React.useState<RoleDetail[]>([])
  const [employees, setEmployees] = React.useState<Employee[]>([])

  const [loadingShell, setLoadingShell] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Form state. For an existing assignment, `roleId` is locked to the saved
  // value because changing a role mid-flight would require re-validating all
  // attributes — easier to require a brand-new assignment.
  const [roleId, setRoleId] = React.useState<number | null>(
    isCreate ? search.role_id ?? null : null,
  )
  const [employeeId, setEmployeeId] = React.useState<number | null>(
    isCreate ? search.employee_id ?? null : null,
  )
  // (screen_key + attribute_key) -> value (scalar or array per attr def)
  const [values, setValues] = React.useState<Map<AttrKey, unknown>>(
    () => new Map(),
  )

  const [roleDetail, setRoleDetail] = React.useState<RoleDetail | null>(null)
  const [loadingRole, setLoadingRole] = React.useState(false)

  // Fetched option pools per attribute *type* (so refs:department only fetches
  // once across many screens that use it). Server returns the canonical
  // PickerOption[] shape — no field-mapping needed.
  const [optionsByType, setOptionsByType] = React.useState<
    Map<string, PickerOption[]>
  >(() => new Map())

  // --- Load shell (catalog, roles, employees, and existing assignment) ---
  React.useEffect(() => {
    let alive = true
    void (async () => {
      setLoadingShell(true)
      try {
        const [cat, roleRes, empRes, existing] = await Promise.all([
          getCatalog(),
          listRoles({ page: 1, pageSize: 100, status: "active" }),
          listEmployees({ page: 1, pageSize: 100, status: "active" }),
          isCreate ? Promise.resolve(null) : getAssignment(Number(assignmentId)),
        ])
        if (!alive) return
        setCatalog(cat)
        setRoles(roleRes.rows)
        setEmployees(empRes.rows)
        if (existing) {
          setRoleId(existing.role_id)
          setEmployeeId(existing.employee_id)
          setValues(buildValuesMap(existing))
        }
      } catch (err) {
        if (!alive) return
        toast.error("Couldn't load assignment editor", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (alive) setLoadingShell(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [assignmentId, isCreate])

  // --- Load full role detail (and its screens) whenever roleId changes ---
  React.useEffect(() => {
    if (roleId === null) {
      setRoleDetail(null)
      return
    }
    let alive = true
    setLoadingRole(true)
    void (async () => {
      try {
        const r = await getRole(roleId)
        if (!alive) return
        setRoleDetail(r)
      } catch (err) {
        if (!alive) return
        toast.error("Couldn't load role", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (alive) setLoadingRole(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [roleId])

  // --- Reset values when role changes during create (preserve when editing) ---
  React.useEffect(() => {
    if (!isCreate) return
    setValues(new Map())
  }, [roleId, isCreate])

  // --- Derive the list of attribute slots to render ----------------------
  type AttrSlot = {
    screen: ScreenDef
    attr: AttributeSchemaItem
    attrType: AttributeTypeDef
  }

  const slots: AttrSlot[] = React.useMemo(() => {
    if (!catalog || !roleDetail) return []
    const screenByKey = new Map(catalog.screens.map((s) => [s.key, s]))
    const typeByKey = new Map(catalog.attribute_types.map((t) => [t.key, t]))
    const out: AttrSlot[] = []
    for (const rs of roleDetail.screens) {
      const screen = screenByKey.get(rs.screen_key)
      if (!screen) continue
      for (const attr of screen.attributes) {
        const attrType = typeByKey.get(attr.type)
        if (!attrType) continue
        out.push({ screen, attr, attrType })
      }
    }
    return out
  }, [catalog, roleDetail])

  // Tracks attribute-type keys we've already kicked off a request for (success
  // OR failure). Lives in a ref so we don't re-render — and so the fetch
  // effect doesn't need `optionsByType` in its deps, which would form a loop
  // (each setOptionsByType re-runs the effect and re-fires the same call).
  const attemptedTypesRef = React.useRef<Set<string>>(new Set())

  // --- Fetch option pools for every distinct attribute type seen ---------
  React.useEffect(() => {
    if (slots.length === 0) return
    const need: string[] = []
    for (const s of slots) {
      if (!attemptedTypesRef.current.has(s.attrType.key)) {
        attemptedTypesRef.current.add(s.attrType.key) // claim before await
        need.push(s.attrType.key)
      }
    }
    if (need.length === 0) return
    let alive = true
    void (async () => {
      for (const key of need) {
        const t = slots.find((s) => s.attrType.key === key)?.attrType
        if (!t) continue
        try {
          const list = await fetchAttributeOptions(t)
          if (!alive) return
          setOptionsByType((prev) => new Map(prev).set(key, list))
        } catch (err) {
          if (!alive) return
          toast.error(`Couldn't load ${t.label} options`, {
            description:
              err instanceof ApiError ? err.message : "Please try again.",
          })
          // Sentinel-write an empty list so the picker renders a clear empty
          // Combobox instead of "Loading…" forever.
          setOptionsByType((prev) => new Map(prev).set(key, []))
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [slots])

  const setValue = (key: AttrKey, value: unknown) => {
    setValues((prev) => {
      const next = new Map(prev)
      if (value === null || value === undefined) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      return next
    })
  }

  // --- Save --------------------------------------------------------------

  const handleSave = async () => {
    if (employeeId === null) {
      toast.error("Pick an employee")
      return
    }
    if (roleId === null) {
      toast.error("Pick a role")
      return
    }
    if (!roleDetail) return

    // Build the attribute payload, filtering out empty values. Wildcard "all"
    // values pass straight through — required-checks are satisfied by them.
    const attributes: AssignmentAttribute[] = []
    for (const slot of slots) {
      const key = attrKey(slot.screen.key, slot.attr.key)
      const raw = values.get(key)
      if (isWildcardAll(raw)) {
        attributes.push({
          screen_key: slot.screen.key,
          attribute_key: slot.attr.key,
          value: raw,
        })
        continue
      }
      if (slot.attr.multi) {
        const arr = Array.isArray(raw) ? raw : []
        if (slot.attr.required && arr.length === 0) {
          toast.error(
            `"${slot.attr.label}" on "${slot.screen.label}" is required`,
          )
          return
        }
        if (arr.length > 0) {
          attributes.push({
            screen_key: slot.screen.key,
            attribute_key: slot.attr.key,
            value: arr,
          })
        }
      } else {
        if (
          slot.attr.required &&
          (raw === null || raw === undefined)
        ) {
          toast.error(
            `"${slot.attr.label}" on "${slot.screen.label}" is required`,
          )
          return
        }
        if (raw !== null && raw !== undefined) {
          attributes.push({
            screen_key: slot.screen.key,
            attribute_key: slot.attr.key,
            value: raw,
          })
        }
      }
    }

    setSaving(true)
    try {
      if (isCreate) {
        // The server replaces any existing assignment for this employee, so
        // "saved" is honest for both first-time and reassignment flows.
        await createAssignment({
          role_id: roleId,
          employee_id: employeeId,
          attributes,
        })
        toast.success("Role assignment saved.")
      } else {
        await updateAssignment(Number(assignmentId), { attributes })
        toast.success("Role assignment updated.")
      }
      navigate({ to: "/role-management/assignments" })
    } catch (err) {
      toast.error(
        isCreate ? "Couldn't create assignment" : "Couldn't save assignment",
        {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        },
      )
    } finally {
      setSaving(false)
    }
  }

  // --- Render ------------------------------------------------------------

  if (loadingShell || !catalog) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const roleOptions: ComboboxOption[] = roles.map((r) => ({
    value: r.id,
    label: r.name,
  }))
  const employeeOptions: ComboboxOption[] = employees.map((e) => ({
    value: e.id,
    label: e.emp_display_name,
    sublabel: e.emp_code,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div className="flex items-center gap-3">
          <Link to="/role-management/assignments">
            <Button variant="ghost" size="icon" aria-label="Back to assignments">
              <ArrowLeft />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {isCreate ? "New assignment" : "Edit assignment"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Pick an employee and a role, then fill in the per-screen
              attribute values that scope the role.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/role-management/assignments">
            <Button variant="ghost" size="sm" disabled={saving}>
              Cancel
            </Button>
          </Link>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {isCreate ? "Create assignment" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* --- Section 1: Pick role + employee --- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Role &amp; employee</h2>
        </header>
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              Role <span className="text-destructive">*</span>
            </Label>
            <Combobox
              value={roleId}
              options={roleOptions}
              onChange={(v) => setRoleId(v)}
              placeholder="Pick a role…"
              disabled={!isCreate}
            />
            {!isCreate && (
              <p className="text-xs text-muted-foreground">
                Role is locked. Create a new assignment to change it.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              Employee <span className="text-destructive">*</span>
            </Label>
            <Combobox
              value={employeeId}
              options={employeeOptions}
              onChange={(v) => setEmployeeId(v)}
              placeholder="Pick an employee…"
              disabled={!isCreate}
            />
            {!isCreate && (
              <p className="text-xs text-muted-foreground">
                Employee is locked. Create a new assignment to change it.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- Section 2: Attributes per screen --- */}
      <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Per-screen attributes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fill in the data scope for each screen this role grants. Required
            attributes are marked.
          </p>
        </header>
        <div className="px-4 py-4">
          {roleId === null ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
              Pick a role above to see its attribute slots.
            </div>
          ) : loadingRole || !roleDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
              This role's screens declare no attributes — nothing to scope.
            </div>
          ) : (
            <div className="space-y-4">
              {groupByScreen(slots).map(({ screen, screenSlots }) => (
                <ScreenAttrSection
                  key={screen.key}
                  screen={screen}
                  slots={screenSlots}
                  values={values}
                  optionsByType={optionsByType}
                  onChange={setValue}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function buildValuesMap(existing: AssignmentDetail): Map<AttrKey, unknown> {
  const out = new Map<AttrKey, unknown>()
  for (const a of existing.attributes) {
    out.set(attrKey(a.screen_key, a.attribute_key), a.value)
  }
  return out
}

function groupByScreen(
  slots: {
    screen: ScreenDef
    attr: AttributeSchemaItem
    attrType: AttributeTypeDef
  }[],
): {
  screen: ScreenDef
  screenSlots: {
    screen: ScreenDef
    attr: AttributeSchemaItem
    attrType: AttributeTypeDef
  }[]
}[] {
  const byKey = new Map<
    string,
    {
      screen: ScreenDef
      screenSlots: {
        screen: ScreenDef
        attr: AttributeSchemaItem
        attrType: AttributeTypeDef
      }[]
    }
  >()
  for (const s of slots) {
    const slot = byKey.get(s.screen.key) ?? {
      screen: s.screen,
      screenSlots: [],
    }
    slot.screenSlots.push(s)
    byKey.set(s.screen.key, slot)
  }
  return Array.from(byKey.values())
}

function ScreenAttrSection({
  screen,
  slots,
  values,
  optionsByType,
  onChange,
}: {
  screen: ScreenDef
  slots: {
    screen: ScreenDef
    attr: AttributeSchemaItem
    attrType: AttributeTypeDef
  }[]
  values: Map<AttrKey, unknown>
  optionsByType: Map<string, PickerOption[]>
  onChange: (key: AttrKey, value: unknown) => void
}) {
  return (
    <div className="rounded-md border">
      <header className="border-b bg-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{screen.label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {screen.key}
          </span>
        </div>
      </header>
      <div className="space-y-3 px-3 py-3">
        {slots.map(({ attr, attrType }) => {
          const key = attrKey(screen.key, attr.key)
          const raw = values.get(key)
          const pool = optionsByType.get(attrType.key) ?? []
          const options = pool.map((o) => ({
            value: o.id as number,
            label: o.label,
          }))
          const isAll = isWildcardAll(raw)
          return (
            <div key={attr.key} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>
                  {attr.label}
                  {attr.required && (
                    <span className="ml-0.5 text-destructive">*</span>
                  )}
                  <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
                    {attr.type}
                    {attr.multi ? " (multi)" : ""}
                  </span>
                </Label>
                {attr.allow_all && (
                  <AllToggle
                    on={isAll}
                    onToggle={(next) =>
                      onChange(key, next ? WILDCARD_ALL : null)
                    }
                  />
                )}
              </div>
              {isAll ? (
                <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Check className="size-3.5" />
                  All {attr.label.toLowerCase()} — unrestricted scope,
                  auto-includes new entries.
                </div>
              ) : attr.multi ? (
                <MultiPicker
                  options={options}
                  value={Array.isArray(raw) ? (raw as number[]) : []}
                  onChange={(next) => onChange(key, next)}
                  placeholder={
                    pool.length === 0 ? "Loading…" : "Add a value…"
                  }
                />
              ) : (
                <Combobox
                  value={typeof raw === "number" ? raw : null}
                  options={options}
                  onChange={(v) => onChange(key, v)}
                  placeholder={
                    pool.length === 0 ? "Loading…" : "Pick a value…"
                  }
                  clearLabel="Clear"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AllToggle({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-background text-muted-foreground hover:bg-accent/40",
      )}
      title={
        on
          ? "Click to pick specific values instead"
          : "Grant unrestricted scope on this attribute (includes future entries)"
      }
    >
      {on && <Check className="size-3" />}
      All
    </button>
  )
}

function MultiPicker({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: number; label: string }[]
  value: number[]
  onChange: (next: number[]) => void
  placeholder: string
}) {
  const selectedSet = new Set(value)
  const remaining = options.filter((o) => !selectedSet.has(o.value))
  const optionLabel = (v: number) =>
    options.find((o) => o.value === v)?.label ?? String(v)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No values yet.</span>
        ) : (
          value.map((v) => (
            <span
              key={v}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs font-medium",
              )}
            >
              <Check className="size-3 text-primary" />
              {optionLabel(v)}
              <button
                type="button"
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${optionLabel(v)}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <Combobox
        value={null}
        options={remaining}
        onChange={(v) => {
          if (v === null) return
          if (selectedSet.has(v)) return
          onChange([...value, v])
        }}
        placeholder={placeholder}
      />
    </div>
  )
}
