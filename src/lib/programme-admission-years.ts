import { api } from "@/lib/api"
import type { AdmissionYear } from "@/lib/admission-years"
import type { Programme } from "@/lib/programmes"
import type { Regulation } from "@/lib/regulations"

export type ProgrammeAdmissionYear = {
  id: number
  programme_id: number
  programme: Programme
  admission_year_id: number
  admission_year: AdmissionYear
  regulation_id: number
  regulation: Regulation
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateProgrammeAdmissionYearInput = {
  programme_id: number
  admission_year_id: number
  regulation_id: number
}

export type UpdateProgrammeAdmissionYearInput = {
  regulation_id: number
}

export type ProgrammeAdmissionYearsSortField =
  | "programme"
  | "admission_year"
  | "regulation"
  | "status"
  | "created_at"
  | "updated_at"

export type ProgrammeAdmissionYearsSortOrder = "asc" | "desc"

export type ProgrammeAdmissionYearStatusFilter = "active" | "inactive"

export type ListProgrammeAdmissionYearsParams = {
  page?: number
  pageSize?: number
  sortBy?: ProgrammeAdmissionYearsSortField
  sortOrder?: ProgrammeAdmissionYearsSortOrder
  status?: ProgrammeAdmissionYearStatusFilter
  programmeId?: number
  admissionYearId?: number
  regulationId?: number
}

export type ListProgrammeAdmissionYearsResult = {
  rows: ProgrammeAdmissionYear[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listProgrammeAdmissionYears(
  params: ListProgrammeAdmissionYearsParams = {},
): Promise<ListProgrammeAdmissionYearsResult> {
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
  if (params.regulationId !== undefined)
    qs.set("regulationId", String(params.regulationId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListProgrammeAdmissionYearsResult>(
    `/admin/programme-admission-years${suffix}`,
    { method: "GET" },
  )
}

export async function createProgrammeAdmissionYear(
  input: CreateProgrammeAdmissionYearInput,
): Promise<ProgrammeAdmissionYear> {
  return api<ProgrammeAdmissionYear>("/admin/programme-admission-years", {
    method: "POST",
    body: input,
  })
}

export async function updateProgrammeAdmissionYear(
  id: number,
  patch: UpdateProgrammeAdmissionYearInput,
): Promise<ProgrammeAdmissionYear> {
  return api<ProgrammeAdmissionYear>(`/admin/programme-admission-years/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateProgrammeAdmissionYear(
  id: number,
): Promise<ProgrammeAdmissionYear> {
  return api<ProgrammeAdmissionYear>(
    `/admin/programme-admission-years/${id}/activate`,
    { method: "POST" },
  )
}

export async function deactivateProgrammeAdmissionYear(
  id: number,
): Promise<ProgrammeAdmissionYear> {
  return api<ProgrammeAdmissionYear>(
    `/admin/programme-admission-years/${id}/deactivate`,
    { method: "POST" },
  )
}

export type ProgrammeAdmissionYearMatrixCell = {
  id: number
  programme_id: number
  admission_year_id: number
  is_active: boolean
}

export async function getProgrammeAdmissionYearMatrix(): Promise<
  ProgrammeAdmissionYearMatrixCell[]
> {
  return api<ProgrammeAdmissionYearMatrixCell[]>(
    "/admin/programme-admission-years/matrix",
    { method: "GET" },
  )
}
