import { api } from "@/lib/api"

/**
 * Students, employees and parents may be signed in on this many devices at
 * once unless an admin raises an individual employee's limit.
 */
export const DEFAULT_DEVICE_LIMIT = 2
/** Bounds the server accepts for an employee's `device_limit`. */
export const DEVICE_LIMIT_MIN = 1
export const DEVICE_LIMIT_MAX = 20

/** One signed-in device, most-recently-active first. */
export type SessionRow = {
  id: string
  device_name: string
  /** Address the device signed in from; null when it wasn't recorded. */
  ip: string | null
  created_at: string
  last_used_at: string
  /** Always false here — an admin never rides on the person's own session. */
  current: boolean
}

/** An employee's devices plus the limit they count against. */
export type EmployeeSessionsView = {
  limit: number
  /** True when the employee has no override and uses {@link DEFAULT_DEVICE_LIMIT}. */
  is_default_limit: boolean
  sessions: SessionRow[]
}

// ----- Students -----

export function listStudentSessions(studentId: number): Promise<SessionRow[]> {
  return api<SessionRow[]>(`/admin/students/${studentId}/sessions`, {
    method: "GET",
  })
}

export function revokeStudentSession(
  studentId: number,
  sessionId: string,
): Promise<void> {
  return api<void>(
    `/admin/students/${studentId}/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  )
}

// ----- Employees -----

export function listEmployeeSessions(
  employeeId: number,
): Promise<EmployeeSessionsView> {
  return api<EmployeeSessionsView>(`/admin/employees/${employeeId}/sessions`, {
    method: "GET",
  })
}

export function revokeEmployeeSession(
  employeeId: number,
  sessionId: string,
): Promise<void> {
  return api<void>(
    `/admin/employees/${employeeId}/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  )
}

// ----- Guardians (parent logins are keyed by mobile number) -----

/** Empty when that mobile number has never set a password. */
export function listGuardianSessions(
  mobileNumber: string,
): Promise<SessionRow[]> {
  const qs = new URLSearchParams({ mobile_number: mobileNumber })
  return api<SessionRow[]>(`/admin/guardians/sessions?${qs.toString()}`, {
    method: "GET",
  })
}

export function revokeGuardianSession(
  mobileNumber: string,
  sessionId: string,
): Promise<void> {
  const qs = new URLSearchParams({ mobile_number: mobileNumber })
  return api<void>(
    `/admin/guardians/sessions/${encodeURIComponent(sessionId)}?${qs.toString()}`,
    { method: "DELETE" },
  )
}
