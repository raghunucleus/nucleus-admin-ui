import * as React from "react"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, BookMarked, Pencil, Plus, Power, PowerOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
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
import { listProgrammeAdmissionYears } from "@/lib/programme-admission-years"
import {
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
import { listSubjects, type Subject } from "@/lib/subjects"

type SubjectEntryMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; entry: ProgrammeSemesterSubject }

// Dedicated full-screen for the Subjects section of one semester's settings.
// Reached from the semester settings bento.
export function SemesterSubjectsPage() {
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const id = Number(params.programmeSemesterId)
  const { programmeId, admissionYearId } = search

  // Shell = the semester row + its batch regulation, both resolved from the URL.
  const [semester, setSemester] = React.useState<ProgrammeSemester | null>(null)
  const [regulationId, setRegulationId] = React.useState<number | null>(null)
  const [shellLoading, setShellLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  // Subject catalog scoped to the regulation + the entries already configured.
  const [subjects, setSubjects] = React.useState<Subject[]>([])
  const [entries, setEntries] = React.useState<ProgrammeSemesterSubject[]>([])
  const [entriesLoading, setEntriesLoading] = React.useState(true)

  const [mode, setMode] = React.useState<SubjectEntryMode>({ kind: "closed" })
  const [busy, setBusy] = React.useState(false)
  const [confirmToggle, setConfirmToggle] =
    React.useState<ProgrammeSemesterSubject | null>(null)

  const loadShell = React.useCallback(async () => {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      programmeId === undefined ||
      admissionYearId === undefined
    ) {
      setShellLoading(false)
      setFailed(true)
      return
    }
    setShellLoading(true)
    setFailed(false)
    try {
      const [psRes, payRes] = await Promise.all([
        listProgrammeSemesters({
          programmeId,
          admissionYearId,
          pageSize: 100,
          sortBy: "semester",
          sortOrder: "asc",
        }),
        listProgrammeAdmissionYears({
          programmeId,
          admissionYearId,
          pageSize: 1,
        }),
      ])
      const row = psRes.rows.find((r) => r.id === id) ?? null
      if (!row) {
        setFailed(true)
        return
      }
      setSemester(row)
      setRegulationId(payRes.rows[0]?.regulation_id ?? null)
    } catch {
      setFailed(true)
    } finally {
      setShellLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void loadShell()
  }, [loadShell])

  // Subject catalog — the pool the "real subject" picker draws from.
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
    if (!Number.isInteger(id) || id <= 0) {
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    try {
      const r = await listProgrammeSemesterSubjects({
        programmeSemesterId: id,
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
  }, [id])

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

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/masters/programme-configuration/semester/$programmeSemesterId"
          params={{ programmeSemesterId: params.programmeSemesterId ?? "" }}
          search={{ programmeId, admissionYearId }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Semester settings
        </Link>
      </div>

      {shellLoading ? (
        <SubjectsSkeleton />
      ) : failed || !semester ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load semester"
            description="This semester could not be found, or it was opened without its programme context. Open it from Programme configuration."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/programme-configuration"
                  search={{ programmeId, admissionYearId }}
                >
                  Back to configuration
                </Link>
              </Button>
            }
          />
        </div>
      ) : regulationId === null ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="No regulation assigned"
            description="Assign a regulation to this programme & admission year batch before configuring subjects — the subject catalog is scoped to the regulation."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/programme-configuration"
                  search={{ programmeId, admissionYearId }}
                >
                  Back to configuration
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  Subjects
                </h1>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Sem {semester.semester.sem_number}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="font-medium text-foreground">
                    {semester.programme.code}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="tabular-nums">
                    {semester.admission_year.display_year}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="font-mono text-foreground">
                    {semester.semester.code}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {entries.length > 0 && (
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
                  disabled={busy}
                >
                  <Plus />
                  Add subject
                </Button>
              </div>
            </div>
          </header>

          <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
            {entriesLoading ? (
              <div className="space-y-2 px-4 py-5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={BookMarked}
                title="No subjects configured"
                description="Add real subjects from the regulation's catalog, or open-elective slots students fill in later."
                action={
                  <Button size="sm" onClick={() => setMode({ kind: "create" })}>
                    <Plus />
                    Add subject
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {entries.map((e) => {
                  const isReal = e.subject_id !== null && e.subject !== null
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 px-4 py-3 text-sm",
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
                                <span className="font-mono">
                                  {o.subject?.code}
                                </span>
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
                          disabled={busy}
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
                          disabled={busy}
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
        </>
      )}

      <Sheet
        open={mode.kind !== "closed"}
        onOpenChange={(o) => !o && setMode({ kind: "closed" })}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind !== "closed" && (
            <SubjectEntryForm
              mode={mode.kind}
              programmeSemesterId={id}
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
    </div>
  )
}

function displayName(e: ProgrammeSemesterSubject): string {
  if (e.subject) return e.subject.name
  return e.placeholder_name ?? "(unnamed)"
}

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

function SubjectsSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
