import { api } from "@/lib/api"

export type SchoolBoardX = {
  id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSchoolBoardXInput = {
  name: string
  code: string
  description?: string | null
}

export type UpdateSchoolBoardXInput = {
  name?: string
  code?: string
  description?: string | null
}

export type SchoolBoardsXSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type SchoolBoardsXSortOrder = "asc" | "desc"

export type SchoolBoardXStatusFilter = "active" | "inactive"

export type ListSchoolBoardsXParams = {
  page?: number
  pageSize?: number
  sortBy?: SchoolBoardsXSortField
  sortOrder?: SchoolBoardsXSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: SchoolBoardXStatusFilter
}

export type ListSchoolBoardsXResult = {
  rows: SchoolBoardX[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listSchoolBoardsX(
  params: ListSchoolBoardsXParams = {},
): Promise<ListSchoolBoardsXResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListSchoolBoardsXResult>(`/admin/school-boards-x${suffix}`, {
    method: "GET",
  })
}

export async function getSchoolBoardX(id: number): Promise<SchoolBoardX> {
  return api<SchoolBoardX>(`/admin/school-boards-x/${id}`, { method: "GET" })
}

export async function createSchoolBoardX(
  input: CreateSchoolBoardXInput,
): Promise<SchoolBoardX> {
  return api<SchoolBoardX>("/admin/school-boards-x", {
    method: "POST",
    body: input,
  })
}

export async function updateSchoolBoardX(
  id: number,
  patch: UpdateSchoolBoardXInput,
): Promise<SchoolBoardX> {
  return api<SchoolBoardX>(`/admin/school-boards-x/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateSchoolBoardX(id: number): Promise<SchoolBoardX> {
  return api<SchoolBoardX>(`/admin/school-boards-x/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateSchoolBoardX(
  id: number,
): Promise<SchoolBoardX> {
  return api<SchoolBoardX>(`/admin/school-boards-x/${id}/deactivate`, {
    method: "POST",
  })
}
