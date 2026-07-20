import { api } from "@/lib/api"
import type { Country, District, State } from "@/lib/address-attributes"
import type { AdmissionYear } from "@/lib/admission-years"
import type { DiplomaBoard } from "@/lib/diploma-boards"
import type { EntranceExam } from "@/lib/entrance-exams"
import type { Programme } from "@/lib/programmes"
import type { SchoolBoardX } from "@/lib/school-boards-x"
import type { SchoolBoardXii } from "@/lib/school-boards-xii"

export const GENDERS = ["male", "female", "other"] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
}

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const
export type BloodGroup = (typeof BLOOD_GROUPS)[number]

// How the student entered the programme. Stored in the DB as 1 (Regular) or
// 2 (Lateral); the labels are only for display.
export const ENTRY_TYPES = [1, 2] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  1: "Regular",
  2: "Lateral",
}

export type Student = {
  id: number
  student_id: string
  programme_id: number
  programme?: Programme
  admission_year_id: number
  admission_year?: AdmissionYear
  display_name: string
  gender: Gender
  entry_type: EntryType
  dob: string
  blood_group: BloodGroup | null
  abc_id: string | null
  mobile_number: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string

  // --- Extended profile ----------------------------------------------------
  // Numeric (Postgres `numeric`) columns serialize as strings, e.g. "85.50".
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  personal_email: string | null
  // Unverified address staged while a student OTP is in flight.
  personal_email_pending: string | null
  pass_out_year: number | null
  tenth_percentage: string | null
  twelfth_percentage: string | null
  diploma_percentage: string | null
  ug_cgpa: string | null
  current_backlogs: number | null
  backlog_history: boolean
  // The student's resume: a link they host elsewhere (Drive, portfolio…) and
  // keep reachable. We don't host resume files.
  resume_external_url: string | null
  parent_name: string | null
  parent_mobile: string | null
  parent_email: string | null
  guardian_name: string | null
  guardian_mobile: string | null
  guardian_email: string | null
  home_address: string | null
  home_district_id: number | null
  home_pincode: string | null
  home_state_id: number | null
  home_country_id: number | null
  aadhaar_number: string | null
  pan_number: string | null
  entrance_exam_na: boolean
  entrance_exam_rank: number | null
  entrance_exam_id: number | null
  entrance_exam_year: number | null
  year_of_gap: number | null
  reason_of_gap: string | null
  tenth_board_id: number | null
  tenth_institution: string | null
  tenth_year_of_pass: number | null
  tenth_state_id: number | null
  twelfth_board_id: number | null
  twelfth_institution: string | null
  twelfth_year_of_pass: number | null
  twelfth_state_id: number | null
  diploma_board_id: number | null
  diploma_institution: string | null
  diploma_year_of_pass: number | null
  diploma_specialization: string | null
  diploma_state_id: number | null
  allowed_by_dept_for_placements: boolean | null
  interested_in_placements_self: boolean | null

  // Loaded relations — present on GET /admin/students/:id only (list rows and
  // PATCH responses omit them).
  home_district?: District | null
  home_state?: State | null
  home_country?: Country | null
  entrance_exam?: EntranceExam | null
  tenth_board?: SchoolBoardX | null
  tenth_state?: State | null
  twelfth_board?: SchoolBoardXii | null
  twelfth_state?: State | null
  diploma_board?: DiplomaBoard | null
  diploma_state?: State | null
}

export type CreateStudentInput = {
  student_id: string
  programme_id: number
  admission_year_id: number
  display_name: string
  gender: Gender
  entry_type: EntryType
  dob: string
  blood_group: BloodGroup | null
  abc_id: string | null
  mobile_number: string
  email: string
}

