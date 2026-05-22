import { api } from "@/lib/api"
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

// One faculty (employee) allocated to teach a configured subject. A subject
// may have several — multiple rows share programme_semester_subject_id.
export type ProgrammeSemesterSubjectFaculty = {
  id: number
  programme_semester_subject_id: number
  employee_id: number
  employee: Employee
  created_at: string
}

export type ProgrammeSemesterSubject = {
  id: number
  programme_semester_id: number
  programme_semester: ProgrammeSemester
  subject_id: number | null
  subject: Subject | null
  placeholder_name: string | null
  /** PG returns numeric as a string to avoid precision loss; parse with Number() for display. */
  credits: string
  /** Candidate subjects for elective slots. Empty for real-subject rows. */
  options: ProgrammeSemesterSubjectOption[]
  /** Faculty allocated to teach this subject (may be more than one). */
  faculty: ProgrammeSemesterSubjectFaculty[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateProgrammeSemesterSubjectInput = {
  programme_semester_id: number
  subject_id?: number
  placeholder_name?: string
  /** Required when this row is an open-elective slot. */
  option_subject_ids?: number[]
  credits: number
}

export type UpdateProgrammeSemesterSubjectInput = {
  subject_id?: number | null
  placeholder_name?: string | null
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
 * Replace the faculty roster for a subject entry. Send the complete list of
 * employee ids; an empty array clears all allocated faculty.
 */
export async function setProgrammeSemesterSubjectFaculty(
  id: number,
  employeeIds: number[],
): Promise<ProgrammeSemesterSubject> {
  return api<ProgrammeSemesterSubject>(
    `/admin/programme-semester-subjects/${id}/faculty`,
    { method: "PUT", body: { employee_ids: employeeIds } },
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
