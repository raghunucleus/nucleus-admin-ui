import { api } from "@/lib/api"
import type { Department } from "@/lib/departments"
import type { Designation } from "@/lib/designations"

export const GENDERS = ["male", "female", "other"] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
}

export type Employee = {
  id: number
  emp_code: string
  emp_display_name: string
  gender: Gender
  dob: string | null
  department_id: number
  department?: Department
  designation_id: number
  designation?: Designation
  mobile_number: string
  country_code: string
  email: string
  rm_emp_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateEmployeeInput = {
  emp_code: string
  emp_display_name: string
  gender: Gender
  dob: string | null
  department_id: number
  designation_id: number
  mobile_number: string
  country_code: string
  email: string
  rm_emp_code: string | null
}

export type UpdateEmployeeInput = {
  emp_code?: string
  emp_display_name?: string
  gender?: Gender
  dob?: string | null
  department_id?: number
  designation_id?: number
  mobile_number?: string
  country_code?: string
  email?: string
  rm_emp_code?: string | null
}

export type EmployeesSortField =
  | "emp_code"
  | "emp_display_name"
  | "gender"
  | "mobile_number"
  | "email"
  | "rm_emp_code"
  | "status"
  | "created_at"
  | "updated_at"

export type EmployeesSortOrder = "asc" | "desc"

export type EmployeeStatusFilter = "active" | "inactive"

export type ListEmployeesParams = {
  page?: number
  pageSize?: number
  sortBy?: EmployeesSortField
  sortOrder?: EmployeesSortOrder
  /** Single-box typeahead — OR-matched on emp_code, display name, and email. */
  q?: string
  empCodeSearch?: string
  displayNameSearch?: string
  emailSearch?: string
  mobileSearch?: string
  rmEmpCodeSearch?: string
  status?: EmployeeStatusFilter
  gender?: Gender
  departmentId?: number
  designationId?: number
}

export type ListEmployeesResult = {
  rows: Employee[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listEmployees(
  params: ListEmployeesParams = {},
): Promise<ListEmployeesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.q) qs.set("q", params.q)
  if (params.empCodeSearch) qs.set("empCodeSearch", params.empCodeSearch)
  if (params.displayNameSearch)
    qs.set("displayNameSearch", params.displayNameSearch)
  if (params.emailSearch) qs.set("emailSearch", params.emailSearch)
  if (params.mobileSearch) qs.set("mobileSearch", params.mobileSearch)
  if (params.rmEmpCodeSearch) qs.set("rmEmpCodeSearch", params.rmEmpCodeSearch)
  if (params.status) qs.set("status", params.status)
  if (params.gender) qs.set("gender", params.gender)
  if (params.departmentId !== undefined)
    qs.set("departmentId", String(params.departmentId))
  if (params.designationId !== undefined)
    qs.set("designationId", String(params.designationId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListEmployeesResult>(`/admin/employees${suffix}`, { method: "GET" })
}

export async function getEmployee(id: number): Promise<Employee> {
  return api<Employee>(`/admin/employees/${id}`, { method: "GET" })
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<Employee> {
  return api<Employee>("/admin/employees", { method: "POST", body: input })
}

export async function updateEmployee(
  id: number,
  patch: UpdateEmployeeInput,
): Promise<Employee> {
  return api<Employee>(`/admin/employees/${id}`, { method: "PATCH", body: patch })
}

export async function activateEmployee(id: number): Promise<Employee> {
  return api<Employee>(`/admin/employees/${id}/activate`, { method: "POST" })
}

export async function deactivateEmployee(id: number): Promise<Employee> {
  return api<Employee>(`/admin/employees/${id}/deactivate`, { method: "POST" })
}

export type BulkCreateEmployeeRow = {
  emp_code: string
  emp_display_name: string
  gender: Gender
  dob: string | null
  department_code: string
  designation_code: string
  mobile_number: string
  country_code: string
  email: string
  rm_emp_code: string | null
}

export type BulkRowError = {
  rowIndex: number
  field?: string
  message: string
}

export async function bulkCreateEmployees(
  rows: BulkCreateEmployeeRow[],
): Promise<{ created: number }> {
  return api<{ created: number }>("/admin/employees/bulk", {
    method: "POST",
    body: { rows },
  })
}

export async function listEmployeeEmpCodes(): Promise<string[]> {
  const result = await api<{ codes: string[] }>("/admin/employees/emp-codes", {
    method: "GET",
  })
  return result.codes
}