export type UpdateStudentInput = {
  student_id?: string
  programme_id?: number
  admission_year_id?: number
  display_name?: string
  gender?: Gender
  entry_type?: EntryType
  dob?: string
  blood_group?: BloodGroup | null
  abc_id?: string | null
  mobile_number?: string
  email?: string

  // --- Extended profile (all optional; null clears a nullable field) --------
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  personal_email?: string | null
  pass_out_year?: number | null
  tenth_percentage?: number | null
  twelfth_percentage?: number | null
  diploma_percentage?: number | null
  ug_cgpa?: number | null
  current_backlogs?: number | null
  backlog_history?: boolean
  parent_name?: string | null
  parent_mobile?: string | null
  parent_email?: string | null
  guardian_name?: string | null
  guardian_mobile?: string | null
  guardian_email?: string | null
  home_address?: string | null
  home_district_id?: number | null
  home_pincode?: string | null
  home_state_id?: number | null
  home_country_id?: number | null
  aadhaar_number?: string | null
  pan_number?: string | null
  entrance_exam_na?: boolean
  entrance_exam_id?: number | null
  entrance_exam_rank?: number | null
  entrance_exam_year?: number | null
  year_of_gap?: number | null
  reason_of_gap?: string | null
  tenth_board_id?: number | null
  tenth_institution?: string | null
  tenth_year_of_pass?: number | null
  tenth_state_id?: number | null
  twelfth_board_id?: number | null
  twelfth_institution?: string | null
  twelfth_year_of_pass?: number | null
  twelfth_state_id?: number | null
  diploma_board_id?: number | null
  diploma_institution?: string | null
  diploma_year_of_pass?: number | null
  diploma_specialization?: string | null
  diploma_state_id?: number | null
  allowed_by_dept_for_placements?: boolean | null
  interested_in_placements_self?: boolean | null
}

export type StudentsSortField =
  | "student_id"
  | "display_name"
  | "gender"
  | "mobile_number"
  | "email"
  | "abc_id"
  | "dob"
  | "status"
  | "created_at"
  | "updated_at"

export type StudentsSortOrder = "asc" | "desc"

export type StudentStatusFilter = "active" | "inactive"

export type ListStudentsParams = {
  page?: number
  pageSize?: number
  sortBy?: StudentsSortField
  sortOrder?: StudentsSortOrder
  studentIdSearch?: string
  displayNameSearch?: string
  emailSearch?: string
  mobileSearch?: string
  abcIdSearch?: string
  status?: StudentStatusFilter
  gender?: Gender
  entryType?: EntryType
  bloodGroup?: BloodGroup
  programmeId?: number
  admissionYearId?: number
}

