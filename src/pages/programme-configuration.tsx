import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  ArrowRight,
  BookMarked,
  GraduationCap,
  LayoutGrid,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ScrollText,
  Settings2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { listAdmissionYears, type AdmissionYear } from "@/lib/admission-years"
import {
  createProgrammeRegulation,
  listProgrammeRegulations,
  updateProgrammeRegulation,
  type ProgrammeRegulation,
} from "@/lib/programme-regulations"
import {
  bulkCreateProgrammeSemesters,
  listProgrammeSemesters,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  activateProgrammeSemesterSubject,
  createProgrammeSemesterSubject,
  deactivateProgrammeSemesterSubject,
  listProgrammeSemesterSubjects,
  updateProgrammeSemesterSubject,
  type ProgrammeSemesterSubject,
} from "@/lib/programme-semester-subjects"
import { listProgrammes, type Programme } from "@/lib/programmes"
import { listRegulations, type Regulation } from "@/lib/regulations"
import { listSemesters, type Semester } from "@/lib/semesters"
import { listSubjects, type Subject } from "@/lib/subjects"

type ManageSheetMode = { kind: "closed" } | { kind: "semesters" }
type SubjectEntryMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: ProgrammeSemesterSubject }

export function ProgrammeConfigurationPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }

  // Option lists ----------------------------------------------------------
  const [programmeOptions, setProgrammeOptions] = React.useState<Programme[]>([])
  const [yearOptions, setYearOptions] = React.useState<AdmissionYear[]>([])
  const [regulationOptions, setRegulationOptions] = React.useState<Regulation[]>([])
  const [semesterOptions, setSemesterOptions] = React.useState<Semester[]>([])
  const [optionsLoading, setOptionsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setOptionsLoading(true)
      try {
        const [p, y, r, s] = await Promise.all([
          listProgrammes({
            status: "active",
            pageSize: 100,
            sortBy: "name",
            sortOrder: "asc",
          }),
          listAdmissionYears({
            status: "active",
            pageSize: 100,
            sortBy: "year",
            sortOrder: "desc",
          }),
          listRegulations({
            status: "active",
            pageSize: 100,
            sortBy: "created_at",
            sortOrder: "desc",
          }),
          listSemesters({
            status: "active",
            pageSize: 100,
            sortBy: "sem_number",
            sortOrder: "asc",
          }),
        ])
        if (cancelled) return
        setProgrammeOptions(p.rows)
        setYearOptions(y.rows)
        setRegulationOptions(r.rows)
        setSemesterOptions(s.rows)
      } catch (err) {
        if (cancelled) return
        toast.error("Couldn't load option lists", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Primary axes ----------------------------------------------------------
  const [programmeId, setProgrammeId] = React.useState<number | undefined>(
    search.programmeId,
  )
  const [yearId, setYearId] = React.useState<number | undefined>(
    search.admissionYearId,
  )

  // Owned by the page so it can gate downstream sections (e.g. Semesters is
  // disabled until a regulation has been assigned for this batch). The
  // RegulationCard reports its current row via `onAssignmentChange`.
  const [currentRegulation, setCurrentRegulation] =
    React.useState<ProgrammeRegulation | null>(null)

  // Whenever the (programme, year) tuple changes, clear the cached assignment
  // so we don't carry one batch's state into another while the new card is
  // re-fetching.
  React.useEffect(() => {
    setCurrentRegulation(null)
  }, [programmeId, yearId])

  // Keep URL params and local state in sync if the page is re-navigated to
  // with a different combination.
  React.useEffect(() => {
    if (search.programmeId !== undefined) setProgrammeId(search.programmeId)
  }, [search.programmeId])
  React.useEffect(() => {
    if (search.admissionYearId !== undefined) setYearId(search.admissionYearId)
  }, [search.admissionYearId])

  // Auto-pick defaults once options arrive (most recent year, first programme
  // alphabetically). Skips if the user has already chosen something.
  React.useEffect(() => {
    if (yearId === undefined && yearOptions.length > 0) {
      setYearId(yearOptions[0].id)
    }
  }, [yearId, yearOptions])
  React.useEffect(() => {
    if (programmeId === undefined && programmeOptions.length > 0) {
      setProgrammeId(programmeOptions[0].id)
    }
  }, [programmeId, programmeOptions])

  const selectedProgramme = programmeOptions.find((p) => p.id === programmeId)
  const selectedYear = yearOptions.find((y) => y.id === yearId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Programme configuration
          </h1>
          <p className="text-xs text-muted-foreground">
            Settings for a programme × admission year batch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="cfg-programme"
              className="text-xs text-muted-foreground"
            >
              Programme
            </Label>
            <div className="w-56">
              <Combobox
                id="cfg-programme"
                value={programmeId ?? null}
                options={programmeOptions.map((p) => ({
                  value: p.id,
                  label: p.code,
                  sublabel: p.display_name,
                }))}
                onChange={(v) => {
                  if (v == null) return
                  setProgrammeId(v)
                  void navigate({
                    to: "/masters/programme-configuration",
                    search: { programmeId: v, admissionYearId: yearId },
                    replace: true,
                  })
                }}
                placeholder={
                  optionsLoading ? "Loading…" : "Select a programme"
                }
                searchPlaceholder="Search programmes…"
                emptyMessage="No programmes available"
                disabled={optionsLoading || programmeOptions.length === 0}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="cfg-year" className="text-xs text-muted-foreground">
              Year
            </Label>
            <div className="w-40">
              <Combobox
                id="cfg-year"
                value={yearId ?? null}
                options={yearOptions.map((y) => ({
                  value: y.id,
                  label: y.display_year,
                  sublabel: String(y.year),
                }))}
                onChange={(v) => {
                  if (v == null) return
                  setYearId(v)
                  void navigate({
                    to: "/masters/programme-configuration",
                    search: { programmeId, admissionYearId: v },
                    replace: true,
                  })
                }}
                placeholder={optionsLoading ? "Loading…" : "Select a year"}
                searchPlaceholder="Search years…"
                emptyMessage="No years available"
                disabled={optionsLoading || yearOptions.length === 0}
              />
            </div>
          </div>
        </div>
      </div>

      {selectedProgramme && selectedYear && (
        <BatchSummary programme={selectedProgramme} year={selectedYear} />
      )}

      {programmeId !== undefined && yearId !== undefined ? (
        <>
          <RegulationCard
            programmeId={programmeId}
            admissionYearId={yearId}
            regulationOptions={regulationOptions}
            onAssignmentChange={setCurrentRegulation}
          />
          <SemestersCard
            programmeId={programmeId}
            admissionYearId={yearId}
            programme={selectedProgramme}
            semesterOptions={semesterOptions}
            regulationAssigned={currentRegulation !== null}
          />
          <SubjectsCard
            programmeId={programmeId}
            admissionYearId={yearId}
            regulationId={currentRegulation?.regulation_id ?? null}
          />
          <ComingSoonCard />
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {optionsLoading
            ? "Loading…"
            : "Pick a programme and admission year to configure."}
        </div>
      )}
    </div>
  )
}

function BatchSummary({
  programme,
  year,
}: {
  programme: Programme
  year: AdmissionYear
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <GraduationCap className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 truncate">
        Configuring{" "}
        <span className="font-medium text-foreground">{programme.code}</span>{" "}
        <span className="text-muted-foreground">— {programme.display_name}</span>
        {" · "}
        <span className="font-medium text-foreground tabular-nums">
          {year.display_year}
        </span>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------- card 1

function RegulationCard({
  programmeId,
  admissionYearId,
  regulationOptions,
  onAssignmentChange,
}: {
  programmeId: number
  admissionYearId: number
  regulationOptions: Regulation[]
  onAssignmentChange: (link: ProgrammeRegulation | null) => void
}) {
  const [current, setCurrent] = React.useState<ProgrammeRegulation | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listProgrammeRegulations({
        programmeId,
        admissionYearId,
        pageSize: 1,
      })
      const row = result.rows[0] ?? null
      setCurrent(row)
      setSelectedId(row?.regulation_id ?? null)
      onAssignmentChange(row)
    } catch (err) {
      toast.error("Couldn't load regulation", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [programmeId, admissionYearId, onAssignmentChange])

  React.useEffect(() => {
    void load()
  }, [load])

  // If the linked regulation has since been deactivated, inject it so the
  // user can still see what's assigned (and decide to change it).
  const effectiveOptions = React.useMemo<ComboboxOption[]>(() => {
    const base = regulationOptions.map((r) => ({
      value: r.id,
      label: r.code,
      sublabel: r.name,
    }))
    if (current?.regulation && !regulationOptions.some((r) => r.id === current.regulation.id)) {
      return [
        {
          value: current.regulation.id,
          label: current.regulation.code,
          sublabel: current.regulation.name,
        },
        ...base,
      ]
    }
    return base
  }, [regulationOptions, current])

  const isDirty =
    selectedId !== null && selectedId !== (current?.regulation_id ?? null)

  const onSave = async () => {
    if (selectedId == null) return
    setBusy(true)
    try {
      if (current) {
        const updated = await updateProgrammeRegulation(current.id, {
          regulation_id: selectedId,
        })
        toast.success(`Regulation updated to ${updated.regulation.code}.`)
      } else {
        const created = await createProgrammeRegulation({
          programme_id: programmeId,
          admission_year_id: admissionYearId,
          regulation_id: selectedId,
        })
        toast.success(`Assigned ${created.regulation.code}.`)
      }
      await load()
    } catch (err) {
      toast.error("Couldn't save", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      icon={ScrollText}
      title="Regulation"
      description="Which academic regulation applies to this batch."
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : (
        <>
          {current ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Currently assigned:</span>
              <span className="font-medium">{current.regulation.code}</span>
              <span className="text-muted-foreground">
                — {current.regulation.name}
              </span>
              <StatusPill active={current.is_active} />
            </div>
          ) : (
            <div className="mb-3 text-sm text-muted-foreground">
              No regulation assigned for this batch yet.
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label
                htmlFor="cfg-regulation"
                className="text-xs text-muted-foreground"
              >
                {current ? "Change to" : "Select a regulation"}
              </Label>
              <Combobox
                id="cfg-regulation"
                value={selectedId ?? null}
                options={effectiveOptions}
                onChange={(v) => setSelectedId(v)}
                placeholder="Select a regulation"
                searchPlaceholder="Search regulations…"
                emptyMessage="No regulations match"
                disabled={busy || effectiveOptions.length === 0}
              />
            </div>
            <Button
              size="sm"
              onClick={onSave}
              disabled={busy || selectedId == null || !isDirty}
            >
              {busy ? "Saving…" : current ? "Save changes" : "Assign"}
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  )
}

// --------------------------------------------------------------------- card 2

function SemestersCard({
  programmeId,
  admissionYearId,
  programme,
  semesterOptions,
  regulationAssigned,
}: {
  programmeId: number
  admissionYearId: number
  programme: Programme | undefined
  semesterOptions: Semester[]
  regulationAssigned: boolean
}) {
  const [linked, setLinked] = React.useState<ProgrammeSemester[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [sheet, setSheet] = React.useState<ManageSheetMode>({ kind: "closed" })

  const load = React.useCallback(async () => {
    // Don't bother fetching when the section is gated — the user will see the
    // "assign regulation first" state, and an empty list would mislead them.
    if (!regulationAssigned) {
      setLinked([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await listProgrammeSemesters({
        programmeId,
        admissionYearId,
        pageSize: 100,
        sortBy: "semester",
        sortOrder: "asc",
      })
      setLinked(result.rows)
    } catch (err) {
      toast.error("Couldn't load semesters", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [programmeId, admissionYearId, regulationAssigned])

  React.useEffect(() => {
    void load()
  }, [load])

  const expectedSemesters =
    programme?.degree?.duration_years !== undefined
      ? programme.degree.duration_years * 2
      : undefined

  const visibleSemesters = React.useMemo(() => {
    const sorted = semesterOptions
      .slice()
      .sort((a, b) => a.sem_number - b.sem_number)
    return expectedSemesters === undefined
      ? sorted
      : sorted.slice(0, expectedSemesters)
  }, [semesterOptions, expectedSemesters])

  const activeCount = linked.filter((l) => l.is_active).length
  const inactiveCount = linked.length - activeCount

  return (
    <SectionCard
      icon={LayoutGrid}
      title="Semesters"
      description={
        expectedSemesters !== undefined
          ? `This programme runs for ${programme?.degree?.duration_years} year(s) — ${expectedSemesters} semesters total.`
          : "Link semester rows for this batch."
      }
    >
      {!regulationAssigned ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          Assign a regulation above first — semesters can only be linked once
          the batch's regulation has been chosen.
        </div>
      ) : loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-14 rounded-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-muted-foreground">
            {linked.length === 0 ? (
              "No semesters linked yet."
            ) : (
              <>
                <span className="font-medium text-foreground tabular-nums">
                  {linked.length}
                </span>{" "}
                linked{" "}
                {inactiveCount > 0 && (
                  <span className="text-muted-foreground">
                    ({activeCount} active, {inactiveCount} inactive)
                  </span>
                )}
              </>
            )}
          </div>

          {linked.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {linked.map((ps) => (
                <span
                  key={ps.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ps.is_active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground line-through",
                  )}
                  title={`${ps.semester.code} — ${ps.semester.name}${ps.is_active ? "" : " (inactive)"}`}
                >
                  <span className="tabular-nums">{ps.semester.sem_number}</span>
                  <span className="opacity-70">·</span>
                  <span>{ps.semester.code}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setSheet({ kind: "semesters" })}
              disabled={busy || visibleSemesters.length === 0}
            >
              <Settings2 />
              {linked.length === 0 ? "Link semesters" : "Add more semesters"}
            </Button>
            <Link
              to="/masters/programme-semesters"
              search={{ programmeId }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View detailed list
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </>
      )}

      <Sheet
        open={sheet.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setSheet({ kind: "closed" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {sheet.kind === "semesters" && (
            <BulkLinkSemestersForm
              programmeId={programmeId}
              admissionYearId={admissionYearId}
              visibleSemesters={visibleSemesters}
              linkedSemesterIds={
                new Set(linked.map((l) => l.semester_id))
              }
              onCancel={() => setSheet({ kind: "closed" })}
              onSaved={async (created, skipped) => {
                setSheet({ kind: "closed" })
                if (created > 0 && skipped > 0) {
                  toast.success(`Linked ${created} semester(s).`, {
                    description: `${skipped} already existed and were skipped.`,
                  })
                } else if (created > 0) {
                  toast.success(`Linked ${created} semester(s).`)
                } else {
                  toast.info("Nothing to link", {
                    description: `All ${skipped} selected semester(s) were already linked.`,
                  })
                }
                await load()
              }}
              setBusy={setBusy}
            />
          )}
        </SheetContent>
      </Sheet>
    </SectionCard>
  )
}

function BulkLinkSemestersForm({
  programmeId,
  admissionYearId,
  visibleSemesters,
  linkedSemesterIds,
  onCancel,
  onSaved,
  setBusy,
}: {
  programmeId: number
  admissionYearId: number
  visibleSemesters: Semester[]
  linkedSemesterIds: Set<number>
  onCancel: () => void
  onSaved: (created: number, skipped: number) => void | Promise<void>
  setBusy: (b: boolean) => void
}) {
  // Default: every visible semester checked. Already-linked ones are also
  // pre-checked so the user sees the full intended state; the backend will
  // skip those when re-submitting.
  const initialIds = React.useMemo(
    () => visibleSemesters.map((s) => s.id),
    [visibleSemesters],
  )
  const [selectedIds, setSelectedIds] = React.useState<number[]>(initialIds)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    setSelectedIds(initialIds)
  }, [initialIds])

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) return
    setSubmitting(true)
    setBusy(true)
    try {
      const result = await bulkCreateProgrammeSemesters({
        programme_id: programmeId,
        admission_year_id: admissionYearId,
        semester_ids: selectedIds,
      })
      await onSaved(result.created.length, result.skipped.length)
    } catch (err) {
      toast.error("Couldn't link semesters", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>Link semesters</SheetTitle>
        <SheetDescription>
          Already-linked semesters are pre-checked; submitting again is safe
          — existing combinations are skipped.
        </SheetDescription>
      </SheetHeader>

      <SheetBody>
        <div className="rounded-md border bg-background">
          <ul className="max-h-96 overflow-y-auto thin-scrollbar divide-y">
            {visibleSemesters.map((s) => {
              const checked = selectedIds.includes(s.id)
              const alreadyLinked = linkedSemesterIds.has(s.id)
              return (
                <li key={s.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors",
                      "hover:bg-accent/40",
                      checked && "bg-primary/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {s.sem_number}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.code}
                      </span>
                      <span className="truncate text-muted-foreground">
                        · {s.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {s.roman_format} · {s.year_sem_format}
                    </span>
                    {alreadyLinked && (
                      <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        linked
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {selectedIds.length} of {visibleSemesters.length} selected.
        </p>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || selectedIds.length === 0}>
          {submitting ? "Linking…" : "Save"}
        </Button>
      </SheetFooter>
    </form>
  )
}

// --------------------------------------------------------------------- card 3

function SubjectsCard({
  programmeId,
  admissionYearId,
  regulationId,
}: {
  programmeId: number
  admissionYearId: number
  regulationId: number | null
}) {
  // Linked & active programme_semester rows for the batch — these are the
  // semesters the admin can attach subjects to.
  const [linkedSemesters, setLinkedSemesters] = React.useState<
    ProgrammeSemester[]
  >([])
  const [semestersLoading, setSemestersLoading] = React.useState(true)

  // Subjects under the batch's regulation — used to populate the "real
  // subject" picker. Empty when no regulation assigned.
  const [subjects, setSubjects] = React.useState<Subject[]>([])

  // Entries (real + elective) attached to the currently-selected semester.
  const [entries, setEntries] = React.useState<ProgrammeSemesterSubject[]>([])
  const [entriesLoading, setEntriesLoading] = React.useState(true)

  const [selectedSemesterId, setSelectedSemesterId] = React.useState<
    number | undefined
  >(undefined)

  const [mode, setMode] = React.useState<SubjectEntryMode>({ kind: "closed" })
  const [busy, setBusy] = React.useState(false)
  const [confirmToggle, setConfirmToggle] =
    React.useState<ProgrammeSemesterSubject | null>(null)

  // Reset everything when the batch identity changes — stops a previous
  // batch's selection from leaking into the new one.
  React.useEffect(() => {
    setSelectedSemesterId(undefined)
    setEntries([])
    setLinkedSemesters([])
    setSubjects([])
  }, [programmeId, admissionYearId, regulationId])

  // Load linked semesters whenever the batch changes (active only).
  React.useEffect(() => {
    let cancelled = false
    if (regulationId === null) {
      setSemestersLoading(false)
      return
    }
    setSemestersLoading(true)
    listProgrammeSemesters({
      programmeId,
      admissionYearId,
      status: "active",
      pageSize: 100,
      sortBy: "semester",
      sortOrder: "asc",
    })
      .then((r) => {
        if (cancelled) return
        setLinkedSemesters(r.rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error("Couldn't load linked semesters", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      })
      .finally(() => {
        if (!cancelled) setSemestersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [programmeId, admissionYearId, regulationId])

  // Auto-pick the first linked semester once they're available.
  React.useEffect(() => {
    if (selectedSemesterId === undefined && linkedSemesters.length > 0) {
      setSelectedSemesterId(linkedSemesters[0].id)
    }
  }, [selectedSemesterId, linkedSemesters])

  // Load subject catalog scoped to the batch's regulation.
  React.useEffect(() => {
    let cancelled = false
    if (regulationId === null) return
    listSubjects({
      regulationId,
      status: "active",
      pageSize: 100,
      sortBy: "code",
      sortOrder: "asc",
    })
      .then((r) => {
        if (!cancelled) setSubjects(r.rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error("Couldn't load subject catalog", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      })
    return () => {
      cancelled = true
    }
  }, [regulationId])

  const loadEntries = React.useCallback(async () => {
    if (selectedSemesterId === undefined) {
      setEntries([])
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    try {
      const r = await listProgrammeSemesterSubjects({
        programmeSemesterId: selectedSemesterId,
        pageSize: 100,
        sortBy: "created_at",
        sortOrder: "asc",
      })
      setEntries(r.rows)
    } catch (err) {
      toast.error("Couldn't load configured subjects", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setEntriesLoading(false)
    }
  }, [selectedSemesterId])

  React.useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const totalCredits = entries
    .filter((e) => e.is_active)
    .reduce((sum, e) => sum + Number(e.credits || 0), 0)

  const onToggleActive = async (entry: ProgrammeSemesterSubject) => {
    setBusy(true)
    try {
      const updated = entry.is_active
        ? await deactivateProgrammeSemesterSubject(entry.id)
        : await activateProgrammeSemesterSubject(entry.id)
      toast.success(
        `${displayName(updated)} ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      await loadEntries()
    } catch (err) {
      toast.error("Couldn't update", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  // Gating ----------------------------------------------------------------
  if (regulationId === null) {
    return (
      <SectionCard
        icon={BookMarked}
        title="Subjects"
        description="Configure subjects for each linked semester."
      >
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          Assign a regulation above first — the subject catalog is scoped to
          the batch's regulation.
        </div>
      </SectionCard>
    )
  }

  if (semestersLoading) {
    return (
      <SectionCard
        icon={BookMarked}
        title="Subjects"
        description="Configure subjects for each linked semester."
      >
        <Skeleton className="h-9 w-64" />
      </SectionCard>
    )
  }

  if (linkedSemesters.length === 0) {
    return (
      <SectionCard
        icon={BookMarked}
        title="Subjects"
        description="Configure subjects for each linked semester."
      >
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          Link at least one semester above first — subjects are configured
          per semester.
        </div>
      </SectionCard>
    )
  }

  const selectedLinkedSemester = linkedSemesters.find(
    (l) => l.id === selectedSemesterId,
  )

  return (
    <SectionCard
      icon={BookMarked}
      title="Subjects"
      description="Configure real subjects and open-elective slots for each linked semester."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cfg-sub-semester" className="text-xs text-muted-foreground">
            Semester
          </Label>
          <div className="w-56">
            <Combobox
              id="cfg-sub-semester"
              value={selectedSemesterId ?? null}
              options={linkedSemesters.map((l) => ({
                value: l.id,
                label: l.semester.code,
                sublabel: `${l.semester.roman_format} · ${l.semester.name}`,
              }))}
              onChange={(v) => {
                if (v == null) return
                setSelectedSemesterId(v)
              }}
              placeholder="Select a semester"
              searchPlaceholder="Search semesters…"
              emptyMessage="No semesters"
              disabled={linkedSemesters.length === 0}
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedLinkedSemester && entries.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Total credits:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {totalCredits.toFixed(1)}
              </span>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => setMode({ kind: "create" })}
            disabled={busy || selectedSemesterId === undefined}
          >
            <Plus />
            Add subject
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-md border bg-background">
        {entriesLoading ? (
          <div className="px-3 py-6">
            <Skeleton className="h-4 w-48" />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No subjects configured for this semester yet.
          </div>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const isReal = e.subject_id !== null && e.subject !== null
              const isBusy = busy
              return (
                <li
                  key={e.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-3 py-2 text-sm",
                    !e.is_active && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{displayName(e)}</span>
                      {isReal && e.subject && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.subject.code}
                        </span>
                      )}
                      {!isReal && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                          Elective slot
                        </span>
                      )}
                      {!e.is_active && <StatusPill active={false} />}
                    </div>
                    {!isReal && e.options.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.options.map((o) => (
                          <span
                            key={o.id}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            title={o.subject?.name ?? ""}
                          >
                            <span className="font-mono">{o.subject?.code}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-sm font-medium tabular-nums">
                    {Number(e.credits).toFixed(1)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      cr
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setMode({ kind: "edit", entry: e })}
                      disabled={isBusy}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-8",
                        e.is_active
                          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          : "text-muted-foreground hover:bg-success/10 hover:text-success",
                      )}
                      onClick={() => setConfirmToggle(e)}
                      disabled={isBusy}
                      title={e.is_active ? "Deactivate" : "Activate"}
                      aria-label={e.is_active ? "Deactivate" : "Activate"}
                    >
                      {e.is_active ? <PowerOff /> : <Power />}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Sheet
        open={mode.kind !== "closed"}
        onOpenChange={(o) => !o && setMode({ kind: "closed" })}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind !== "closed" && selectedSemesterId !== undefined && (
            <SubjectEntryForm
              mode={mode.kind}
              programmeSemesterId={selectedSemesterId}
              subjects={subjects}
              entries={entries}
              entry={mode.kind === "edit" ? mode.entry : undefined}
              onCancel={() => setMode({ kind: "closed" })}
              onSaved={async () => {
                setMode({ kind: "closed" })
                await loadEntries()
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirmToggle}
        onOpenChange={(o) => !o && setConfirmToggle(null)}
        title={
          confirmToggle?.is_active
            ? "Deactivate subject entry?"
            : "Activate subject entry?"
        }
        description={
          confirmToggle ? (
            <div>
              {confirmToggle.is_active
                ? "Deactivated entries won't be selectable in dependent records."
                : "Reactivated entries become available again."}
              <div className="mt-2 font-medium text-foreground">
                {displayName(confirmToggle)}
              </div>
            </div>
          ) : undefined
        }
        confirmLabel={confirmToggle?.is_active ? "Deactivate" : "Activate"}
        tone={confirmToggle?.is_active ? "destructive" : "success"}
        loading={busy}
        onConfirm={async () => {
          if (!confirmToggle) return
          const target = confirmToggle
          await onToggleActive(target)
          setConfirmToggle(null)
        }}
      />
    </SectionCard>
  )
}

function displayName(e: ProgrammeSemesterSubject): string {
  if (e.subject) return e.subject.name
  return e.placeholder_name ?? "(unnamed)"
}

// --------------------------------------------------------------------- card 3 form

function SubjectEntryForm({
  mode,
  programmeSemesterId,
  subjects,
  entries,
  entry,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit"
  programmeSemesterId: number
  subjects: Subject[]
  entries: ProgrammeSemesterSubject[]
  entry: ProgrammeSemesterSubject | undefined
  onCancel: () => void
  onSaved: () => void | Promise<void>
}) {
  const initialKind: "subject" | "elective" =
    entry?.subject_id != null ? "subject" : entry ? "elective" : "subject"

  const [kind, setKind] = React.useState<"subject" | "elective">(initialKind)
  const [subjectId, setSubjectId] = React.useState<number | null>(
    entry?.subject_id ?? null,
  )
  const [placeholder, setPlaceholder] = React.useState<string>(
    entry?.placeholder_name ?? "",
  )
  // Candidate subject pool for elective slots. Ordered set kept in insertion
  // order to make the chip row's UX predictable; we dedupe on add.
  const [optionIds, setOptionIds] = React.useState<number[]>(
    entry?.options.map((o) => o.subject_id) ?? [],
  )
  const [credits, setCredits] = React.useState<string>(
    entry ? Number(entry.credits).toFixed(1) : "3.0",
  )
  const [submitting, setSubmitting] = React.useState(false)

  // Subjects already configured under THIS semester (excluding the entry
  // being edited) — hide them from the picker so the user can't pick a dupe.
  const takenSubjectIds = React.useMemo(() => {
    const taken = new Set<number>()
    for (const e of entries) {
      if (e.subject_id != null && e.id !== entry?.id) taken.add(e.subject_id)
    }
    return taken
  }, [entries, entry?.id])

  // If the entry being edited references a since-deactivated subject, inject
  // it at the top of options so the form doesn't silently switch values.
  const subjectOptions = React.useMemo<ComboboxOption[]>(() => {
    const base = subjects
      .filter((s) => !takenSubjectIds.has(s.id))
      .map((s) => ({
        value: s.id,
        label: s.code,
        sublabel: s.name,
      }))
    if (entry?.subject && !subjects.some((s) => s.id === entry.subject!.id)) {
      base.unshift({
        value: entry.subject.id,
        label: entry.subject.code,
        sublabel: entry.subject.name,
      })
    }
    return base
  }, [subjects, takenSubjectIds, entry])

  const creditsNumber = Number(credits)
  const creditsValid =
    Number.isFinite(creditsNumber) &&
    creditsNumber >= 0.5 &&
    creditsNumber <= 30 &&
    (creditsNumber * 10) % 5 === 0

  const isValid =
    creditsValid &&
    (kind === "subject"
      ? subjectId !== null
      : placeholder.trim().length > 0 &&
        placeholder.trim().length <= 64 &&
        optionIds.length > 0)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    try {
      if (mode === "create") {
        await createProgrammeSemesterSubject({
          programme_semester_id: programmeSemesterId,
          subject_id: kind === "subject" ? subjectId! : undefined,
          placeholder_name: kind === "elective" ? placeholder.trim() : undefined,
          option_subject_ids: kind === "elective" ? optionIds : undefined,
          credits: creditsNumber,
        })
        toast.success("Subject added.")
      } else if (entry) {
        await updateProgrammeSemesterSubject(entry.id, {
          subject_id: kind === "subject" ? subjectId : null,
          placeholder_name: kind === "elective" ? placeholder.trim() : null,
          // For real subjects we don't send an option pool. For electives,
          // always send the current set so server keeps it in sync with the
          // form's snapshot.
          option_subject_ids: kind === "elective" ? optionIds : undefined,
          credits: creditsNumber,
        })
        toast.success("Subject updated.")
      }
      await onSaved()
    } catch (err) {
      toast.error("Couldn't save", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          {mode === "create" ? "Add subject" : "Edit subject"}
        </SheetTitle>
        <SheetDescription>
          Either pick a real subject from this batch's regulation, or add an
          open-elective slot the student will choose to fill later.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("subject")}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                kind === "subject"
                  ? "border-primary/60 bg-primary/5 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent/40",
              )}
            >
              <div className="font-medium">Real subject</div>
              <div className="text-xs text-muted-foreground">
                Pick from the regulation's subject catalog.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setKind("elective")}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                kind === "elective"
                  ? "border-primary/60 bg-primary/5 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent/40",
              )}
            >
              <div className="font-medium">Open-elective slot</div>
              <div className="text-xs text-muted-foreground">
                Student picks from a candidate pool.
              </div>
            </button>
          </div>
        </div>

        {kind === "subject" ? (
          <div className="space-y-1.5">
            <Label htmlFor="entry-subject">Subject</Label>
            <Combobox
              id="entry-subject"
              value={subjectId ?? null}
              options={subjectOptions}
              onChange={(v) => setSubjectId(v)}
              placeholder="Select a subject"
              searchPlaceholder="Search subjects…"
              emptyMessage={
                subjects.length === 0
                  ? "No subjects under this regulation"
                  : "All subjects already configured"
              }
            />
            {subjects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No subjects exist under this regulation yet. Add subjects from
                Masters → Subject first.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="entry-placeholder">Slot name</Label>
              <Input
                id="entry-placeholder"
                maxLength={64}
                autoComplete="off"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="e.g. Open Elective 1"
              />
              <p className="text-xs text-muted-foreground">
                Label shown to students when they pick what fills this slot.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-options">Candidate subjects</Label>
              <ElectiveOptionsPicker
                id="entry-options"
                subjects={subjects}
                selectedIds={optionIds}
                fallbackSubjects={
                  entry?.options.map((o) => o.subject).filter(Boolean) as
                    | Subject[]
                    | undefined
                }
                onChange={setOptionIds}
              />
              <p className="text-xs text-muted-foreground">
                Add the subjects students may choose from for this slot. They
                pick one at registration time.
              </p>
              {optionIds.length === 0 && (
                <p className="text-xs text-destructive">
                  Pick at least one candidate subject.
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="entry-credits">Credits</Label>
          <Input
            id="entry-credits"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={30}
            step={0.5}
            autoComplete="off"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="w-32"
          />
          {!creditsValid && credits !== "" && (
            <p className="text-xs text-destructive">
              Credits must be between 0.5 and 30, in steps of 0.5.
            </p>
          )}
        </div>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !isValid}>
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Add"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}

// Multi-pick UI for the elective slot's candidate subject pool. Uses the
// existing single-select Combobox to add one subject at a time; selected
// subjects appear as removable chips below. `fallbackSubjects` lets us
// show subjects that have since been deactivated (so editing an existing
// slot doesn't silently drop them from view).
function ElectiveOptionsPicker({
  id,
  subjects,
  selectedIds,
  fallbackSubjects,
  onChange,
}: {
  id?: string
  subjects: Subject[]
  selectedIds: number[]
  fallbackSubjects?: Subject[]
  onChange: (next: number[]) => void
}) {
  const byId = React.useMemo(() => {
    const map = new Map<number, Subject>()
    for (const s of subjects) map.set(s.id, s)
    for (const s of fallbackSubjects ?? []) {
      if (!map.has(s.id)) map.set(s.id, s)
    }
    return map
  }, [subjects, fallbackSubjects])

  // Reset to null after each pick so the user can keep adding from the
  // same Combobox. The picker hides already-selected ids from the options.
  const [, setPickerVersion] = React.useState(0)

  const pickerOptions = React.useMemo<ComboboxOption[]>(
    () =>
      subjects
        .filter((s) => !selectedIds.includes(s.id))
        .map((s) => ({ value: s.id, label: s.code, sublabel: s.name })),
    [subjects, selectedIds],
  )

  const add = (subjectId: number) => {
    if (selectedIds.includes(subjectId)) return
    onChange([...selectedIds, subjectId])
    setPickerVersion((v) => v + 1)
  }

  const remove = (subjectId: number) => {
    onChange(selectedIds.filter((x) => x !== subjectId))
  }

  return (
    <div className="space-y-2">
      <Combobox
        id={id}
        value={null}
        options={pickerOptions}
        onChange={(v) => v != null && add(v)}
        placeholder={
          subjects.length === 0
            ? "No subjects under this regulation"
            : pickerOptions.length === 0
              ? "All subjects added"
              : "Add a candidate subject…"
        }
        searchPlaceholder="Search subjects…"
        emptyMessage={
          subjects.length === 0
            ? "No subjects under this regulation"
            : "No matches"
        }
        disabled={subjects.length === 0 || pickerOptions.length === 0}
      />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((sid) => {
            const s = byId.get(sid)
            return (
              <span
                key={sid}
                className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-2 py-0.5 text-xs"
                title={s?.name ?? ""}
              >
                <span className="font-mono">{s?.code ?? `#${sid}`}</span>
                {s?.name && (
                  <span className="text-muted-foreground">— {s.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(sid)}
                  aria-label={`Remove ${s?.code ?? sid}`}
                  className="ml-0.5 grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <span className="sr-only">Remove</span>
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                    <path
                      d="M3 3l6 6M9 3l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------- card 4

function ComingSoonCard() {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-8 text-center text-card-foreground">
      <div className="text-sm font-medium">More settings coming soon</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Additional per-batch configuration will appear here as it's added.
      </p>
    </div>
  )
}

// --------------------------------------------------------------------- shared

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  rightSlot,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-success" : "bg-destructive",
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
  )
}

