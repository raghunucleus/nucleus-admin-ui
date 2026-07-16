import { api } from "@/lib/api"

export type SchoolBoardXii = {
  id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSchoolBoardXiiInput = {
  name: string
  code: string
  description?: string | null
}

export type UpdateSchoolBoardXiiInput = {
  name?: string
  code?: string
  description?: string | null
}

export type SchoolBoardsXiiSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type SchoolBoardsXiiSortOrder = "asc" | "desc"

export type SchoolBoardXiiStatusFilter = "active" | "inactive"

export type ListSchoolBoardsXiiParams = {
  page?: number
  pageSize?: number
  sortBy?: SchoolBoardsXiiSortField
  sortOrder?: SchoolBoardsXiiSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: SchoolBoardXiiStatusFilter
}

export type ListSchoolBoardsXiiResult = {
  rows: SchoolBoardXii[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listSchoolBoardsXii(
  params: ListSchoolBoardsXiiParams = {},
): Promise<ListSchoolBoardsXiiResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListSchoolBoardsXiiResult>(`/admin/school-boards-xii${suffix}`, {
    method: "GET",
  })
}

export async function getSchoolBoardXii(id: number): Promise<SchoolBoardXii> {
  return api<SchoolBoardXii>(`/admin/school-boards-xii/${id}`, { method: "GET" })
}

export async function createSchoolBoardXii(
  input: CreateSchoolBoardXiiInput,
): Promise<SchoolBoardXii> {
  return api<SchoolBoardXii>("/admin/school-boards-xii", {
    method: "POST",
    body: input,
  })
}

export async function updateSchoolBoardXii(
  id: number,
  patch: UpdateSchoolBoardXiiInput,
): Promise<SchoolBoardXii> {
  return api<SchoolBoardXii>(`/admin/school-boards-xii/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateSchoolBoardXii(
  id: number,
): Promise<SchoolBoardXii> {
  return api<SchoolBoardXii>(`/admin/school-boards-xii/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateSchoolBoardXii(
  id: number,
): Promise<SchoolBoardXii> {
  return api<SchoolBoardXii>(`/admin/school-boards-xii/${id}/deactivate`, {
    method: "POST",
  })
}