export type ListStudentsResult = {
  rows: Student[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listStudents(
  params: ListStudentsParams = {},
): Promise<ListStudentsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.studentIdSearch) qs.set("studentIdSearch", params.studentIdSearch)
  if (params.displayNameSearch)
    qs.set("displayNameSearch", params.displayNameSearch)
  if (params.emailSearch) qs.set("emailSearch", params.emailSearch)
  if (params.mobileSearch) qs.set("mobileSearch", params.mobileSearch)
  if (params.abcIdSearch) qs.set("abcIdSearch", params.abcIdSearch)
  if (params.status) qs.set("status", params.status)
  if (params.gender) qs.set("gender", params.gender)
  if (params.entryType !== undefined)
    qs.set("entryType", String(params.entryType))
  if (params.bloodGroup) qs.set("bloodGroup", params.bloodGroup)
  if (params.programmeId !== undefined)
    qs.set("programmeId", String(params.programmeId))
  if (params.admissionYearId !== undefined)
    qs.set("admissionYearId", String(params.admissionYearId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListStudentsResult>(`/admin/students${suffix}`, { method: "GET" })
}

export async function getStudent(id: number): Promise<Student> {
  return api<Student>(`/admin/students/${id}`, { method: "GET" })
}

export async function createStudent(
  input: CreateStudentInput,
): Promise<Student> {
  return api<Student>("/admin/students", { method: "POST", body: input })
}

export async function updateStudent(
  id: number,
  patch: UpdateStudentInput,
): Promise<Student> {
  return api<Student>(`/admin/students/${id}`, { method: "PATCH", body: patch })
}

export async function activateStudent(id: number): Promise<Student> {
  return api<Student>(`/admin/students/${id}/activate`, { method: "POST" })
}

export async function deactivateStudent(id: number): Promise<Student> {
  return api<Student>(`/admin/students/${id}/deactivate`, { method: "POST" })
}

/**
 * Provision (or reset) the student's login. The server generates a random
 * temporary password, emails it to the student's registered address, forces a
 * change on first sign-in, and revokes any active sessions. Returns the
 * address the email was sent to.
 */
export async function resetStudentLoginPassword(
  id: number,
): Promise<{ email: string }> {
  return api<{ email: string }>(`/admin/students/${id}/reset-password`, {
    method: "POST",
  })
}

/**
 * Directly set the student's login password to an admin-chosen value. No email
 * is sent; the student is still forced to change it on first sign-in, and any
 * active sessions are revoked.
 */
export async function setStudentLoginPassword(
  id: number,
  password: string,
): Promise<void> {
  return api<void>(`/admin/students/${id}/set-password`, {
    method: "POST",
    body: { password },
  })
}

export type BulkCreateStudentRow = {
  student_id: string
  display_name: string
  gender: Gender
  entry_type: EntryType
  dob: string
  blood_group: BloodGroup | null
  abc_id: string | null
  mobile_number: string
  email: string
}

export type BulkRowError = {
  rowIndex: number
  field?: string
  message: string
}

export async function bulkCreateStudents(
  programmeId: number,
  admissionYearId: number,
  rows: BulkCreateStudentRow[],
): Promise<{ created: number }> {
  return api<{ created: number }>("/admin/students/bulk", {
    method: "POST",
    body: {
      programme_id: programmeId,
      admission_year_id: admissionYearId,
      rows,
    },
  })
}

export async function listStudentIds(): Promise<string[]> {
  const result = await api<{ ids: string[] }>("/admin/students/student-ids", {
    method: "GET",
  })
  return result.ids
}

/* ----------------------------------------------------- certifications */

export type StudentCertification = {
  id: number
  industry_certification_id: number
  name: string
  // Presigned read URL; null when the file couldn't be resolved.
  certificate_file_url: string | null
  created_at: string
}

export async function listStudentCertifications(
  studentId: number,
): Promise<StudentCertification[]> {
  return api<StudentCertification[]>(
    `/admin/students/${studentId}/certifications`,
    { method: "GET" },
  )
}

/**
 * Add a certification with its supporting file (PDF/JPEG/PNG, ≤ 5 MB).
 * Returns the updated list. 409 when the student already holds it.
 */
export async function addStudentCertification(
  studentId: number,
  industryCertificationId: number,
  file: File,
): Promise<StudentCertification[]> {
  const form = new FormData()
  form.set("industry_certification_id", String(industryCertificationId))
  form.set("file", file)
  return api<StudentCertification[]>(
    `/admin/students/${studentId}/certifications`,
    { method: "POST", body: form },
  )
}

export async function removeStudentCertification(
  studentId: number,
  certRowId: number,
): Promise<void> {
  return api<void>(
    `/admin/students/${studentId}/certifications/${certRowId}`,
    { method: "DELETE" },
  )
}

/* ------------------------------------------------------------- resume */

/** Snapshot of the student's resume link returned by resume mutations. */
export type ResumeView = {
  external_url: string | null
}

/** Set the student's resume link (https:// only, max 512 chars). */
export async function setStudentResumeExternalUrl(
  studentId: number,
  url: string,
): Promise<ResumeView> {
  return api<ResumeView>(`/admin/students/${studentId}/resume/external-url`, {
    method: "PUT",
    body: { url },
  })
}

export async function clearStudentResumeExternalUrl(
  studentId: number,
): Promise<ResumeView> {
  return api<ResumeView>(`/admin/students/${studentId}/resume/external-url`, {
    method: "DELETE",
  })
}
