import * as React from "react"
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  listProgrammeSemesters,
  type ProgrammeSemester,
  type ProgrammeSemesterStatus,
} from "@/lib/programme-semesters"
import { listProgrammeSemesterSubjects } from "@/lib/programme-semester-subjects"

const STATUS_LABELS: Record<ProgrammeSemesterStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
}

const STATUS_STYLES: Record<ProgrammeSemesterStatus, string> = {
  completed: "bg-success/10 text-success border border-success/30",
  ongoing: "bg-warning/15 text-warning border border-warning/40",
  upcoming: "bg-muted text-muted-foreground border border-input",
}

// Dedicated full-screen settings hub for one linked semester. Each piece of
// per-semester configuration is its own bento card; clicking one opens a
// dedicated full screen for that section.
export function SemesterSettingsPage() {
  const navigate = useNavigate()
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
  const [subjectCount, setSubjectCount] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  // The list endpoint can't fetch a programme_semester by id, so we scope the
  // batch via the (programme, admission year) search params and pick the row.
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
      const res = await listProgrammeSemesters({
        programmeId,
        admissionYearId,
        pageSize: 100,
        sortBy: "semester",
        sortOrder: "asc",
      })
      const row = res.rows.find((r) => r.id === id) ?? null
      if (!row) {
        setFailed(true)
        return
      }
      setSemester(row)
      // Subject count is a non-blocking nicety for the Subjects bento card.
      try {
        const subs = await listProgrammeSemesterSubjects({
          programmeSemesterId: id,
          pageSize: 1,
        })
        setSubjectCount(subs.total)
      } catch {
        setSubjectCount(null)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [id, programmeId, admissionYearId])

  React.useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/masters/programme-configuration"
          search={{ programmeId, admissionYearId }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Programme configuration
        </Link>
      </div>

      {loading ? (
        <SettingsSkeleton />
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                Sem {semester.semester.sem_number} settings
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  STATUS_STYLES[semester.status],
                )}
              >
                {STATUS_LABELS[semester.status]}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <GraduationCap className="size-3.5" />
              <span className="font-medium text-foreground">
                {semester.programme.code}
              </span>
              <span>— {semester.programme.display_name}</span>
              <span className="opacity-40">·</span>
              <span className="tabular-nums">
                {semester.admission_year.display_year}
              </span>
              <span className="opacity-40">·</span>
              <span className="font-mono text-foreground">
                {semester.semester.code}
              </span>
              <span className="opacity-40">·</span>
              <span>{semester.semester.name}</span>
            </div>
          </header>

          <div>
            <h2 className="mb-2 px-0.5 text-sm font-semibold tracking-tight">
              Configuration
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <BentoCard
                icon={BookMarked}
                title="Subjects"
                description="Real subjects and open-elective slots offered this semester — define what students can register for."
                meta={
                  subjectCount === null
                    ? undefined
                    : subjectCount === 0
                      ? "Not configured yet"
                      : `${subjectCount} subject${
                          subjectCount === 1 ? "" : "s"
                        } configured`
                }
                featured
                className="sm:col-span-2"
                onClick={() =>
                  void navigate({
                    to: "/masters/programme-configuration/semester/$programmeSemesterId/subjects",
                    params: { programmeSemesterId: String(id) },
                    search: { programmeId, admissionYearId },
                  })
                }
              />
              <BentoCard
                icon={Users}
                title="Faculty allocation"
                description="Assign teaching staff to each subject."
                onClick={() =>
                  void navigate({
                    to: "/masters/programme-configuration/semester/$programmeSemesterId/faculty",
                    params: { programmeSemesterId: String(id) },
                    search: { programmeId, admissionYearId },
                  })
                }
              />
              <BentoCard
                icon={CalendarClock}
                title="Timetable"
                description="Weekly class schedule and period allocation."
                comingSoon
              />
              <BentoCard
                icon={ClipboardList}
                title="Assessments & exams"
                description="Internal assessment and examination setup."
                comingSoon
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// One tile in the settings bento. Renders as a button when actionable, or a
// muted dashed card when the section is not built yet.
function BentoCard({
  icon: Icon,
  title,
  description,
  meta,
  onClick,
  comingSoon,
  featured,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  meta?: string
  onClick?: () => void
  comingSoon?: boolean
  featured?: boolean
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-primary/10 text-primary",
            featured ? "size-11" : "size-9",
          )}
        >
          <Icon className={featured ? "size-5" : "size-4"} />
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Coming soon
          </span>
        ) : (
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
      <div className="mt-3 flex-1">
        <h3
          className={cn(
            "font-semibold tracking-tight",
            featured ? "text-base" : "text-sm",
          )}
        >
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {meta && (
        <div className="mt-3 inline-flex w-fit items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
          {meta}
        </div>
      )}
    </>
  )

  if (comingSoon || !onClick) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-lg border border-dashed bg-muted/20 p-4 text-card-foreground",
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-lg border bg-card p-4 text-left text-card-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {body}
    </button>
  )
}

function SettingsSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div>
        <Skeleton className="mb-2 h-4 w-28" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 sm:col-span-2" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </>
  )
}
