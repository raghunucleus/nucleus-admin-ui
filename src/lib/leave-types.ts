import { api } from "@/lib/api"

export type LeaveType = {
  id: number
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateLeaveTypeInput = {
  name: string
  code: string
}

export type UpdateLeaveTypeInput = {
  name?: string
  code?: string
}

export type LeaveTypesSortField =
  | "name"
  | "code"
  | "status"
  | "created_at"
  | "updated_at"

export type LeaveTypesSortOrder = "asc" | "desc"

export type LeaveTypeStatusFilter = "active" | "inactive"

export type ListLeaveTypesParams = {
  page?: number
  pageSize?: number
  sortBy?: LeaveTypesSortField
  sortOrder?: LeaveTypesSortOrder
  nameSearch?: string
  codeSearch?: string
  status?: LeaveTypeStatusFilter
}

export type ListLeaveTypesResult = {
  rows: LeaveType[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listLeaveTypes(
  params: ListLeaveTypesParams = {},
): Promise<ListLeaveTypesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.codeSearch) qs.set("codeSearch", params.codeSearch)
  if (params.status) qs.set("status", params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListLeaveTypesResult>(`/admin/leave-types${suffix}`, {
    method: "GET",
  })
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
): Promise<LeaveType> {
  return api<LeaveType>("/admin/leave-types", {
    method: "POST",
    body: input,
  })
}

export async function updateLeaveType(
  id: number,
  patch: UpdateLeaveTypeInput,
): Promise<LeaveType> {
  return api<LeaveType>(`/admin/leave-types/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateLeaveType(id: number): Promise<LeaveType> {
  return api<LeaveType>(`/admin/leave-types/${id}/activate`, {
    method: "POST",
  })
}

export async function deactivateLeaveType(id: number): Promise<LeaveType> {
  return api<LeaveType>(`/admin/leave-types/${id}/deactivate`, {
    method: "POST",
  })
}
