import { api } from "@/lib/api"

export const ACADEMIC_LEVELS = ["UG", "PG"] as const
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number]

export const ACADEMIC_LEVEL_LABELS: Record<AcademicLevel, string> = {
  UG: "Undergraduate (UG)",
  PG: "Postgraduate (PG)",
}

export const DURATION_YEARS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export type DurationYears = (typeof DURATION_YEARS)[number]

export type Degree = {
  id: number
  name: string
  code: string
  short_name: string
  academic_level: AcademicLevel
  duration_years: DurationYears
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateDegreeInput = {
  name: string
  code: string
  short_name: string
  academic_level: AcademicLevel
  duration_years: DurationYears
}

export type UpdateDegreeInput = {
  name?: string
  code?: string
  short_name?: string
  academic_level?: AcademicLevel
  duration_years?: DurationYears
}

export type DegreesSortField =
  | "name"
  | "code"
  | "short_name"
  | "academic_level"
  | "duration_years"
  | "status"
  | "created_at"
  | "updated_at"

export type DegreesSortOrder = "asc" | "desc"

export type DegreeStatusFilter = "active" | "inactive"

export type ListDegreesParams = {
  page?: number
  pageSize?: number
  sortBy?: DegreesSortField
  sortOrder?: DegreesSortOrder
  nameSearch?: string
  codeSearch?: string
  shortNameSearch?: string
  status?: DegreeStatusFilter
  academicLevel?: AcademicLevel
}

export type ListDegreesResult = {
  rows: Degree[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listDegrees(
  params: ListDegreesParams = {},
): Promise<ListDegreesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.shortNameSearch) qs.set("shortNameSearch", params.shortNameSearch)
  if (params.status) qs.set("status", params.status)
  if (params.academicLevel) qs.set("academicLevel", params.academicLevel)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListDegreesResult>(`/admin/degrees${suffix}`, { method: "GET" })
}

export async function createDegree(input: CreateDegreeInput): Promise<Degree> {
  return api<Degree>("/admin/degrees", { method: "POST", body: input })
}

export async function updateDegree(
  id: number,
  patch: UpdateDegreeInput,
): Promise<Degree> {
  return api<Degree>(`/admin/degrees/${id}`, { method: "PATCH", body: patch })
}

export async function activateDegree(id: number): Promise<Degree> {
  return api<Degree>(`/admin/degrees/${id}/activate`, { method: "POST" })
}

export async function deactivateDegree(id: number): Promise<Degree> {
  return api<Degree>(`/admin/degrees/${id}/deactivate`, { method: "POST" })
}
