import { api } from "@/lib/api"
import type { AdmissionYear } from "@/lib/admission-years"
import type { Programme } from "@/lib/programmes"
import type { Regulation } from "@/lib/regulations"

export type ProgrammeRegulation = {
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

export type CreateProgrammeRegulationInput = {
  programme_id: number
  admission_year_id: number
  regulation_id: number
}

export type UpdateProgrammeRegulationInput = {
  regulation_id: number
}

export type ProgrammeRegulationsSortField =
  | "programme"
  | "admission_year"
  | "regulation"
  | "status"
  | "created_at"
  | "updated_at"

export type ProgrammeRegulationsSortOrder = "asc" | "desc"

export type ProgrammeRegulationStatusFilter = "active" | "inactive"

export type ListProgrammeRegulationsParams = {
  page?: number
  pageSize?: number
  sortBy?: ProgrammeRegulationsSortField
  sortOrder?: ProgrammeRegulationsSortOrder
  status?: ProgrammeRegulationStatusFilter
  programmeId?: number
  admissionYearId?: number
  regulationId?: number
}

export type ListProgrammeRegulationsResult = {
  rows: ProgrammeRegulation[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listProgrammeRegulations(
  params: ListProgrammeRegulationsParams = {},
): Promise<ListProgrammeRegulationsResult> {
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
  return api<ListProgrammeRegulationsResult>(
    `/admin/programme-regulations${suffix}`,
    { method: "GET" },
  )
}

export async function createProgrammeRegulation(
  input: CreateProgrammeRegulationInput,
): Promise<ProgrammeRegulation> {
  return api<ProgrammeRegulation>("/admin/programme-regulations", {
    method: "POST",
    body: input,
  })
}

export async function updateProgrammeRegulation(
  id: number,
  patch: UpdateProgrammeRegulationInput,
): Promise<ProgrammeRegulation> {
  return api<ProgrammeRegulation>(`/admin/programme-regulations/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateProgrammeRegulation(
  id: number,
): Promise<ProgrammeRegulation> {
  return api<ProgrammeRegulation>(
    `/admin/programme-regulations/${id}/activate`,
    { method: "POST" },
  )
}

export async function deactivateProgrammeRegulation(
  id: number,
): Promise<ProgrammeRegulation> {
  return api<ProgrammeRegulation>(
    `/admin/programme-regulations/${id}/deactivate`,
    { method: "POST" },
  )
}
