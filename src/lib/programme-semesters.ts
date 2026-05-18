import { api } from "@/lib/api"
import type { AdmissionYear } from "@/lib/admission-years"
import type { Programme } from "@/lib/programmes"
import type { Semester } from "@/lib/semesters"

export type ProgrammeSemesterStatus = "upcoming" | "ongoing" | "completed"

export type ProgrammeSemester = {
  id: number
  programme_id: number
  programme: Programme
  admission_year_id: number
  admission_year: AdmissionYear
  semester_id: number
  semester: Semester
  is_active: boolean
  status: ProgrammeSemesterStatus
  created_at: string
  updated_at: string
}

export type BulkCreateProgrammeSemestersInput = {
  programme_id: number
  admission_year_id: number
  semester_ids: number[]
}

export type BulkCreateProgrammeSemestersResult = {
  created: ProgrammeSemester[]
  skipped: Array<{
    programme_id: number
    admission_year_id: number
    semester_id: number
    reason: "already_exists"
  }>
}

export type ProgrammeSemestersSortField =
  | "programme"
  | "admission_year"
  | "semester"
  | "status"
  | "created_at"
  | "updated_at"

export type ProgrammeSemestersSortOrder = "asc" | "desc"

export type ProgrammeSemesterStatusFilter = "active" | "inactive"

export type ListProgrammeSemestersParams = {
  page?: number
  pageSize?: number
  sortBy?: ProgrammeSemestersSortField
  sortOrder?: ProgrammeSemestersSortOrder
  status?: ProgrammeSemesterStatusFilter
  programmeId?: number
  admissionYearId?: number
  semesterId?: number
}

export type ListProgrammeSemestersResult = {
  rows: ProgrammeSemester[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listProgrammeSemesters(
  params: ListProgrammeSemestersParams = {},
): Promise<ListProgrammeSemestersResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.status) qs.set("status", params.status)
  if (params.programmeId !== undefined)
    qs.set("programmeId", String(params.programmeId))
  if (params.admissionYearId !== undefined)
    qs.set("admissionYearId", String(params.admissionYearId))
  if (params.semesterId !== undefined)
    qs.set("semesterId", String(params.semesterId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListProgrammeSemestersResult>(
    `/admin/programme-semesters${suffix}`,
    { method: "GET" },
  )
}

export async function bulkCreateProgrammeSemesters(
  input: BulkCreateProgrammeSemestersInput,
): Promise<BulkCreateProgrammeSemestersResult> {
  return api<BulkCreateProgrammeSemestersResult>(
    "/admin/programme-semesters/bulk",
    { method: "POST", body: input },
  )
}

export async function activateProgrammeSemester(
  id: number,
): Promise<ProgrammeSemester> {
  return api<ProgrammeSemester>(
    `/admin/programme-semesters/${id}/activate`,
    { method: "POST" },
  )
}

export async function deactivateProgrammeSemester(
  id: number,
): Promise<ProgrammeSemester> {
  return api<ProgrammeSemester>(
    `/admin/programme-semesters/${id}/deactivate`,
    { method: "POST" },
  )
}

export async function startProgrammeSemester(
  id: number,
): Promise<ProgrammeSemester> {
  return api<ProgrammeSemester>(
    `/admin/programme-semesters/${id}/start`,
    { method: "POST" },
  )
}

export async function completeProgrammeSemester(
  id: number,
): Promise<ProgrammeSemester> {
  return api<ProgrammeSemester>(
    `/admin/programme-semesters/${id}/complete`,
    { method: "POST" },
  )
}
