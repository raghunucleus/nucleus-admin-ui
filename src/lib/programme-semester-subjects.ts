import { api } from "@/lib/api"
import type { AttendanceGroup } from "@/lib/attendance-groups"
import type { Employee } from "@/lib/employees"
import type { ProgrammeSemester } from "@/lib/programme-semesters"
import type { Subject } from "@/lib/subjects"

// One faculty (employee) allocated to teach an elective candidate subject.
export type ProgrammeSemesterSubjectOptionFaculty = {
  id: number
  programme_semester_subject_option_id: number
  employee_id: number
  employee: Employee
  created_at: string
}

export type ProgrammeSemesterSubjectOption = {
  id: number
  programme_semester_subject_id: number
  subject_id: number
  subject: Subject
  /** Faculty allocated to teach this candidate subject (may be more than one). */
  faculty: ProgrammeSemesterSubjectOptionFaculty[]
  created_at: string
}

/** Category of a slot row. Null on real-subject rows. */
export type ProgrammeSemesterSubjectSlotType =
  | "open_elective"
  | "honors"
  | "minors"

export type ProgrammeSemesterSubject = {
  id: number
  programme_semester_id: number
  programme_semester: ProgrammeSemester
  subject_id: number | null
  subject: Subject | null
  placeholder_name: string | null
  /** Set on slot rows (subject_id null); null on real-subject rows. */
  slot_type: ProgrammeSemesterSubjectSlotType | null
  /** PG returns numeric as a string to avoid precision loss; parse with Number() for display. */
  credits: string
  /** Candidate subjects for slot rows. Empty for real-subject rows. */
  options: ProgrammeSemesterSubjectOption[]
  /**
   * Only populated when the list call is scoped to an attendance group. Holds
   * the single teacher allocated to this subject for that group (0 or 1
   * element) — used by the timetable editor's palette. Empty array for slot
   * rows and unassigned cells.
   */
  faculty?: ProgrammeSemesterSubjectGroupFacultyCell[]
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * One cell of the Faculty configuration matrix: the single teacher allocated
 * to teach a real subject for one attendance group. Missing cell = unassigned.
 */
export type ProgrammeSemesterSubjectGroupFacultyCell = {
  id: number
  programme_semester_subject_id: number
  attendance_group_id: number
  employee_id: number
  employee: Employee
}

/**
 * Bundle returned by the faculty-matrix endpoint: real subjects, the batch's
 * attendance groups, and existing (subject × group) cell assignments.
 */
export type FacultyMatrixResult = {
  subjects: ProgrammeSemesterSubject[]
  groups: AttendanceGroup[]
  cells: ProgrammeSemesterSubjectGroupFacultyCell[]
}

export type CreateProgrammeSemesterSubjectInput = {
  programme_semester_id: number
  subject_id?: number
  placeholder_name?: string
  /** Required when this row is a slot. */
  slot_type?: ProgrammeSemesterSubjectSlotType
  /** Required when this row is a slot. */
  option_subject_ids?: number[]
  credits: number
}

export type UpdateProgrammeSemesterSubjectInput = {
  subject_id?: number | null
  placeholder_name?: string | null
  slot_type?: ProgrammeSemesterSubjectSlotType | null
  credits?: number
  /** Replaces the candidate pool wholesale when provided. */
  option_subject_ids?: number[]
}

export type ProgrammeSemesterSubjectsSortField =
  | "created_at"
  | "updated_at"
  | "credits"
  | "status"

export type ListProgrammeSemesterSubjectsParams = {
  page?: number
  pageSize?: number
  sortBy?: ProgrammeSemesterSubjectsSortField
  sortOrder?: "asc" | "desc"
  status?: "active" | "inactive"
  programmeSemesterId?: number
  /**
   * When set, each returned subject is hydrated with `faculty`: the teacher
   * allocated to that subject for this attendance group (0 or 1 element).
   */
  attendanceGroupId?: number
}

export type ListProgrammeSemesterSubjectsResult = {
  rows: ProgrammeSemesterSubject[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listProgrammeSemesterSubjects(
  params: ListProgrammeSemesterSubjectsParams = {},
): Promise<ListProgrammeSemesterSubjectsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.status) qs.set("status", params.status)
  if (params.programmeSemesterId !== undefined)
    qs.set("programmeSemesterId", String(params.programmeSemesterId))
  if (params.attendanceGroupId !== undefined)
    qs.set("attendanceGroupId", String(params.attendanceGroupId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListProgrammeSemesterSubjectsResult>(
    `/admin/programme-semester-subjects${suffix}`,
    { method: "GET" },
  )
}

export async function createProgrammeSemesterSubject(
  input: CreateProgrammeSemesterSubjectInput,
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>("/admin/programme-semester-subjects", {
    method: "POST",
    body: input,
  })
}

export async function updateProgrammeSemesterSubject(
  id: number,
  patch: UpdateProgrammeSemesterSubjectInput,
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>(
    `/admin/programme-semester-subjects/${id}`,
    { method: "PATCH", body: patch },
  )
}

export async function activateProgrammeSemesterSubject(
  id: number,
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>(
    `/admin/programme-semester-subjects/${id}/activate`,
    { method: "POST" },
  )
}

export async function deactivateProgrammeSemesterSubject(
  id: number,
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>(
    `/admin/programme-semester-subjects/${id}/deactivate`,
    { method: "POST" },
  )
}

/**
 * Faculty configuration matrix: real subjects of the semester, attendance
 * groups of the (programme, admission year) batch, and the existing (subject ×
 * group) cell assignments — fetched in one round-trip.
 */
export async function getFacultyMatrix(params: {
  programmeSemesterId: number
  programmeId: number
  admissionYearId: number
}): Promise<FacultyMatrixResult> {
  const qs = new URLSearchParams({
    programmeSemesterId: String(params.programmeSemesterId),
    programmeId: String(params.programmeId),
    admissionYearId: String(params.admissionYearId),
  })
  return api<FacultyMatrixResult>(
    `/admin/programme-semester-subjects/faculty-matrix?${qs.toString()}`,
    { method: "GET" },
  )
}

/**
 * Set (or clear) the single teacher for one (subject, attendance group) cell.
 * employeeId `null` clears the cell. Returns the fresh matrix.
 */
export async function setProgrammeSemesterSubjectGroupFaculty(
  programmeSemesterSubjectId: number,
  attendanceGroupId: number,
  employeeId: number | null,
): Promise<FacultyMatrixResult> {
  return api<FacultyMatrixResult>(
    `/admin/programme-semester-subjects/${programmeSemesterSubjectId}/groups/${attendanceGroupId}/faculty`,
    { method: "PUT", body: { employee_id: employeeId } },
  )
}

/**
 * Replace the faculty roster for one candidate subject of an open-elective
 * slot. Returns the parent subject entry with the full refreshed graph.
 */
export async function setProgrammeSemesterSubjectOptionFaculty(
  optionId: number,
  employeeIds: number[],
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>(
    `/admin/programme-semester-subjects/options/${optionId}/faculty`,
    { method: "PUT", body: { employee_ids: employeeIds } },
  )
}
