import { api } from "@/lib/api"
import type { Degree } from "@/lib/degrees"
import type { Department } from "@/lib/departments"

export type Programme = {
  id: number
  name: string
  code: string
  display_name: string
  degree_id: number
  degree: Degree
  department_id: number
  department: Department
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateProgrammeInput = {
  name: string
  code: string
  display_name: string
  degree_id: number
  department_id: number
}

export type UpdateProgrammeInput = {
  name?: string
  code?: string
  display_name?: string
  degree_id?: number
  department_id?: number
}

export type ProgrammesSortField =
  | "name"
  | "code"
  | "display_name"
  | "degree"
  | "department"
  | "status"
  | "created_at"
  | "updated_at"

export type ProgrammesSortOrder = "asc" | "desc"

export type ProgrammeStatusFilter = "active" | "inactive"

export type ListProgrammesParams = {
  page?: number
  pageSize?: number
  sortBy?: ProgrammesSortField
  sortOrder?: ProgrammesSortOrder
  nameSearch?: string
  codeSearch?: string
  displayNameSearch?: string
  status?: ProgrammeStatusFilter
  degreeId?: number
  departmentId?: number
}

export type ListProgrammesResult = {
  rows: Programme[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listProgrammes(
  params: ListProgrammesParams = {},
): Promise<ListProgrammesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.displayNameSearch)
    qs.set("displayNameSearch", params.displayNameSearch)
  if (params.status) qs.set("status", params.status)
  if (params.degreeId !== undefined) qs.set("degreeId", String(params.degreeId))
  if (params.departmentId !== undefined)
    qs.set("departmentId", String(params.departmentId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListProgrammesResult>(`/admin/programmes${suffix}`, { method: "GET" })
}

export async function createProgramme(
  input: CreateProgrammeInput,
): Promise<Programme> {
  return api<Programme>("/admin/programmes", { method: "POST", body: input })
}

export async function updateProgramme(
  id: number,
  patch: UpdateProgrammeInput,
): Promise<Programme> {
  return api<Programme>(`/admin/programmes/${id}`, { method: "PATCH", body: patch })
}

export async function activateProgramme(id: number): Promise<Programme> {
  return api<Programme>(`/admin/programmes/${id}/activate`, { method: "POST" })
}

export async function deactivateProgramme(id: number): Promise<Programme> {
  return api<Programme>(`/admin/programmes/${id}/deactivate`, { method: "POST" })
}
