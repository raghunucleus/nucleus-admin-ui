import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { Detail, StatusBadge } from "@/components/detail-item"
import { LoginSecurityCard } from "@/components/login-security-card"
import {
  SignedInDevicesCard,
  type SignedInDevicesResult,
} from "@/components/signed-in-devices-card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  GENDER_LABELS,
  getEmployee,
  resetEmployeeLoginPassword,
  setEmployeeLoginPassword,
  type Employee,
} from "@/lib/employees"
import { listAssignments, type AssignmentDetail } from "@/lib/rbac"
import {
  DEFAULT_DEVICE_LIMIT,
  listEmployeeSessions,
  revokeEmployeeSession,
} from "@/lib/sessions"

// Sections of the employee detail screen — same shell as the student one.
const SECTIONS = [
  { key: "overview", label: "Overview", icon: UserRound },
  { key: "login", label: "Login & security", icon: ShieldCheck },
  { key: "roles", label: "Roles", icon: KeyRound },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

export function EmployeeDetailsPage() {
  const params = useParams({ strict: false }) as { employeeId?: string }
  const id = Number(params.employeeId)
  const validId = Number.isInteger(id) && id > 0

  const [employee, setEmployee] = React.useState<Employee | null>(null)
  const [loading, setLoading] = React.useState(validId)
  const [failed, setFailed] = React.useState(!validId)
  const [section, setSection] = React.useState<SectionKey>("overview")
  // Bumped by "Try again" to re-run the fetch effect.
  const [reloadKey, setReloadKey] = React.useState(0)

  // State is only written after the await, so the effect never sets state
  // synchronously; `retry` resets the flags before bumping the key.
  React.useEffect(() => {
    if (!validId) return
    let alive = true
    void (async () => {
      try {
        const result = await getEmployee(id)
        if (!alive) return
        setEmployee(result)
        setFailed(false)
      } catch {
        if (alive) setFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id, validId, reloadKey])

  const retry = () => {
    if (!validId) return
    setLoading(true)
    setFailed(false)
    setReloadKey((k) => k + 1)
  }

  // Stable per employee id — the devices card re-fetches when these change.
  const loadSessions = React.useCallback(async (): Promise<SignedInDevicesResult> => {
    const view = await listEmployeeSessions(id)
    return {
      sessions: view.sessions,
      limit: { value: view.limit, isDefault: view.is_default_limit },
    }
  }, [id])
  const revokeSession = React.useCallback(
    (sessionId: string) => revokeEmployeeSession(id, sessionId),
    [id],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/employees/all"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Employees
        </Link>
      </div>

      {loading ? (
        <EmployeeDetailsSkeleton />
      ) : failed || !employee ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load employee"
            description="The employee record could not be found or the server is unreachable."
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={retry}>
                  Try again
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/employees/all">Back to employees</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <header className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {employee.emp_display_name}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {employee.emp_code}
                  </span>
                  <StatusBadge active={employee.is_active} />
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-wrap gap-1 border-b">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const active = section === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={cn(
                    "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {s.label}
                </button>
              )
            })}
          </div>

          {section === "overview" && <OverviewSection employee={employee} />}
          {section === "login" && (
            <div className="space-y-4">
              <LoginSecurityCard
                subject={{
                  type: "employee",
                  id: employee.id,
                  displayName: employee.emp_display_name,
                  code: employee.emp_code,
                  email: employee.email,
                }}
                setPassword={setEmployeeLoginPassword}
                resetPassword={resetEmployeeLoginPassword}
              />
              <SignedInDevicesCard
                load={loadSessions}
                revoke={revokeSession}
                noun="employee"
                subjectName={employee.emp_display_name}
              />
            </div>
          )}
          {section === "roles" && <RolesSection employee={employee} />}
        </>
      )}
    </div>
  )
}

