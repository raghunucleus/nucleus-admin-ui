import { api } from "@/lib/api"
import type { AttendanceGroup } from "@/lib/attendance-groups"
import type { Employee } from "@/lib/employees"
import type { ProgrammeSemester } from "@/lib/programme-semesters"
import type {
  ProgrammeSemesterSubject,
  ProgrammeSemesterSubjectOption,
} from "@/lib/programme-semester-subjects"
import type { Subject } from "@/lib/subjects"

export type ClassSessionStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rescheduled"

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "exempt"
  | "od"

export type ClassSession = {
  id: number
  session_date: string
  day_of_week: number
  programme_semester_id: number
  programme_semester?: ProgrammeSemester
  attendance_group_id: number | null
  attendance_group: AttendanceGroup | null
  timetable_period_id: number
  timetable_period: {
    id: number
    position: number
    label: string
    start_time: string
    end_time: string
    is_break: boolean
  } | null
  span: number
  timetable_entry_id: number | null
  programme_semester_subject_id: number
  programme_semester_subject: ProgrammeSemesterSubject | null
  programme_semester_subject_option_id: number | null
  programme_semester_subject_option:
    | (ProgrammeSemesterSubjectOption & { subject: Subject })
    | null
  subject_id: number
  subject: Subject | null
  scheduled_employee_id: number
  scheduled_employee: Pick<Employee, "id" | "emp_code" | "emp_display_name"> | null
  effective_employee_id: number
  effective_employee: Pick<Employee, "id" | "emp_code" | "emp_display_name"> | null
  status: ClassSessionStatus
  rescheduled_to_session_id: number | null
  cancel_reason: string | null
  room: string | null
  note: string | null
  attendance_marked_at: string | null
  created_at: string
  updated_at: string
}

export type RosterStudent = {
  id: number
  student_id: string
  display_name: string
}

export type ListClassSessionsParams = {
  from: string
  to: string
  programme_semester_id?: number
  attendance_group_id?: number
  effective_employee_id?: number
  status?: ClassSessionStatus | ClassSessionStatus[]
}

export async function listClassSessions(
  params: ListClassSessionsParams,
): Promise<ClassSession[]> {
  const qs = new URLSearchParams()
  qs.set("from", params.from)
  qs.set("to", params.to)
  if (params.programme_semester_id !== undefined)
    qs.set("programme_semester_id", String(params.programme_semester_id))
  if (params.attendance_group_id !== undefined)
    qs.set("attendance_group_id", String(params.attendance_group_id))
  if (params.effective_employee_id !== undefined)
    qs.set("effective_employee_id", String(params.effective_employee_id))
  if (params.status) {
    const arr = Array.isArray(params.status) ? params.status : [params.status]
    for (const s of arr) qs.append("status", s)
  }
  return api<ClassSession[]>(`/admin/class-sessions?${qs.toString()}`, {
    method: "GET",
  })
}

export async function getClassSession(id: number): Promise<ClassSession> {
  return api<ClassSession>(`/admin/class-sessions/${id}`, { method: "GET" })
}

export async function getRoster(sessionId: number): Promise<RosterStudent[]> {
  return api<RosterStudent[]>(`/admin/class-sessions/${sessionId}/roster`, {
    method: "GET",
  })
}

export async function cancelSession(
  id: number,
  input: { reason: string },
): Promise<ClassSession> {
  return api<ClassSession>(`/admin/class-sessions/${id}/cancel`, {
    method: "POST",
    body: input,
  })
}

export async function uncancelSession(
  id: number,
  input: { reason?: string },
): Promise<ClassSession> {
  return api<ClassSession>(`/admin/class-sessions/${id}/uncancel`, {
    method: "POST",
    body: input,
  })
}

export async function substituteSession(
  id: number,
  input: { new_effective_employee_id: number; reason?: string },
): Promise<ClassSession> {
  return api<ClassSession>(`/admin/class-sessions/${id}/substitute`, {
    method: "POST",
    body: input,
  })
}

export async function moveSession(
  id: number,
  input: {
    new_timetable_period_id?: number
    new_session_date?: string
    reason?: string
  },
): Promise<ClassSession> {
  return api<ClassSession>(`/admin/class-sessions/${id}/move`, {
    method: "POST",
    body: input,
  })
}

export async function createAdHocSession(input: {
  session_date: string
  programme_semester_id: number
  attendance_group_id: number
  timetable_period_id: number
  programme_semester_subject_id: number
  programme_semester_subject_option_id?: number | null
  scheduled_employee_id: number
  room?: string | null
  note?: string | null
  reason?: string
}): Promise<ClassSession> {
  return api<ClassSession>("/admin/class-sessions/ad-hoc", {
    method: "POST",
    body: input,
  })
}

export type MarkAttendanceInput = {
  allow_amend?: boolean
  on_behalf_of_employee_id?: number
  entries: { student_id: number; status: AttendanceStatus }[]
}

export type ClassSessionAttendance = {
  id: number
  class_session_id: number
  student_id: number
  status: AttendanceStatus
  marked_at: string
  marked_by_employee_id: number
}

export type MarkResult = {
  session: ClassSession
  attendance: ClassSessionAttendance[]
  roster_size: number
}

export async function markAttendance(
  sessionId: number,
  input: MarkAttendanceInput,
): Promise<MarkResult> {
  return api<MarkResult>(`/admin/class-sessions/${sessionId}/mark-attendance`, {
    method: "POST",
    body: input,
  })
}
