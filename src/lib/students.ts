import { api } from "@/lib/api"
import type { AdmissionYear } from "@/lib/admission-years"
import type { Programme } from "@/lib/programmes"

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
