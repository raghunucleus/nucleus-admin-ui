import * as React from "react"
import { Link, useParams, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, BookMarked, ChevronRight, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  listProgrammeSemesters,
  type ProgrammeSemester,
} from "@/lib/programme-semesters"
import {
  listProgrammeSemesterSubjects,
  type ProgrammeSemesterSubject,
  type ProgrammeSemesterSubjectSlotType,
} from "@/lib/programme-semester-subjects"

const SLOT_TYPE_LABEL: Record<ProgrammeSemesterSubjectSlotType, string> = {
  open_elective: "Open elective",
  honors: "Honors",
  minors: "Minors",
}

const SLOT_PILL_CLASS: Record<ProgrammeSemesterSubjectSlotType, string> = {
  open_elective: "bg-warning/15 text-warning",
  honors: "bg-primary/15 text-primary",
  minors: "bg-success/15 text-success",
}

// Mirrors the Faculty allocation screen but for student → (candidate, faculty)
// assignment. Lists every slot configured for the semester; each row links to
// the existing per-slot enrollment matrix.
export function SemesterStudentAllocationPage() {
  const params = useParams({ strict: false }) as {
    programmeSemesterId?: string
  }
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const id = Number(params.programmeSemesterId)
  const { programmeId, admissionYearId } = search

  const [semester, setSemester] = React.useState<ProgrammeSemester | null>(null)
  const [entries, setEntries] = React.useState<ProgrammeSemesterSubject[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  const load = React.useCallback(async () => {
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      programmeId === undefined ||
      admissionYearId === undefined
    ) {
      setLoading(false)
      setFailed(true)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      const [ps, subs] = await Promise.all([
        listProgrammeSemesters({
          programmeId,
          admissionYearId,
          pageSize: 100,
          sortBy: "semester",
          sortOrder: "asc",
        }),
        listProgrammeSemesterSubjects({
          programmeSemesterId: id,
          pageSize: 100,
          sortBy: "created_at",
          sortOrder: "asc",
        }),
      ])
      const row = ps.rows.find((r) => r.id === id) ?? null
      if (!row) {
        setFailed(true)
        return
      }
      setSemester(row)
      setEntries(subs.rows)
    } catch (err) {
      setFailed(true)
      if (err instanceof ApiError) {
        toast.error("Couldn't load slots", { description: err.message })
      }
    } finally {
      setLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Only slot rows (open_elective / honors / minors) need student allocation.
  // Real subjects are taught to the whole batch and don't need per-student picks.
  const slots = React.useMemo(
    () => entries.filter((e) => e.subject_id === null && e.is_active),
    [entries],
  )

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

      {loading ? (
        <ListSkeleton />
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
      ) : (
        <>
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight">
                Student allocation
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
              <p className="pt-1 text-xs text-muted-foreground">
                For each elective / honors / minors slot, assign students to one
                of the subjects offered + the specific faculty teaching them.
                Real subjects are taught to the whole batch and don't need
                per-student allocation.
              </p>
            </div>
          </header>

          {slots.length === 0 ? (
            <div className="rounded-lg border bg-card text-card-foreground">
              <EmptyState
                icon={BookMarked}
                title="No slots to allocate"
                description="This semester has no open-elective, honors, or minors slots. Add slots from the Subjects screen first."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/masters/programme-configuration/semester/$programmeSemesterId/subjects"
                      params={{
                        programmeSemesterId: params.programmeSemesterId ?? "",
                      }}
                      search={{ programmeId, admissionYearId }}
                    >
                      Go to Subjects
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
              <ul className="divide-y">
                {slots.map((e) => {
                  const candCount = e.options.length
                  const facultyCount = e.options.reduce(
                    (sum, o) => sum + (o.faculty?.length ?? 0),
                    0,
                  )
                  const facultylessCands = e.options.filter(
                    (o) => (o.faculty?.length ?? 0) === 0,
                  ).length
                  return (
                    <li key={e.id}>
                      <Link
                        to="/masters/programme-configuration/semester/$programmeSemesterId/subjects/$slotId/enrollments"
                        params={{
                          programmeSemesterId: params.programmeSemesterId ?? "",
                          slotId: String(e.id),
                        }}
                        search={{ programmeId, admissionYearId }}
                        className="group flex flex-wrap items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">
                              {e.placeholder_name ?? "(unnamed)"}
                            </span>
                            {e.slot_type && (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                  SLOT_PILL_CLASS[e.slot_type],
                                )}
                              >
                                {SLOT_TYPE_LABEL[e.slot_type]}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span>
                              <span className="font-medium tabular-nums text-foreground">
                                {candCount}
                              </span>{" "}
                              subject{candCount === 1 ? "" : "s"} offered
                            </span>
                            <span>
                              <span className="font-medium tabular-nums text-foreground">
                                {facultyCount}
                              </span>{" "}
                              faculty
                            </span>
                            {facultylessCands > 0 && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                                {facultylessCands} need faculty
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                          <Users className="size-4" />
                          Manage
                          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
