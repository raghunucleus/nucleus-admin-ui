import { api } from "@/lib/api"

export type DepartmentHod = {
  id: number
  emp_code: string
  emp_display_name: string
}

export type Department = {
  id: number
  name: string
  code: string
  short_name: string
  hod_employee_id: number | null
  hod?: DepartmentHod | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateDepartmentInput = {
  name: string
  code: string
  short_name: string
  hod_employee_id?: number | null
}

export type UpdateDepartmentInput = {
  name?: string
  code?: string
  short_name?: string
  hod_employee_id?: number | null
}

export type DepartmentsSortField =
  | "name"
  | "code"
  | "short_name"
  | "status"
  | "created_at"
  | "updated_at"

export type DepartmentsSortOrder = "asc" | "desc"

export type DepartmentStatusFilter = "active" | "inactive"

export type ListDepartmentsParams = {
  page?: number
  pageSize?: number
  sortBy?: DepartmentsSortField
  sortOrder?: DepartmentsSortOrder
  nameSearch?: string
  codeSearch?: string
  shortNameSearch?: string
  status?: DepartmentStatusFilter
}

export type ListDepartmentsResult = {
  rows: Department[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listDepartments(
  params: ListDepartmentsParams = {},
): Promise<ListDepartmentsResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.shortNameSearch) qs.set("shortNameSearch", params.shortNameSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListDepartmentsResult>(`/admin/departments${suffix}`, { method: "GET" })
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  return api<Department>("/admin/departments", { method: "POST", body: input })
}

export async function updateDepartment(
  id: number,
  patch: UpdateDepartmentInput,
): Promise<Department> {
  return api<Department>(`/admin/departments/${id}`, { method: "PATCH", body: patch })
}

export async function activateDepartment(id: number): Promise<Department> {
  return api<Department>(`/admin/departments/${id}/activate`, { method: "POST" })
}

export async function deactivateDepartment(id: number): Promise<Department> {
  return api<Department>(`/admin/departments/${id}/deactivate`, { method: "POST" })
}
