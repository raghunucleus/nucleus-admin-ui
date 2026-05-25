import { api } from "@/lib/api"

export type SubjectType = {
  id: number
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSubjectTypeInput = {
  name: string
  code: string
}

export type UpdateSubjectTypeInput = {
  name?: string
  code?: string
}

export type SubjectTypesSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type SubjectTypesSortOrder = "asc" | "desc"

export type SubjectTypeStatusFilter = "active" | "inactive"

export type ListSubjectTypesParams = {
  page?: number
  pageSize?: number
  sortBy?: SubjectTypesSortField
  sortOrder?: SubjectTypesSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: SubjectTypeStatusFilter
}

export type ListSubjectTypesResult = {
  rows: SubjectType[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listSubjectTypes(
  params: ListSubjectTypesParams = {},
): Promise<ListSubjectTypesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListSubjectTypesResult>(`/admin/subject-types${suffix}`, {
    method: "GET",
  })
}

export async function createSubjectType(
  input: CreateSubjectTypeInput,
): Promise<SubjectType> {
  return api<SubjectType>("/admin/subject-types", {
    method: "POST",
    body: input,
  })
}

export async function updateSubjectType(
  id: number,
  patch: UpdateSubjectTypeInput,
): Promise<SubjectType> {
  return api<SubjectType>(`/admin/subject-types/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateSubjectType(id: number): Promise<SubjectType> {
  return api<SubjectType>(`/admin/subject-types/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateSubjectType(id: number): Promise<SubjectType> {
  return api<SubjectType>(`/admin/subject-types/${id}/deactivate`, {
    method: "POST",
  })
}
