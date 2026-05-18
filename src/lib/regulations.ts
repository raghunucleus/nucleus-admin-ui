import { api } from "@/lib/api"

export type Regulation = {
  id: number
  name: string
  code: string
  year_of_regulation: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateRegulationInput = {
  name: string
  code: string
  year_of_regulation: number
  description?: string | null
}

export type UpdateRegulationInput = {
  name?: string
  code?: string
  year_of_regulation?: number
  description?: string | null
}

export type RegulationsSortField =
  | "name"
  | "code"
  | "year_of_regulation"
  | "status"
  | "created_at"
  | "updated_at"

export type RegulationsSortOrder = "asc" | "desc"

export type RegulationStatusFilter = "active" | "inactive"

export type ListRegulationsParams = {
  page?: number
  pageSize?: number
  sortBy?: RegulationsSortField
  sortOrder?: RegulationsSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: RegulationStatusFilter
}

export type ListRegulationsResult = {
  rows: Regulation[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listRegulations(
  params: ListRegulationsParams = {},
): Promise<ListRegulationsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListRegulationsResult>(`/admin/regulations${suffix}`, { method: "GET" })
}

export async function createRegulation(
  input: CreateRegulationInput,
): Promise<Regulation> {
  return api<Regulation>("/admin/regulations", { method: "POST", body: input })
}

export async function updateRegulation(
  id: number,
  patch: UpdateRegulationInput,
): Promise<Regulation> {
  return api<Regulation>(`/admin/regulations/${id}`, { method: "PATCH", body: patch })
}

export async function activateRegulation(id: number): Promise<Regulation> {
  return api<Regulation>(`/admin/regulations/${id}/activate`, { method: "POST" })
}

export async function deactivateRegulation(id: number): Promise<Regulation> {
  return api<Regulation>(`/admin/regulations/${id}/deactivate`, { method: "POST" })
}
