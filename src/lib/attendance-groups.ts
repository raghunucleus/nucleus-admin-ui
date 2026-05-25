import { api } from "@/lib/api"
import type { Student } from "@/lib/students"

// A student's group memberships — one row per student, one column per group
// type (attendance_group_id now; fee_group_id and others later). Returned
// nested as an attendance group's `members`.
export type StudentGroup = {
  id: number
  student_id: number
  student: Student
  attendance_group_id: number | null
  created_at: string
  updated_at: string
}

// A named cohort of students within one programme × admission-year batch. The
// grouping carries across every semester of the batch; a timetable is later
// linked to each group, and its students follow that timetable.
export type AttendanceGroup = {
  id: number
  programme_id: number
  admission_year_id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
  members: StudentGroup[]
  created_at: string
  updated_at: string
}

export async function listAttendanceGroups(
  programmeId: number,
  admissionYearId: number,
): Promise<AttendanceGroup[]> {
  return api<AttendanceGroup[]>(
    `/admin/attendance-groups?programmeId=${programmeId}&admissionYearId=${admissionYearId}`,
    { method: "GET" },
  )
}

/**
 * Students eligible for this batch's attendance groups — the unassigned pool:
 * active students of the programme × admission year not yet in any group.
 */
export async function listEligibleStudents(
  programmeId: number,
  admissionYearId: number,
): Promise<Student[]> {
  return api<Student[]>(
    `/admin/attendance-groups/eligible-students?programmeId=${programmeId}&admissionYearId=${admissionYearId}`,
    { method: "GET" },
  )
}

export async function createAttendanceGroup(input: {
  programme_id: number
  admission_year_id: number
  name: string
  code: string
  description?: string | null
}): Promise<AttendanceGroup> {
  return api<AttendanceGroup>("/admin/attendance-groups", {
    method: "POST",
    body: input,
  })
}

export async function updateAttendanceGroup(
  id: number,
  input: { name: string; code: string; description?: string | null },
): Promise<AttendanceGroup> {
  return api<AttendanceGroup>(`/admin/attendance-groups/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export async function activateAttendanceGroup(
  id: number,
): Promise<AttendanceGroup> {
  return api<AttendanceGroup>(`/admin/attendance-groups/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateAttendanceGroup(
  id: number,
): Promise<AttendanceGroup> {
  return api<AttendanceGroup>(`/admin/attendance-groups/${id}/deactivate`, {
    method: "POST",
  })
}

/**
 * Add students to a group. A student already in another group of the same
 * batch is moved here. Returns the updated group.
 */
export async function addAttendanceGroupStudents(
  id: number,
  studentIds: number[],
): Promise<AttendanceGroup> {
  return api<AttendanceGroup>(`/admin/attendance-groups/${id}/students`, {
    method: "POST",
    body: { student_ids: studentIds },
  })
}

export async function removeAttendanceGroupStudent(
  id: number,
  studentId: number,
): Promise<AttendanceGroup> {
  return api<AttendanceGroup>(
    `/admin/attendance-groups/${id}/students/${studentId}`,
    { method: "DELETE" },
  )
}
