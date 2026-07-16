import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Hourglass,
  LayoutGrid,
  MoreHorizontal,
  Play,
  ScrollText,
  Settings2,
  UsersRound,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  createProgrammeAdmissionYear,
  getProfileVerifiers,
  listProgrammeAdmissionYears,
  setProfileVerifiers,
  updateProgrammeAdmissionYear,
  type ProfileVerifier,
  type ProgrammeAdmissionYear,
} from "@/lib/programme-admission-years"
import {
  bulkCreateProgrammeSemesters,
  completeProgrammeSemester,
  listProgrammeSemesters,
  setProgrammeSemesterDates,
  startProgrammeSemester,
  type ProgrammeSemester,
  type ProgrammeSemesterStatus,
} from "@/lib/programme-semesters"
import { listProgrammes, type Programme } from "@/lib/programmes"
import { listRegulations, type Regulation } from "@/lib/regulations"
import { listSemesters, type Semester } from "@/lib/semesters"
import {
  listAttendanceGroups,
  type AttendanceGroup,
} from "@/lib/attendance-groups"
import { listEmployees, type Employee } from "@/lib/employees"

type ManageSheetMode =
  | { kind: "closed" }
  | { kind: "semesters" }
  | { kind: "dates"; row: ProgrammeSemester }

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
    React.useState<ProgrammeAdmissionYear | null>(null)

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
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-xs before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-16 before:bg-background before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-background after:content-['']">
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
            regulationId={currentRegulation?.regulation_id ?? null}
          />
          <AttendanceGroupsCard
            programmeId={programmeId}
            admissionYearId={yearId}
          />
          <ProfileVerifiersCard payId={currentRegulation?.id ?? null} />
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
  onAssignmentChange: (link: ProgrammeAdmissionYear | null) => void
}) {
  const [current, setCurrent] = React.useState<ProgrammeAdmissionYear | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await listProgrammeAdmissionYears({
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
        const updated = await updateProgrammeAdmissionYear(current.id, {
          regulation_id: selectedId,
        })
        toast.success(`Regulation updated to ${updated.regulation.code}.`)
      } else {
        const created = await createProgrammeAdmissionYear({
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
  regulationId,
}: {
  programmeId: number
  admissionYearId: number
  programme: Programme | undefined
  semesterOptions: Semester[]
  regulationId: number | null
}) {
  const navigate = useNavigate()
  const regulationAssigned = regulationId !== null
  const [linked, setLinked] = React.useState<ProgrammeSemester[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [busyStatusId, setBusyStatusId] = React.useState<number | null>(null)
  const [statusConfirm, setStatusConfirm] = React.useState<{
    row: ProgrammeSemester
    target: ProgrammeSemesterStatus
  } | null>(null)
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

  // Sequential progression: a semester can only be started once every earlier
  // active linked semester is 'completed'. Build a per-row "blocker" so each
  // card can both gate its own Start action and explain why it's blocked.
  // Inactive predecessors are skipped — they were intentionally taken out by
  // the admin and shouldn't gum up later semesters.
  const blockerByRowId = React.useMemo(() => {
    const sorted = linked
      .slice()
      .sort((a, b) => a.semester.sem_number - b.semester.sem_number)
    const map = new Map<number, ProgrammeSemester | null>()
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i]
      let blocker: ProgrammeSemester | null = null
      for (let j = i - 1; j >= 0; j--) {
        const prev = sorted[j]
        if (!prev.is_active) continue
        if (prev.status !== "completed") {
          blocker = prev
          break
        }
      }
      map.set(row.id, blocker)
    }
    return map
  }, [linked])

  const runStatusTransition = async (
    row: ProgrammeSemester,
    target: ProgrammeSemesterStatus,
  ) => {
    setBusyStatusId(row.id)
    try {
      const updated =
        target === "ongoing"
          ? await startProgrammeSemester(row.id)
          : await completeProgrammeSemester(row.id)
      toast.success(
        `${updated.semester.code} marked ${STATUS_LABELS[updated.status]}.`,
      )
      await load()
    } catch (err) {
      toast.error("Couldn't update status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusyStatusId(null)
    }
  }

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
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Status:</span>
                <StatusLegendChip status="completed" />
                <StatusLegendChip status="ongoing" />
                <StatusLegendChip status="upcoming" />
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {linked
                  .filter((ps) => ps.is_active)
                  .map((ps) => (
                    <SemesterCard
                      key={ps.id}
                      row={ps}
                      busy={busyStatusId === ps.id}
                      blockedBy={blockerByRowId.get(ps.id) ?? null}
                      onRequestTransition={(target) =>
                        setStatusConfirm({ row: ps, target })
                      }
                      onEditDates={() => setSheet({ kind: "dates", row: ps })}
                      onOpenSettings={() =>
                        void navigate({
                          to: "/masters/programme-configuration/semester/$programmeSemesterId",
                          params: { programmeSemesterId: String(ps.id) },
                          search: { programmeId, admissionYearId },
                        })
                      }
                    />
                  ))}
              </div>
            </>
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
          {sheet.kind === "dates" && (
            <DatesForm
              row={sheet.row}
              onCancel={() => setSheet({ kind: "closed" })}
              onSaved={async () => {
                setSheet({ kind: "closed" })
                toast.success("Planned dates saved.")
                await load()
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={statusConfirm !== null}
        onOpenChange={(o) => !o && setStatusConfirm(null)}
        title={
          statusConfirm
            ? statusConfirm.target === "ongoing"
              ? "Start this semester?"
              : "Mark this semester completed?"
            : ""
        }
        description={
          statusConfirm ? (
            <div>
              {statusConfirm.target === "ongoing"
                ? "Moving from Upcoming to Ongoing. Forward-only — you won't be able to revert."
                : "Moving from Ongoing to Completed. Forward-only — you won't be able to revert."}
              <div className="mt-2 font-medium text-foreground">
                {statusConfirm.row.semester.code} —{" "}
                {statusConfirm.row.semester.name}
              </div>
            </div>
          ) : undefined
        }
        confirmLabel={
          statusConfirm?.target === "ongoing"
            ? "Start semester"
            : "Mark completed"
        }
        tone={statusConfirm?.target === "completed" ? "success" : undefined}
        loading={busyStatusId === statusConfirm?.row.id}
        onConfirm={async () => {
          if (!statusConfirm) return
          const { row, target } = statusConfirm
          await runStatusTransition(row, target)
          setStatusConfirm(null)
        }}
      />
    </SectionCard>
  )
}

const STATUS_LABELS: Record<ProgrammeSemesterStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
}

// Tailwind classes for each lifecycle state. Kept here so the legend strip
// and the per-card status pill stay in sync visually.
const STATUS_STYLES: Record<ProgrammeSemesterStatus, string> = {
  completed:
    "bg-success/10 text-success border border-success/30",
  ongoing:
    "bg-warning/15 text-warning border border-warning/40",
  upcoming:
    "bg-muted text-muted-foreground border border-input",
}

// Card chrome per status — subtler than the pill so multiple cards don't
// fight each other for attention. Border color carries the signal; the
// background tint is barely there.
const STATUS_CARD_STYLES: Record<ProgrammeSemesterStatus, string> = {
  completed: "border-success/40 bg-success/[0.03]",
  ongoing: "border-warning/50 bg-warning/[0.04]",
  upcoming: "border-input bg-card",
}

function StatusLegendChip({ status }: { status: ProgrammeSemesterStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function SemesterCard({
  row,
  busy,
  blockedBy,
  onRequestTransition,
  onEditDates,
  onOpenSettings,
}: {
  row: ProgrammeSemester
  busy: boolean
  // Earliest still-unfinished active predecessor, or null if this row is
  // either Sem 1 or has every active predecessor already completed.
  blockedBy: ProgrammeSemester | null
  onRequestTransition: (target: ProgrammeSemesterStatus) => void
  onEditDates: () => void
  onOpenSettings: () => void
}) {
  const canStart = row.status === "upcoming" && blockedBy === null
  const canComplete = row.status === "ongoing"
  const hasAction = canStart || canComplete

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-3 text-card-foreground shadow-xs transition-colors",
        STATUS_CARD_STYLES[row.status],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Sem
            </span>
            <span className="text-lg font-semibold leading-none tabular-nums">
              {row.semester.sem_number}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">
              {row.semester.code}
            </span>
            <span className="opacity-40">·</span>
            <span>{row.semester.roman_format}</span>
            <span className="opacity-40">·</span>
            <span>{row.semester.year_sem_format}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              STATUS_STYLES[row.status],
            )}
          >
            {STATUS_LABELS[row.status]}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Actions for ${row.semester.code}`}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuLabel>
                Currently {STATUS_LABELS[row.status]}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {row.status === "upcoming" && !blockedBy && (
                <DropdownMenuItem
                  onSelect={() => onRequestTransition("ongoing")}
                >
                  <Play />
                  Start (mark ongoing)
                </DropdownMenuItem>
              )}
              {row.status === "upcoming" && blockedBy && (
                <DropdownMenuItem disabled>
                  <Hourglass />
                  Finish Sem {blockedBy.semester.sem_number} first
                </DropdownMenuItem>
              )}
              {row.status === "ongoing" && (
                <DropdownMenuItem
                  onSelect={() => onRequestTransition("completed")}
                >
                  <CheckCircle2 />
                  Mark completed
                </DropdownMenuItem>
              )}
              {row.status === "completed" && (
                <DropdownMenuItem disabled>
                  <Hourglass />
                  Already completed
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEditDates}>
                <CalendarRange />
                Set start & end dates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onEditDates}
          className="flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="Set start & end dates"
        >
          <CalendarRange className="size-3.5 opacity-60" />
          {row.planned_start_date || row.planned_end_date ? (
            <span>
              {row.planned_start_date
                ? formatPlannedDate(row.planned_start_date)
                : "open start"}
              {" – "}
              {row.planned_end_date
                ? formatPlannedDate(row.planned_end_date)
                : "open end"}
            </span>
          ) : (
            <span className="italic">Set start & end dates</span>
          )}
        </button>
        {row.status === "upcoming" && blockedBy && (
          <div className="flex items-center gap-1.5">
            <Hourglass className="size-3.5 opacity-60" />
            <span>
              Waiting for Sem {blockedBy.semester.sem_number} (
              {blockedBy.semester.code}) to finish
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onOpenSettings}
        >
          <Settings2 className="size-3.5" />
          Configure
        </Button>
        {hasAction && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() =>
              onRequestTransition(canStart ? "ongoing" : "completed")
            }
          >
            {canStart ? (
              <>
                <Play />
                Start
              </>
            ) : (
              <>
                <CheckCircle2 />
                Mark completed
              </>
            )}
          </Button>
        )}
      </div>
    </div>
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

function AttendanceGroupsCard({
  programmeId,
  admissionYearId,
}: {
  programmeId: number
  admissionYearId: number
}) {
  const navigate = useNavigate()
  const [groups, setGroups] = React.useState<AttendanceGroup[] | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setGroups(await listAttendanceGroups(programmeId, admissionYearId))
    } catch (err) {
      toast.error("Couldn't load attendance groups", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [programmeId, admissionYearId])

  React.useEffect(() => {
    void load()
  }, [load])

  const groupCount = groups?.length ?? 0
  const groupedStudents = React.useMemo(
    () => (groups ?? []).reduce((n, g) => n + g.members.length, 0),
    [groups],
  )

  return (
    <SectionCard
      icon={UsersRound}
      title="Attendance groups"
      description="Split this batch's students into groups — defined once for the batch and shared across every semester. Each group later follows its own timetable."
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-52" />
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-muted-foreground">
            {groupCount === 0 ? (
              "No attendance groups yet."
            ) : (
              <>
                <span className="font-medium text-foreground tabular-nums">
                  {groupCount}
                </span>{" "}
                group{groupCount === 1 ? "" : "s"}
                {" · "}
                <span className="font-medium text-foreground tabular-nums">
                  {groupedStudents}
                </span>{" "}
                student{groupedStudents === 1 ? "" : "s"} grouped
              </>
            )}
          </div>
          <Button
            size="sm"
            onClick={() =>
              void navigate({
                to: "/masters/programme-configuration/attendance-groups",
                search: { programmeId, admissionYearId },
              })
            }
          >
            <UsersRound />
            {groupCount === 0
              ? "Set up attendance groups"
              : "Manage attendance groups"}
          </Button>
        </>
      )}
    </SectionCard>
  )
}

// --------------------------------------------------------------------- card 4

function ProfileVerifiersCard({ payId }: { payId: number | null }) {
  const [employees, setEmployees] = React.useState<Employee[]>([])
  // Current verifiers persisted server-side — kept to seed synthetic options
  // for any who have since been deactivated, and to compute dirtiness.
  const [current, setCurrent] = React.useState<ProfileVerifier[]>([])
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (payId == null) return
    setLoading(true)
    try {
      const [emps, verifiers] = await Promise.all([
        listEmployees({
          status: "active",
          pageSize: 100,
          sortBy: "emp_display_name",
          sortOrder: "asc",
        }),
        getProfileVerifiers(payId),
      ])
      setEmployees(emps.rows)
      setCurrent(verifiers)
      setSelectedIds(verifiers.map((v) => v.id))
    } catch (err) {
      toast.error("Couldn't load profile verifiers", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [payId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Build the picker options. Any current verifier missing from the active
  // list (e.g. deactivated since) is surfaced as a synthetic option so they
  // stay visible/selectable.
  const options = React.useMemo<ComboboxOption[]>(() => {
    const base: ComboboxOption[] = employees.map((e) => ({
      value: e.id,
      label: e.emp_display_name,
      sublabel: e.emp_code,
    }))
    for (const cur of current) {
      if (!employees.some((e) => e.id === cur.id)) {
        base.unshift({
          value: cur.id,
          label: cur.emp_display_name,
          sublabel: `${cur.emp_code} · current`,
        })
      }
    }
    return base
  }, [employees, current])

  const labelForId = React.useCallback(
    (id: number) => options.find((o) => o.value === id)?.label ?? `#${id}`,
    [options],
  )

  const addPickerOptions = React.useMemo(
    () => options.filter((o) => !selectedIds.includes(o.value)),
    [options, selectedIds],
  )

  const isDirty = React.useMemo(() => {
    const a = [...selectedIds].sort((x, y) => x - y)
    const b = current.map((v) => v.id).sort((x, y) => x - y)
    return a.length !== b.length || a.some((v, i) => v !== b[i])
  }, [selectedIds, current])

  const onSave = async () => {
    if (payId == null || selectedIds.length === 0) return
    setBusy(true)
    try {
      const saved = await setProfileVerifiers(payId, selectedIds)
      setCurrent(saved)
      setSelectedIds(saved.map((v) => v.id))
      toast.success("Profile verifiers updated.")
    } catch (err) {
      toast.error("Couldn't save profile verifiers", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      icon={BadgeCheck}
      title="Profile verifiers"
      description="Teachers who verify the details of this batch's students."
    >
      {payId == null ? (
        <div className="text-sm text-muted-foreground">
          Assign a regulation for this batch first — verifiers are configured
          per batch.
        </div>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="cfg-verifiers" className="text-xs text-muted-foreground">
            Verifiers
          </Label>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
                >
                  <span className="truncate">{labelForId(id)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds((ids) => ids.filter((x) => x !== id))
                    }
                    className="grid size-4 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${labelForId(id)}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Combobox
            id="cfg-verifiers"
            value={null}
            options={addPickerOptions}
            onChange={(v) =>
              v != null &&
              setSelectedIds((ids) => (ids.includes(v) ? ids : [...ids, v]))
            }
            placeholder={
              options.length === 0
                ? "Loading employees…"
                : addPickerOptions.length === 0
                  ? "All employees added"
                  : "Add a verifier…"
            }
            searchPlaceholder="Search by name or emp code…"
            emptyMessage="No employees match"
            disabled={busy || options.length === 0 || addPickerOptions.length === 0}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              Add at least one teacher.
            </p>
            <Button
              size="sm"
              onClick={onSave}
              disabled={busy || selectedIds.length === 0 || !isDirty}
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// --------------------------------------------------------------------- card 5

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

const plannedDateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  year: "numeric",
})

// Format a 'YYYY-MM-DD' string in UTC so timezone never shifts the displayed
// day off by one.
function formatPlannedDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => Number(p))
  const date = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(date.getTime()) ? iso : plannedDateFmt.format(date)
}

function DatesForm({
  row,
  onCancel,
  onSaved,
}: {
  row: ProgrammeSemester
  onCancel: () => void
  onSaved: () => void | Promise<void>
}) {
  const [start, setStart] = React.useState<string>(
    row.planned_start_date ?? "",
  )
  const [end, setEnd] = React.useState<string>(row.planned_end_date ?? "")
  const [busy, setBusy] = React.useState(false)

  const datesDirty =
    (row.planned_start_date ?? "") !== start ||
    (row.planned_end_date ?? "") !== end
  const datesValid = !start || !end || end >= start

  const save = async () => {
    setBusy(true)
    try {
      await setProgrammeSemesterDates(row.id, {
        planned_start_date: start || null,
        planned_end_date: end || null,
      })
      await onSaved()
    } catch (err) {
      toast.error("Couldn't save dates", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>
          Planned dates — {row.semester.code}
        </SheetTitle>
        <SheetDescription>
          Both fields are optional. When set, the Schedule view stops the
          group incharge from publishing weeks outside this window and the
          session seeder uses the end date as a hard cap.
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="planned-start" className="text-xs">
              Start
            </Label>
            <DatePicker
              id="planned-start"
              value={start}
              onChange={setStart}
              allowClear
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planned-end" className="text-xs">
              End
            </Label>
            <DatePicker
              id="planned-end"
              value={end}
              onChange={setEnd}
              allowClear
              invalid={!datesValid}
            />
            {!datesValid && (
              <p className="text-xs text-destructive">
                End must be on or after start.
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave either field blank to keep that side open. Existing class
          sessions outside a tightened window stay — use Manage on the
          programme-semesters page if you need to trim them.
        </p>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={() => void save()}
          disabled={busy || !datesDirty || !datesValid}
        >
          {busy ? "Saving…" : "Save dates"}
        </Button>
      </SheetFooter>
    </div>
  )
}