function OverviewSection({ employee }: { employee: Employee }) {
  return (
    <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="text-sm font-semibold">Employee information</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Detail label="Emp code" value={employee.emp_code} mono />
        <Detail label="Display name" value={employee.emp_display_name} />
        <Detail label="Gender" value={GENDER_LABELS[employee.gender]} />
        <Detail label="Date of birth" value={employee.dob || "—"} mono />
        <Detail
          label="Department"
          value={
            employee.department
              ? `${employee.department.name} (${employee.department.code})`
              : "—"
          }
        />
        <Detail
          label="Designation"
          value={employee.designation?.name ?? "—"}
        />
        <Detail
          label="Mobile"
          value={
            employee.mobile_number
              ? `+${employee.country_code} ${employee.mobile_number}`
              : "—"
          }
          mono
        />
        <Detail label="Email" value={employee.email} />
        <Detail label="Reports to" value={employee.rm_emp_code ?? "—"} mono />
        <Detail
          label="Device limit"
          value={
            employee.device_limit != null
              ? String(employee.device_limit)
              : `${DEFAULT_DEVICE_LIMIT} (default)`
          }
        />
        <Detail label="Created on" value={formatDate(employee.created_at)} />
      </dl>
    </div>
  )
}

/**
 * Read-only list of the employee's RBAC role assignments. Creating, editing
 * and revoking all happen in Role management — this tab deep-links there.
 */
function RolesSection({ employee }: { employee: Employee }) {
  const [rows, setRows] = React.useState<AssignmentDetail[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await listAssignments({
          employee_id: employee.id,
          page: 1,
          pageSize: 100,
          sortBy: "role",
          sortOrder: "asc",
        })
        if (alive) setRows(res.rows)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [employee.id, reloadKey])

  const retry = () => {
    setRows(null)
    setFailed(false)
    setReloadKey((k) => k + 1)
  }

  const assignLink = (
    <Button asChild size="sm">
      <Link
        to="/role-management/assignments/$assignmentId"
        params={{ assignmentId: "new" }}
        search={{ employee_id: employee.id, role_id: undefined }}
      >
        <Plus />
        Assign role
      </Link>
    </Button>
  )

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h2 className="text-sm font-semibold">Role assignments</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Roles this employee holds, and how many per-screen scope attributes
            each carries.
          </p>
        </div>
        {assignLink}
      </div>

      {failed ? (
        <div className="border-t">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load role assignments"
            description="There was a problem reaching the server."
            action={
              <Button size="sm" onClick={retry}>
                <RefreshCw />
                Try again
              </Button>
            }
          />
        </div>
      ) : rows === null ? (
        <ul className="divide-y border-t">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between px-5 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-28" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="border-t">
          <EmptyState
            icon={ShieldCheck}
            title="No roles assigned"
            description="This employee can't open any role-gated screen until a role is assigned."
            action={assignLink}
          />
        </div>
      ) : (
        <>
          <ul className="divide-y border-t">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <Link
                    to="/role-management/roles/$roleId"
                    params={{ roleId: String(a.role_id) }}
                    className="block truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {a.role_name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {a.role_code && (
                      <span className="font-mono">{a.role_code}</span>
                    )}
                    <span>
                      {a.attributes.length} scoped attribute
                      {a.attributes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Assigned {formatDate(a.created_at)}
                  </span>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                  >
                    <Link
                      to="/role-management/assignments/$assignmentId"
                      params={{ assignmentId: String(a.id) }}
                      search={{ employee_id: undefined, role_id: undefined }}
                      title="Edit assignment"
                      aria-label="Edit assignment"
                    >
                      <Pencil />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t px-5 py-3">
            <Link
              to="/role-management/assignments"
              search={{ employee_id: employee.id, role_id: undefined }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Open in Role management
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function EmployeeDetailsSkeleton() {
  return (
    <>
      <div className="rounded-lg border bg-card px-5 py-4 shadow-xs">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="rounded-lg border bg-card p-5 shadow-xs">
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
