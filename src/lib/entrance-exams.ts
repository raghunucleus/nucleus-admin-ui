import { api } from "@/lib/api"

export type EntranceExam = {
  id: number
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateEntranceExamInput = {
  name: string
  code: string
  description?: string | null
}

export type UpdateEntranceExamInput = {
  name?: string
  code?: string
  description?: string | null
}

export type EntranceExamsSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type EntranceExamsSortOrder = "asc" | "desc"

export type EntranceExamStatusFilter = "active" | "inactive"

export type ListEntranceExamsParams = {
  page?: number
  pageSize?: number
  sortBy?: EntranceExamsSortField
  sortOrder?: EntranceExamsSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: EntranceExamStatusFilter
}

export type ListEntranceExamsResult = {
  rows: EntranceExam[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listEntranceExams(
  params: ListEntranceExamsParams = {},
): Promise<ListEntranceExamsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListEntranceExamsResult>(`/admin/entrance-exams${suffix}`, {
    method: "GET",
  })
}

export async function getEntranceExam(id: number): Promise<EntranceExam> {
  return api<EntranceExam>(`/admin/entrance-exams/${id}`, { method: "GET" })
}

export async function createEntranceExam(
  input: CreateEntranceExamInput,
): Promise<EntranceExam> {
  return api<EntranceExam>("/admin/entrance-exams", {
    method: "POST",
    body: input,
  })
}

export async function updateEntranceExam(
  id: number,
  patch: UpdateEntranceExamInput,
): Promise<EntranceExam> {
  return api<EntranceExam>(`/admin/entrance-exams/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateEntranceExam(id: number): Promise<EntranceExam> {
  return api<EntranceExam>(`/admin/entrance-exams/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateEntranceExam(
  id: number,
): Promise<EntranceExam> {
  return api<EntranceExam>(`/admin/entrance-exams/${id}/deactivate`, {
    method: "POST",
  })
}
