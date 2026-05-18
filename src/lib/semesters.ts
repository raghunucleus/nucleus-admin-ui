import { api } from "@/lib/api"

export type Semester = {
  id: number
  sem_number: number
  code: string
  name: string
  year_sem_format: string
  roman_format: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateSemesterInput = {
  sem_number: number
  code: string
  name: string
  year_sem_format: string
  roman_format: string
}

export type UpdateSemesterInput = {
  sem_number?: number
  code?: string
  name?: string
  year_sem_format?: string
  roman_format?: string
}

export type SemestersSortField =
  | "sem_number"
  | "code"
  | "name"
  | "year_sem_format"
  | "roman_format"
  | "status"
  | "created_at"
  | "updated_at"

export type SemestersSortOrder = "asc" | "desc"

export type SemesterStatusFilter = "active" | "inactive"

export type ListSemestersParams = {
  page?: number
  pageSize?: number
  sortBy?: SemestersSortField
  sortOrder?: SemestersSortOrder
  semNumberSearch?: string
  codeSearch?: string
  nameSearch?: string
  status?: SemesterStatusFilter
}

export type ListSemestersResult = {
  rows: Semester[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listSemesters(
  params: ListSemestersParams = {},
): Promise<ListSemestersResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.semNumberSearch) qs.set("semNumberSearch", params.semNumberSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListSemestersResult>(`/admin/semesters${suffix}`, { method: "GET" })
}

export async function createSemester(
  input: CreateSemesterInput,
): Promise<Semester> {
  return api<Semester>("/admin/semesters", { method: "POST", body: input })
}

export async function updateSemester(
  id: number,
  patch: UpdateSemesterInput,
): Promise<Semester> {
  return api<Semester>(`/admin/semesters/${id}`, { method: "PATCH", body: patch })
}

export async function activateSemester(id: number): Promise<Semester> {
  return api<Semester>(`/admin/semesters/${id}/activate`, { method: "POST" })
}

export async function deactivateSemester(id: number): Promise<Semester> {
  return api<Semester>(`/admin/semesters/${id}/deactivate`, { method: "POST" })
}
