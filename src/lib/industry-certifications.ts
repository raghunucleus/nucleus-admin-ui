import { api } from "@/lib/api"

export type IndustryCertification = {
  id: number
  name: string
  code: string
  description: string | null
  issuing_body: string | null
  website: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateIndustryCertificationInput = {
  name: string
  code: string
  description?: string | null
  issuing_body?: string | null
  website?: string | null
}

export type UpdateIndustryCertificationInput = {
  name?: string
  code?: string
  description?: string | null
  issuing_body?: string | null
  website?: string | null
}

export type IndustryCertificationsSortField =
  | "name"
  | "code"
  | "issuing_body"
  | "status"
  | "created_at"
  | "updated_at"

export type IndustryCertificationsSortOrder = "asc" | "desc"

export type IndustryCertificationStatusFilter = "active" | "inactive"

export type ListIndustryCertificationsParams = {
  page?: number
  pageSize?: number
  sortBy?: IndustryCertificationsSortField
  sortOrder?: IndustryCertificationsSortOrder
  nameSearch?: string
  codeSearch?: string
  issuingBodySearch?: string
  status?: IndustryCertificationStatusFilter
}

export type ListIndustryCertificationsResult = {
  rows: IndustryCertification[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listIndustryCertifications(
  params: ListIndustryCertificationsParams = {},
): Promise<ListIndustryCertificationsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.issuingBodySearch)
    qs.set("issuingBodySearch", params.issuingBodySearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListIndustryCertificationsResult>(
    `/admin/industry-certifications${suffix}`,
    { method: "GET" },
  )
}

export async function getIndustryCertification(
  id: number,
): Promise<IndustryCertification> {
  return api<IndustryCertification>(`/admin/industry-certifications/${id}`, {
    method: "GET",
  })
}

export async function createIndustryCertification(
  input: CreateIndustryCertificationInput,
): Promise<IndustryCertification> {
  return api<IndustryCertification>("/admin/industry-certifications", {
    method: "POST",
    body: input,
  })
}

export async function updateIndustryCertification(
  id: number,
  patch: UpdateIndustryCertificationInput,
): Promise<IndustryCertification> {
  return api<IndustryCertification>(`/admin/industry-certifications/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateIndustryCertification(
  id: number,
): Promise<IndustryCertification> {
  return api<IndustryCertification>(
    `/admin/industry-certifications/${id}/activate`,
    { method: "POST" },
  )
}

export async function deactivateIndustryCertification(
  id: number,
): Promise<IndustryCertification> {
  return api<IndustryCertification>(
    `/admin/industry-certifications/${id}/deactivate`,
    { method: "POST" },
  )
}
