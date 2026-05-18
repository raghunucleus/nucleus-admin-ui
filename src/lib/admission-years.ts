import { api } from "@/lib/api"

export type AdmissionYear = {
  id: number
  year: number
  display_year: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateAdmissionYearInput = {
  year: number
  display_year: string
}

export type UpdateAdmissionYearInput = {
  year?: number
  display_year?: string
}

export type AdmissionYearsSortField =
  | "year"
  | "display_year"
  | "status"
  | "created_at"
  | "updated_at"

export type AdmissionYearsSortOrder = "asc" | "desc"

export type AdmissionYearStatusFilter = "active" | "inactive"

export type ListAdmissionYearsParams = {
  page?: number
  pageSize?: number
  sortBy?: AdmissionYearsSortField
  sortOrder?: AdmissionYearsSortOrder
  yearSearch?: string
  displayYearSearch?: string
  status?: AdmissionYearStatusFilter
}

export type ListAdmissionYearsResult = {
  rows: AdmissionYear[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listAdmissionYears(
  params: ListAdmissionYearsParams = {},
): Promise<ListAdmissionYearsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.yearSearch) qs.set("yearSearch", params.yearSearch)
  if (params.displayYearSearch)
    qs.set("displayYearSearch", params.displayYearSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListAdmissionYearsResult>(`/admin/admission-years${suffix}`, {
    method: "GET",
  })
}

export async function createAdmissionYear(
  input: CreateAdmissionYearInput,
): Promise<AdmissionYear> {
  return api<AdmissionYear>("/admin/admission-years", {
    method: "POST",
    body: input,
  })
}

export async function updateAdmissionYear(
  id: number,
  patch: UpdateAdmissionYearInput,
): Promise<AdmissionYear> {
  return api<AdmissionYear>(`/admin/admission-years/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateAdmissionYear(id: number): Promise<AdmissionYear> {
  return api<AdmissionYear>(`/admin/admission-years/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateAdmissionYear(id: number): Promise<AdmissionYear> {
  return api<AdmissionYear>(`/admin/admission-years/${id}/deactivate`, {
    method: "POST",
  })
}
