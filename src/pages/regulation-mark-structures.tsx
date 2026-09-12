import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  ListChecks,
  Tags,
} from "lucide-react"

import { BackLink } from "@/components/back-link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getRegulation, type Regulation } from "@/lib/regulations"
import {
  listRegulationMarkStructures,
  type MarkRule,
  type MarkStructureBySubjectType,
  type MarkStructureL1Component,
  type MarkStructureL2Item,
  type SubjectTypeMarkStructure,
} from "@/lib/subject-type-mark-structures"

// Hub screen: shows every subject type for a regulation and whether its mark
// structure has been configured. Clicking a row opens the editor.
export function RegulationMarkStructuresPage() {
  const params = useParams({ strict: false }) as { regulationId?: string }
  const regulationId = Number(params.regulationId)

  const [regulation, setRegulation] = React.useState<Regulation | null>(null)
  const [rows, setRows] = React.useState<MarkStructureBySubjectType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [previewing, setPreviewing] =
    React.useState<MarkStructureBySubjectType | null>(null)
  // Simulator state — flat map of path → entered mark string.
  const [simMarks, setSimMarks] = React.useState<Record<string, string>>({})

  // Reset simulator inputs whenever a new structure is opened.
  React.useEffect(() => {
    setSimMarks({})
  }, [previewing?.subject_type.id])

  const handleSimMark = React.useCallback((key: string, value: string) => {
    setSimMarks((prev) => ({ ...prev, [key]: value }))
  }, [])

  const load = React.useCallback(async () => {
    if (!Number.isInteger(regulationId) || regulationId <= 0) {
      setFailed(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const [reg, list] = await Promise.all([
        getRegulation(regulationId),
        listRegulationMarkStructures(regulationId),
      ])
      setRegulation(reg)
      setRows(list)
    } catch (err) {
      setFailed(true)
      toast.error("Couldn't load mark structures", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [regulationId])

  React.useEffect(() => {
    void load()
  }, [load])

  const configuredCount = rows.filter((r) => r.structure !== null).length

  const header = (
    <PageHeader
      leading={
        <BackLink label="Back to regulations">
          <Link to="/masters/regulations" />
        </BackLink>
      }
      title="Mark structures"
    />
  )

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-2">
      {header}

      {loading ? (
        <HubSkeleton />
      ) : failed || !regulation ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load mark structures"
            description="The regulation could not be found, or the server is unreachable."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/masters/regulations">Back to regulations</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-medium text-foreground">
              {regulation.name}
            </span>
            <span className="font-mono">({regulation.code})</span>
            <span className="opacity-40">·</span>
            <span>
              <span className="font-medium text-foreground">
                {configuredCount}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{rows.length}</span>{" "}
              configured
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={Tags}
                title="No subject types yet"
                description="Create subject types from Masters → Subject Types first."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/masters/subject-types">Go to subject types</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
              {rows.map((r, idx) => (
                <li
                  key={r.subject_type.id}
                  className={cn(idx > 0 && "border-t")}
                >
                  <div className="flex items-stretch">
                    <Link
                      to="/masters/regulations/$regulationId/mark-structures/$subjectTypeId"
                      params={{
                        regulationId: String(regulationId),
                        subjectTypeId: String(r.subject_type.id),
                      }}
                      className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <ListChecks className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.subject_type.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.subject_type.code}
                          </span>
                          {!r.subject_type.is_active && (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.structure
                            ? `Configured · total ${r.structure.max_marks} marks, ${r.structure.components.length} component${r.structure.components.length === 1 ? "" : "s"}`
                            : "Not configured yet"}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          r.structure
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground border border-input",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 rounded-full",
                            r.structure ? "bg-success" : "bg-muted-foreground/60",
                          )}
                        />
                        {r.structure ? "Configured" : "Pending"}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                    {r.structure && (
                      <button
                        type="button"
                        onClick={() => setPreviewing(r)}
                        title="Preview structure"
                        aria-label="Preview structure"
                        className="flex items-center justify-center border-l px-4 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                      >
                        <Eye className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet
        open={previewing !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {previewing?.structure && regulation && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {previewing.subject_type.name}{" "}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {previewing.subject_type.code}
                  </span>
                </SheetTitle>
                <SheetDescription>
                  {regulation.name} ({regulation.code}) · Total{" "}
                  {previewing.structure.max_marks} marks ·{" "}
                  {previewing.structure.components.length} component
                  {previewing.structure.components.length === 1 ? "" : "s"}
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <p className="text-xs">
                    <span className="font-medium">Marks simulator —</span>{" "}
                    <span className="text-muted-foreground">
                      type a value in any{" "}
                      <span className="font-medium text-foreground">Enter</span>{" "}
                      field below. Totals update live.
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSimMarks({})}
                      disabled={Object.keys(simMarks).length === 0}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setSimMarks(generateExample(previewing.structure!))
                      }
                    >
                      Simulate example
                    </Button>
                  </div>
                </div>
                <MarkStructurePreview
                  structure={previewing.structure}
                  marks={simMarks}
                  onMark={handleSimMark}
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

type SimProps = {
  marks: Record<string, string>
  onMark: (key: string, value: string) => void
}

function MarkStructurePreview({
  structure,
  marks,
  onMark,
}: {
  structure: SubjectTypeMarkStructure
} & SimProps) {
  const total = structure.components.reduce(
    (sum, c, i) => sum + computeL1(c, `c${i}`, marks),
    0,
  )
  const totalCapped = Math.min(total, structure.max_marks)
  const tallyOk = totalCapped === structure.max_marks

  return (
    <div className="space-y-3">
      {structure.components.map((c, i) => (
        <L1Preview
          key={i}
          component={c}
          pathPrefix={`c${i}`}
          marks={marks}
          onMark={onMark}
        />
      ))}
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border px-4 py-3",
          tallyOk
            ? "border-success/40 bg-success/5"
            : "border-primary/30 bg-primary/5",
        )}
      >
        <span className="text-sm font-semibold">Total scored</span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMark(totalCapped)} / {structure.max_marks}
        </span>
      </div>
    </div>
  )
}

function L1Preview({
  component,
  pathPrefix,
  marks,
  onMark,
}: {
  component: MarkStructureL1Component
  pathPrefix: string
} & SimProps) {
  const isLeaf = component.items.length === 0
  const computed = computeL1(component, pathPrefix, marks)

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {component.code}
          </span>
          {component.name && (
            <span className="text-sm font-medium">{component.name}</span>
          )}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            Scored:{" "}
            <span className="font-medium text-foreground">
              {formatMark(computed)}
            </span>{" "}
            / {component.max_marks}
          </span>
        </div>
      </header>
      <div className="space-y-2 px-4 py-3">
        {isLeaf ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2">
            <span className="text-xs italic text-muted-foreground">
              Single mark — no sub-breakdown.
            </span>
            <MarkInput
              value={marks[pathPrefix] ?? ""}
              onChange={(v) => onMark(pathPrefix, v)}
              max={component.max_marks}
              label={`Mark for ${component.code}`}
            />
          </div>
        ) : (
          component.items.map((item, j) => (
            <L2Preview
              key={j}
              item={item}
              pathPrefix={`${pathPrefix}.i${j}`}
              marks={marks}
              onMark={onMark}
            />
          ))
        )}
      </div>
    </section>
  )
}

function L2Preview({
  item,
  pathPrefix,
  marks,
  onMark,
}: {
  item: MarkStructureL2Item
  pathPrefix: string
} & SimProps) {
  const computed = computeL2(item, pathPrefix, marks)
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">
            {item.code}
          </span>
          {item.name && (
            <span className="text-sm font-medium">{item.name}</span>
          )}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          Scored:{" "}
          <span className="font-medium text-foreground">
            {formatMark(computed)}
          </span>{" "}
          / {item.max_marks}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {describeRule(item.rule)}
      </div>
      {item.rule.kind === "direct" ? (
        <div className="mt-2 flex items-center justify-end rounded-sm border-l-2 border-primary/30 bg-background px-3 py-2">
          <MarkInput
            value={marks[pathPrefix] ?? ""}
            onChange={(v) => onMark(pathPrefix, v)}
            max={item.max_marks}
            label={`Mark for ${item.code}`}
          />
        </div>
      ) : item.rule.inputs.length > 0 ? (
        <div className="mt-2 space-y-1.5 rounded-sm border-l-2 border-primary/30 bg-background px-3 py-2">
          {item.rule.inputs.map((inp, k) => {
            const inputPath = `${pathPrefix}.in${k}`
            return (
              <div
                key={k}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-muted-foreground">
                    {inp.code}
                  </span>
                  {inp.name && (
                    <span className="text-muted-foreground">{inp.name}</span>
                  )}
                  {item.rule.kind === "rank_weighted" && (
                    <span className="text-muted-foreground/70">
                      · w {item.rule.weights[k]?.toFixed(2)} ({rankLabel(k)})
                    </span>
                  )}
                </div>
                <MarkInput
                  value={marks[inputPath] ?? ""}
                  onChange={(v) => onMark(inputPath, v)}
                  max={inp.max_marks}
                  label={`Mark for ${inp.code}`}
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function MarkInput({
  value,
  onChange,
  max,
  label,
}: {
  value: string
  onChange: (v: string) => void
  max: number
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Enter
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-9 w-20 border-primary/40 text-right text-sm font-medium tabular-nums focus-visible:border-primary"
        aria-label={label}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        / {max}
      </span>
    </div>
  )
}

function describeRule(rule: MarkRule): string {
  switch (rule.kind) {
    case "direct":
      return "Direct — one mark entered."
    case "sum":
      return `Sum of ${rule.inputs.length} input${rule.inputs.length === 1 ? "" : "s"}.`
    case "best_k_of_n":
      return `Best ${rule.k} of ${rule.inputs.length} inputs.`
    case "rank_weighted": {
      const parts = rule.weights.map(
        (w, i) => `${(w * 100).toFixed(0)}% × ${rankLabel(i)}`,
      )
      return `Rank-weighted: ${parts.join(" + ")}.`
    }
  }
}

function rankLabel(idx: number): string {
  if (idx === 0) return "best"
  if (idx === 1) return "2nd best"
  if (idx === 2) return "3rd best"
  return `${idx + 1}th best`
}

// Compute helpers — operate on the same path scheme used by the inputs.

function parseNum(s: string | undefined): number {
  if (s === undefined || s.trim() === "") return 0
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function formatMark(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function computeL1(
  component: MarkStructureL1Component,
  prefix: string,
  marks: Record<string, string>,
): number {
  if (component.items.length === 0) {
    return Math.min(parseNum(marks[prefix]), component.max_marks)
  }
  return component.items.reduce(
    (sum, it, j) => sum + computeL2(it, `${prefix}.i${j}`, marks),
    0,
  )
}

function computeL2(
  item: MarkStructureL2Item,
  prefix: string,
  marks: Record<string, string>,
): number {
  const rule = item.rule
  if (rule.kind === "direct") {
    return Math.min(parseNum(marks[prefix]), item.max_marks)
  }
  // Per-input values bounded by each input's own max.
  const vals = rule.inputs.map((inp, k) =>
    Math.min(parseNum(marks[`${prefix}.in${k}`]), inp.max_marks),
  )
  let raw = 0
  switch (rule.kind) {
    case "sum":
      raw = vals.reduce((a, b) => a + b, 0)
      break
    case "best_k_of_n": {
      const sorted = [...vals].sort((a, b) => b - a)
      raw = sorted.slice(0, rule.k).reduce((a, b) => a + b, 0)
      break
    }
    case "rank_weighted": {
      const sorted = [...vals].sort((a, b) => b - a)
      raw = sorted.reduce(
        (sum, v, idx) => sum + v * (rule.weights[idx] ?? 0),
        0,
      )
      break
    }
  }
  return Math.min(raw, item.max_marks)
}

// Picks a fresh random integer in [0, max] for every leaf input. Each click
// of "Simulate example" produces a new scenario so the user can explore the
// formula across the full range.
function generateExample(
  structure: SubjectTypeMarkStructure,
): Record<string, string> {
  const randInt = (max: number) => Math.floor(Math.random() * (max + 1))
  const out: Record<string, string> = {}
  structure.components.forEach((c, i) => {
    const prefix = `c${i}`
    if (c.items.length === 0) {
      out[prefix] = String(randInt(c.max_marks))
      return
    }
    c.items.forEach((it, j) => {
      const itemPrefix = `${prefix}.i${j}`
      if (it.rule.kind === "direct") {
        out[itemPrefix] = String(randInt(it.max_marks))
        return
      }
      it.rule.inputs.forEach((inp, k) => {
        out[`${itemPrefix}.in${k}`] = String(randInt(inp.max_marks))
      })
    })
  })
  return out
}

function HubSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-72" />
      <div className="overflow-hidden rounded-lg border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-4 px-5 py-4",
              i > 0 && "border-t",
            )}
          >
            <Skeleton className="size-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
