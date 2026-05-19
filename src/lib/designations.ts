import { api } from "@/lib/api"

export type Designation = {
  id: number
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateDesignationInput = {
  name: string
  code: string
}

export type UpdateDesignationInput = {
  name?: string
  code?: string
}

export type DesignationsSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type DesignationsSortOrder = "asc" | "desc"

export type DesignationStatusFilter = "active" | "inactive"

export type ListDesignationsParams = {
  page?: number
  pageSize?: number
  sortBy?: DesignationsSortField
  sortOrder?: DesignationsSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: DesignationStatusFilter
}

export type ListDesignationsResult = {
  rows: Designation[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listDesignations(
  params: ListDesignationsParams = {},
): Promise<ListDesignationsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListDesignationsResult>(`/admin/designations${suffix}`, {
    method: "GET",
  })
}

export async function createDesignation(
  input: CreateDesignationInput,
): Promise<Designation> {
  return api<Designation>("/admin/designations", { method: "POST", body: input })
}

export async function updateDesignation(
  id: number,
  patch: UpdateDesignationInput,
): Promise<Designation> {
  return api<Designation>(`/admin/designations/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateDesignation(id: number): Promise<Designation> {
  return api<Designation>(`/admin/designations/${id}/activate`, { method: "POST" })
}

export async function deactivateDesignation(id: number): Promise<Designation> {
  return api<Designation>(`/admin/designations/${id}/deactivate`, {
    method: "POST",
  })
}
