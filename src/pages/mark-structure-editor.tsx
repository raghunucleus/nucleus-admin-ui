import * as React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getRegulation, type Regulation } from "@/lib/regulations"
import {
  MARK_RULE_KINDS,
  MARK_RULE_LABELS,
  getMarkStructure,
  saveMarkStructure,
  type MarkRule,
  type MarkRuleKind,
  type MarkStructureL1Component,
  type MarkStructureL2Item,
  type SaveMarkStructureInput,
} from "@/lib/subject-type-mark-structures"
import { listSubjectTypes, type SubjectType } from "@/lib/subject-types"

// Editor draft mirrors the API shape but holds string-typed numbers so users
// can type fractions/blanks without React clobbering their input.
type DraftInput = { code: string; name: string; max_marks: string; weight: string }
type DraftRule =
  | { kind: "direct" }
  | { kind: "sum"; inputs: DraftInput[] }
  | { kind: "best_k_of_n"; k: string; inputs: DraftInput[] }
  | { kind: "rank_weighted"; inputs: DraftInput[] }

type DraftL2 = {
  code: string
  name: string
  max_marks: string
  rule: DraftRule
}

type DraftL1 = {
  code: string
  name: string
  max_marks: string
  items: DraftL2[]
}

type Draft = {
  max_marks: string
  components: DraftL1[]
}

const EMPTY_INPUT = (): DraftInput => ({
  code: "",
  name: "",
  max_marks: "",
  weight: "",
})

const EMPTY_L2 = (): DraftL2 => ({
  code: "",
  name: "",
  max_marks: "",
  rule: { kind: "direct" },
})

const EMPTY_L1 = (): DraftL1 => ({
  code: "",
  name: "",
  max_marks: "",
  items: [],
})

const EMPTY_DRAFT = (): Draft => ({
  max_marks: "",
  components: [EMPTY_L1()],
})

function toDraft(components: MarkStructureL1Component[], total: number): Draft {
  return {
    max_marks: String(total),
    components: components.map((c) => ({
      code: c.code,
      name: c.name ?? "",
      max_marks: String(c.max_marks),
      items: c.items.map((it) => ({
        code: it.code,
        name: it.name ?? "",
        max_marks: String(it.max_marks),
        rule: ruleToDraft(it.rule),
      })),
    })),
  }
}

function ruleToDraft(rule: MarkRule): DraftRule {
  switch (rule.kind) {
    case "direct":
      return { kind: "direct" }
    case "sum":
      return {
        kind: "sum",
        inputs: rule.inputs.map((i) => ({
          code: i.code,
          name: i.name ?? "",
          max_marks: String(i.max_marks),
          weight: "",
        })),
      }
    case "best_k_of_n":
      return {
        kind: "best_k_of_n",
        k: String(rule.k),
        inputs: rule.inputs.map((i) => ({
          code: i.code,
          name: i.name ?? "",
          max_marks: String(i.max_marks),
          weight: "",
        })),
      }
    case "rank_weighted":
      return {
        kind: "rank_weighted",
        inputs: rule.inputs.map((i, idx) => ({
          code: i.code,
          name: i.name ?? "",
          max_marks: String(i.max_marks),
          weight: String(rule.weights[idx] ?? ""),
        })),
      }
  }
}

