import { api } from "@/lib/api"

export type DiplomaBoard = {
  id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateDiplomaBoardInput = {
  name: string
  code: string
  description?: string | null
}

export type UpdateDiplomaBoardInput = {
  name?: string
  code?: string
  description?: string | null
}

export type DiplomaBoardsSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type DiplomaBoardsSortOrder = "asc" | "desc"

export type DiplomaBoardStatusFilter = "active" | "inactive"

export type ListDiplomaBoardsParams = {
  page?: number
  pageSize?: number
  sortBy?: DiplomaBoardsSortField
  sortOrder?: DiplomaBoardsSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: DiplomaBoardStatusFilter
}

export type ListDiplomaBoardsResult = {
  rows: DiplomaBoard[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listDiplomaBoards(
  params: ListDiplomaBoardsParams = {},
): Promise<ListDiplomaBoardsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListDiplomaBoardsResult>(`/admin/diploma-boards${suffix}`, {
    method: "GET",
  })
}

export async function getDiplomaBoard(id: number): Promise<DiplomaBoard> {
  return api<DiplomaBoard>(`/admin/diploma-boards/${id}`, { method: "GET" })
}

export async function createDiplomaBoard(
  input: CreateDiplomaBoardInput,
): Promise<DiplomaBoard> {
  return api<DiplomaBoard>("/admin/diploma-boards", {
    method: "POST",
    body: input,
  })
}

export async function updateDiplomaBoard(
  id: number,
  patch: UpdateDiplomaBoardInput,
): Promise<DiplomaBoard> {
  return api<DiplomaBoard>(`/admin/diploma-boards/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateDiplomaBoard(id: number): Promise<DiplomaBoard> {
  return api<DiplomaBoard>(`/admin/diploma-boards/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateDiplomaBoard(
  id: number,
): Promise<DiplomaBoard> {
  return api<DiplomaBoard>(`/admin/diploma-boards/${id}/deactivate`, {
    method: "POST",
  })
}
