import { api } from "@/lib/api"
import type { Regulation } from "@/lib/regulations"
import type { SubjectType } from "@/lib/subject-types"

export type Subject = {
  id: number
  regulation_id: number
  regulation: Regulation
  subject_type_id: number
  subject_type: SubjectType
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSubjectInput = {
  regulation_id: number
  subject_type_id: number
  code: string
  name: string
}

export type UpdateSubjectInput = {
  subject_type_id?: number
  code?: string
  name?: string
}

export type SubjectsSortField =
  | "code"
  | "name"
  | "status"
  | "created_at"
  | "updated_at"

export type SubjectsSortOrder = "asc" | "desc"

export type SubjectStatusFilter = "active" | "inactive"

export type ListSubjectsParams = {
  page?: number
  pageSize?: number
  sortBy?: SubjectsSortField
  sortOrder?: SubjectsSortOrder
  codeSearch?: string
  nameSearch?: string
  status?: SubjectStatusFilter
  regulationId?: number
  subjectTypeId?: number
}

export type ListSubjectsResult = {
  rows: Subject[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listSubjects(
  params: ListSubjectsParams = {},
): Promise<ListSubjectsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.status) qs.set("status", params.status)
  if (params.regulationId !== undefined)
    qs.set("regulationId", String(params.regulationId))
  if (params.subjectTypeId !== undefined)
    qs.set("subjectTypeId", String(params.subjectTypeId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListSubjectsResult>(`/admin/subjects${suffix}`, { method: "GET" })
}

export async function createSubject(
  input: CreateSubjectInput,
): Promise<Subject> {
  return api<Subject>("/admin/subjects", { method: "POST", body: input })
}

export async function updateSubject(
  id: number,
  patch: UpdateSubjectInput,
): Promise<Subject> {
  return api<Subject>(`/admin/subjects/${id}`, { method: "PATCH", body: patch })
}

export async function activateSubject(id: number): Promise<Subject> {
  return api<Subject>(`/admin/subjects/${id}/activate`, { method: "POST" })
}

export async function deactivateSubject(id: number): Promise<Subject> {
  return api<Subject>(`/admin/subjects/${id}/deactivate`, { method: "POST" })
}