function parseInt32(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (!/^-?\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseFloat32(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function sum(ns: (number | null)[]): number {
  return ns.reduce<number>((a, b) => a + (b ?? 0), 0)
}

type ValidationError = { path: string; message: string }

function validate(draft: Draft): {
  errors: ValidationError[]
  payload?: SaveMarkStructureInput
} {
  const errors: ValidationError[] = []
  const total = parseInt32(draft.max_marks)
  if (total === null || total < 1)
    errors.push({ path: "max_marks", message: "Total max marks must be a positive integer" })

  if (draft.components.length === 0)
    errors.push({ path: "components", message: "Add at least one component" })

  const l1Codes = new Set<string>()
  const builtComponents: MarkStructureL1Component[] = []

  draft.components.forEach((l1, i) => {
    const pathL1 = `components.${i}`
    const code = l1.code.trim().toUpperCase()
    if (!code) errors.push({ path: `${pathL1}.code`, message: "Code required" })
    else if (!/^[A-Z0-9._-]+$/.test(code))
      errors.push({
        path: `${pathL1}.code`,
        message: "Letters, numbers, dot, underscore, dash only",
      })
    else if (l1Codes.has(code))
      errors.push({ path: `${pathL1}.code`, message: "Duplicate component code" })
    l1Codes.add(code)

    const l1Max = parseInt32(l1.max_marks)
    if (l1Max === null || l1Max < 1)
      errors.push({ path: `${pathL1}.max_marks`, message: "Must be a positive integer" })

    // L2 items are optional — when omitted, the L1 itself is a leaf
    // (one direct mark from 0..max_marks).
    const l2Codes = new Set<string>()
    const builtItems: MarkStructureL2Item[] = []
    let l2Sum = 0

    l1.items.forEach((l2, j) => {
      const pathL2 = `${pathL1}.items.${j}`
      const c = l2.code.trim().toUpperCase()
      if (!c) errors.push({ path: `${pathL2}.code`, message: "Code required" })
      else if (!/^[A-Z0-9._-]+$/.test(c))
        errors.push({
          path: `${pathL2}.code`,
          message: "Letters, numbers, dot, underscore, dash only",
        })
      else if (l2Codes.has(c))
        errors.push({ path: `${pathL2}.code`, message: "Duplicate item code" })
      l2Codes.add(c)

      const l2Max = parseInt32(l2.max_marks)
      if (l2Max === null || l2Max < 1)
        errors.push({ path: `${pathL2}.max_marks`, message: "Must be a positive integer" })
      else l2Sum += l2Max

      const rule = buildRule(l2.rule, pathL2, errors)
      if (rule && l2Max !== null) {
        const item: MarkStructureL2Item = {
          code: c,
          max_marks: l2Max,
          rule,
        }
        if (l2.name.trim()) item.name = l2.name.trim()
        builtItems.push(item)
      }
    })

    if (l1Max !== null && l1.items.length > 0 && l2Sum !== l1Max) {
      errors.push({
        path: `${pathL1}.max_marks`,
        message: `Sum of item max-marks (${l2Sum}) must equal component max (${l1Max})`,
      })
    }

    if (l1Max !== null && code) {
      const component: MarkStructureL1Component = {
        code,
        max_marks: l1Max,
        items: builtItems,
      }
      if (l1.name.trim()) component.name = l1.name.trim()
      builtComponents.push(component)
    }
  })

  if (total !== null && builtComponents.length === draft.components.length) {
    const l1Sum = builtComponents.reduce((s, c) => s + c.max_marks, 0)
    if (l1Sum !== total)
      errors.push({
        path: "max_marks",
        message: `Sum of component max-marks (${l1Sum}) must equal total (${total})`,
      })
  }

  if (errors.length > 0) return { errors }
  return {
    errors: [],
    payload: { max_marks: total ?? 0, components: builtComponents },
  }
}

function buildRule(
  draft: DraftRule,
  pathBase: string,
  errors: ValidationError[],
): MarkRule | null {
  const pathRule = `${pathBase}.rule`
  switch (draft.kind) {
    case "direct":
      return { kind: "direct" }
    case "sum": {
      const inputs = buildInputs(draft.inputs, pathRule, errors, false)
      if (!inputs) return null
      return { kind: "sum", inputs }
    }
    case "best_k_of_n": {
      const k = parseInt32(draft.k)
      if (k === null || k < 1)
        errors.push({ path: `${pathRule}.k`, message: "k must be a positive integer" })
      const inputs = buildInputs(draft.inputs, pathRule, errors, false)
      if (k === null || !inputs) return null
      if (k > inputs.length)
        errors.push({
          path: `${pathRule}.k`,
          message: `k cannot exceed input count (${inputs.length})`,
        })
      return { kind: "best_k_of_n", k, inputs }
    }
    case "rank_weighted": {
      const inputs = buildInputs(draft.inputs, pathRule, errors, true)
      if (!inputs) return null
      const weights = draft.inputs.map((i, idx) => {
        const w = parseFloat32(i.weight)
        if (w === null || w < 0 || w > 1)
          errors.push({
            path: `${pathRule}.inputs.${idx}.weight`,
            message: "Weight must be between 0 and 1",
          })
        return w
      })
      if (weights.some((w) => w === null)) return null
      const totalW = (weights as number[]).reduce((a, b) => a + b, 0)
      if (Math.abs(totalW - 1) > 1e-6)
        errors.push({
          path: `${pathRule}.weights`,
          message: `Weights must sum to 1 (currently ${totalW.toFixed(3)})`,
        })
      return {
        kind: "rank_weighted",
        inputs,
        weights: weights as number[],
      }
    }
  }
}

function buildInputs(
  draft: DraftInput[],
  pathRule: string,
  errors: ValidationError[],
  _needsWeights: boolean,
): { code: string; name?: string; max_marks: number }[] | null {
  if (draft.length === 0) {
    errors.push({ path: `${pathRule}.inputs`, message: "Add at least one input" })
    return null
  }
  const seen = new Set<string>()
  const built: { code: string; name?: string; max_marks: number }[] = []
  draft.forEach((inp, i) => {
    const p = `${pathRule}.inputs.${i}`
    const c = inp.code.trim().toUpperCase()
    if (!c) errors.push({ path: `${p}.code`, message: "Code required" })
    else if (!/^[A-Z0-9._-]+$/.test(c))
      errors.push({
        path: `${p}.code`,
        message: "Letters, numbers, dot, underscore, dash only",
      })
    else if (seen.has(c))
      errors.push({ path: `${p}.code`, message: "Duplicate input code" })
    seen.add(c)

    const m = parseInt32(inp.max_marks)
    if (m === null || m < 1)
      errors.push({ path: `${p}.max_marks`, message: "Must be a positive integer" })

    if (c && m !== null) {
      const item: { code: string; name?: string; max_marks: number } = {
        code: c,
        max_marks: m,
      }
      if (inp.name.trim()) item.name = inp.name.trim()
      built.push(item)
    }
  })
  if (built.length !== draft.length) return null
  return built
}

export function MarkStructureEditorPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as {
    regulationId?: string
    subjectTypeId?: string
  }
  const regulationId = Number(params.regulationId)
  const subjectTypeId = Number(params.subjectTypeId)

  const [regulation, setRegulation] = React.useState<Regulation | null>(null)
  const [subjectType, setSubjectType] = React.useState<SubjectType | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT())
  const [errors, setErrors] = React.useState<ValidationError[]>([])

  const load = React.useCallback(async () => {
    if (
      !Number.isInteger(regulationId) ||
      regulationId <= 0 ||
      !Number.isInteger(subjectTypeId) ||
      subjectTypeId <= 0
    ) {
      setFailed(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const [reg, typesPage] = await Promise.all([
        getRegulation(regulationId),
        listSubjectTypes({ pageSize: 100 }),
      ])
      setRegulation(reg)
      const st = typesPage.rows.find((t) => t.id === subjectTypeId)
      if (!st) {
        setFailed(true)
        return
      }
      setSubjectType(st)

      try {
        const existing = await getMarkStructure(regulationId, subjectTypeId)
        setDraft(toDraft(existing.components, existing.max_marks))
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setDraft(EMPTY_DRAFT())
        } else {
          throw err
        }
      }
    } catch (err) {
      setFailed(true)
      toast.error("Couldn't load mark structure", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [regulationId, subjectTypeId])

  React.useEffect(() => {
    void load()
  }, [load])

  const updateDraft = (mut: (d: Draft) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev) as Draft
      mut(next)
      return next
    })
  }

  const handleSave = async () => {
    const result = validate(draft)
    setErrors(result.errors)
    if (!result.payload) {
      toast.error("Please fix the highlighted fields.")
      return
    }
    setSaving(true)
    try {
      await saveMarkStructure(regulationId, subjectTypeId, result.payload)
      toast.success("Mark structure saved.")
      navigate({
        to: "/masters/regulations/$regulationId/mark-structures",
        params: { regulationId: String(regulationId) },
      })
    } catch (err) {
      toast.error("Couldn't save mark structure", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const errByPath = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const e of errors) if (!m.has(e.path)) m.set(e.path, e.message)
    return m
  }, [errors])

  // Live tallies (best-effort — silently fall through when parts don't parse).
  const totalMaxParsed = parseInt32(draft.max_marks)
  const componentSum = sum(
    draft.components.map((c) => parseInt32(c.max_marks)),
  )

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to mark structures">
          <Link
            to="/masters/regulations/$regulationId/mark-structures"
            params={{ regulationId: String(regulationId) }}
          />
        </BackLink>
      }
      title={subjectType?.name ?? "Mark structure"}
    />
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      {header}

      {loading ? (
        <EditorSkeleton />
      ) : failed || !regulation || !subjectType ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load editor"
            description="The regulation or subject type could not be found."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/regulations/$regulationId/mark-structures"
                  params={{ regulationId: String(regulationId) }}
                >
                  Back
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {subjectType.code}
              </span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm font-medium">{regulation.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                ({regulation.code})
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="total-max">Total max marks</Label>
                <Input
                  id="total-max"
                  value={draft.max_marks}
                  onChange={(e) =>
                    updateDraft((d) => {
                      d.max_marks = e.target.value
                    })
                  }
                  inputMode="numeric"
                  className="h-9 w-32"
                />
                {errByPath.get("max_marks") && (
                  <p className="text-xs text-destructive">
                    {errByPath.get("max_marks")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Tally</Label>
                <div
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium tabular-nums",
                    totalMaxParsed !== null && componentSum === totalMaxParsed
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}
                >
                  {componentSum} / {totalMaxParsed ?? "?"}
                  {totalMaxParsed !== null && componentSum === totalMaxParsed
                    ? " ✓"
                    : " — mismatch"}
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-3">
            {draft.components.map((l1, i) => (
              <L1ComponentCard
                key={i}
                index={i}
                value={l1}
                onChange={(mut) =>
                  updateDraft((d) => {
                    mut(d.components[i])
                  })
                }
                onRemove={() =>
                  updateDraft((d) => {
                    d.components.splice(i, 1)
                  })
                }
                errByPath={errByPath}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft((d) => {
                  d.components.push(EMPTY_L1())
                })
              }
            >
              <Plus />
              Add component
            </Button>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-lg border bg-card px-4 py-3 shadow-xs">
            <Button
              variant="ghost"
              onClick={() =>
                navigate({
                  to: "/masters/regulations/$regulationId/mark-structures",
                  params: { regulationId: String(regulationId) },
                })
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function L1ComponentCard({
  index,
  value,
  onChange,
  onRemove,
  errByPath,
}: {
  index: number
  value: DraftL1
  onChange: (mut: (l1: DraftL1) => void) => void
  onRemove: () => void
  errByPath: Map<string, string>
}) {
  const base = `components.${index}`
  const itemSum = sum(value.items.map((it) => parseInt32(it.max_marks)))
  const max = parseInt32(value.max_marks)
  const tallyOk = max !== null && itemSum === max

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Component {index + 1}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove component"
          title="Remove component"
        >
          <Trash2 />
        </Button>
      </header>
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <FieldText
            label="Code"
            value={value.code}
            uppercase
            onChange={(v) => onChange((l) => (l.code = v))}
            error={errByPath.get(`${base}.code`)}
          />
          <FieldText
            label="Name (optional)"
            value={value.name}
            onChange={(v) => onChange((l) => (l.name = v))}
          />
          <FieldText
            label="Max marks"
            value={value.max_marks}
            inputMode="numeric"
            onChange={(v) => onChange((l) => (l.max_marks = v))}
            error={errByPath.get(`${base}.max_marks`)}
          />
        </div>

        {value.items.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Item tally:</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 font-medium tabular-nums",
                tallyOk
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning",
              )}
            >
              {itemSum} / {max ?? "?"} {tallyOk ? "✓" : ""}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {value.items.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No breakdown — a single mark from 0..{max ?? "max"} is entered for
              this component. Add items if this component needs sub-breakdown
              (e.g. for THEORY internals).
            </p>
          )}
          {value.items.map((l2, j) => (
            <L2ItemCard
              key={j}
              basePath={`${base}.items.${j}`}
              value={l2}
              onChange={(mut) => onChange((l) => mut(l.items[j]))}
              onRemove={() => onChange((l) => l.items.splice(j, 1))}
              errByPath={errByPath}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange((l) => l.items.push(EMPTY_L2()))}
          >
            <Plus />
            Add item
          </Button>
          {errByPath.get(`${base}.items`) && (
            <p className="text-xs text-destructive">
              {errByPath.get(`${base}.items`)}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function L2ItemCard({
  basePath,
  value,
  onChange,
  onRemove,
  errByPath,
}: {
  basePath: string
  value: DraftL2
  onChange: (mut: (l2: DraftL2) => void) => void
  onRemove: () => void
  errByPath: Map<string, string>
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-4">
          <FieldText
            label="Code"
            value={value.code}
            uppercase
            onChange={(v) => onChange((l) => (l.code = v))}
            error={errByPath.get(`${basePath}.code`)}
          />
          <FieldText
            label="Name (optional)"
            value={value.name}
            onChange={(v) => onChange((l) => (l.name = v))}
          />
          <FieldText
            label="Max marks"
            value={value.max_marks}
            inputMode="numeric"
            onChange={(v) => onChange((l) => (l.max_marks = v))}
            error={errByPath.get(`${basePath}.max_marks`)}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${basePath}-rule`}>Rule</Label>
            <select
              id={`${basePath}-rule`}
              value={value.rule.kind}
              onChange={(e) =>
                onChange((l) => {
                  l.rule = changeRuleKind(l.rule, e.target.value as MarkRuleKind)
                })
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {MARK_RULE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MARK_RULE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove item"
          title="Remove item"
        >
          <Trash2 />
        </Button>
      </div>

      {value.rule.kind !== "direct" && (
        <div className="mt-4 rounded-md border bg-background p-3">
          <RuleEditor
            basePath={`${basePath}.rule`}
            rule={value.rule}
            onChange={(mut) => onChange((l) => mut(l.rule as DraftRule))}
            errByPath={errByPath}
          />
        </div>
      )}
    </div>
  )
}

function changeRuleKind(current: DraftRule, next: MarkRuleKind): DraftRule {
  if (current.kind === next) return current
  // Try to carry inputs across rule kinds where it makes sense.
  const carriedInputs =
    current.kind === "direct" ? [EMPTY_INPUT(), EMPTY_INPUT()] : current.inputs
  switch (next) {
    case "direct":
      return { kind: "direct" }
    case "sum":
      return { kind: "sum", inputs: carriedInputs }
    case "best_k_of_n":
      return { kind: "best_k_of_n", k: "1", inputs: carriedInputs }
    case "rank_weighted":
      return { kind: "rank_weighted", inputs: carriedInputs }
  }
}

function RuleEditor({
  basePath,
  rule,
  onChange,
  errByPath,
}: {
  basePath: string
  rule: Exclude<DraftRule, { kind: "direct" }>
  onChange: (mut: (r: DraftRule) => void) => void
  errByPath: Map<string, string>
}) {
  const showWeights = rule.kind === "rank_weighted"
  return (
    <div className="space-y-3">
      {rule.kind === "best_k_of_n" && (
        <div className="flex flex-wrap items-end gap-3">
          <FieldText
            label="K (top-K count)"
            value={rule.k}
            inputMode="numeric"
            onChange={(v) =>
              onChange((r) => {
                if (r.kind === "best_k_of_n") r.k = v
              })
            }
            error={errByPath.get(`${basePath}.k`)}
          />
          <p className="pb-1 text-xs text-muted-foreground">
            Picks the top {rule.k || "K"} of {rule.inputs.length} inputs.
          </p>
        </div>
      )}

      {showWeights && (
        <p className="text-xs text-muted-foreground">
          Inputs are sorted descending by score; weights apply by rank (first
          weight = best). Weights must sum to 1.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5">Code</th>
              <th className="px-2 py-1.5">Name (optional)</th>
              <th className="px-2 py-1.5">Max marks</th>
              {showWeights && (
                <th className="px-2 py-1.5">
                  Weight {rule.kind === "rank_weighted" ? "(by rank)" : ""}
                </th>
              )}
              <th className="px-2 py-1.5 text-right">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rule.inputs.map((inp, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-1">
                  <Input
                    value={inp.code}
                    onChange={(e) =>
                      onChange((r) => {
                        if (r.kind === "direct") return
                        r.inputs[i].code = e.target.value
                      })
                    }
                    className="h-8 text-xs uppercase"
                  />
                  {errByPath.get(`${basePath}.inputs.${i}.code`) && (
                    <p className="mt-0.5 text-xs text-destructive">
                      {errByPath.get(`${basePath}.inputs.${i}.code`)}
                    </p>
                  )}
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={inp.name}
                    onChange={(e) =>
                      onChange((r) => {
                        if (r.kind === "direct") return
                        r.inputs[i].name = e.target.value
                      })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={inp.max_marks}
                    inputMode="numeric"
                    onChange={(e) =>
                      onChange((r) => {
                        if (r.kind === "direct") return
                        r.inputs[i].max_marks = e.target.value
                      })
                    }
                    className="h-8 w-24 text-xs"
                  />
                  {errByPath.get(`${basePath}.inputs.${i}.max_marks`) && (
                    <p className="mt-0.5 text-xs text-destructive">
                      {errByPath.get(`${basePath}.inputs.${i}.max_marks`)}
                    </p>
                  )}
                </td>
                {showWeights && (
                  <td className="px-2 py-1">
                    <Input
                      value={inp.weight}
                      inputMode="decimal"
                      onChange={(e) =>
                        onChange((r) => {
                          if (r.kind === "direct") return
                          r.inputs[i].weight = e.target.value
                        })
                      }
                      className="h-8 w-24 text-xs"
                    />
                    {errByPath.get(`${basePath}.inputs.${i}.weight`) && (
                      <p className="mt-0.5 text-xs text-destructive">
                        {errByPath.get(`${basePath}.inputs.${i}.weight`)}
                      </p>
                    )}
                  </td>
                )}
                <td className="px-2 py-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      onChange((r) => {
                        if (r.kind === "direct") return
                        r.inputs.splice(i, 1)
                      })
                    }
                    aria-label="Remove input"
                    title="Remove input"
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange((r) => {
              if (r.kind === "direct") return
              r.inputs.push(EMPTY_INPUT())
            })
          }
        >
          <Plus />
          Add input
        </Button>
        {showWeights && (
          <WeightsTally
            weights={rule.inputs.map((i) => i.weight)}
            error={errByPath.get(`${basePath}.weights`)}
          />
        )}
        {errByPath.get(`${basePath}.inputs`) && (
          <p className="text-xs text-destructive">
            {errByPath.get(`${basePath}.inputs`)}
          </p>
        )}
      </div>
    </div>
  )
}

function WeightsTally({ weights, error }: { weights: string[]; error?: string }) {
  const parsed = weights.map((w) => parseFloat32(w))
  const total = parsed.reduce<number>((a, b) => a + (b ?? 0), 0)
  const ok = Math.abs(total - 1) < 1e-6
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Weights sum:</span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 font-medium tabular-nums",
          ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
        )}
      >
        {total.toFixed(3)} {ok ? "✓" : ""}
      </span>
      {error && !ok && (
        <span className="text-destructive">{error}</span>
      )}
    </div>
  )
}

function FieldText({
  label,
  value,
  onChange,
  error,
  inputMode,
  uppercase,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  uppercase?: boolean
}) {
  const id = React.useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        className={cn("h-9", uppercase && "uppercase")}
        onChange={(e) =>
          onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)
        }
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <Skeleton className="h-4 w-72" />
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-24 rounded-md" />
        </div>
      ))}
    </div>
  )
}
