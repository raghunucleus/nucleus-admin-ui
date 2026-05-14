import { api } from "@/lib/api"

export type AdminUser = {
  id: string
  username: string
  email: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null
  mobile_number?: string | null
  display_name?: string | null
  is_master_admin: boolean
  is_active: boolean
  totp_enabled_at?: string | null
  google_id?: string | null
  created_at: string
  updated_at: string
}

// Note: is_master_admin is not part of the input contracts. The flag is
// managed directly in the database; admin screens cannot grant or revoke
// master privileges.
export type CreateAdminUserInput = {
  username: string
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null
  mobile_number?: string | null
}

export type UpdateAdminUserInput = {
  email?: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null
  mobile_number?: string | null
  password?: string
}

export type AdminUsersSortField =
  | "name"
  | "email"
  | "username"
  | "role"
  | "status"
  | "created_at"

export type AdminUsersSortOrder = "asc" | "desc"

export type AdminUserStatusFilter = "active" | "inactive"
export type AdminUserRoleFilter = "master" | "admin"

export type ListAdminUsersParams = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: AdminUsersSortField
  sortOrder?: AdminUsersSortOrder
  nameSearch?: string
  emailSearch?: string
  usernameSearch?: string
  mobileSearch?: string
  status?: AdminUserStatusFilter
  role?: AdminUserRoleFilter
}

export type ListAdminUsersResult = {
  rows: AdminUser[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listAdminUsers(
  params: ListAdminUsersParams = {},
): Promise<ListAdminUsersResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.search) qs.set("search", params.search)
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.emailSearch) qs.set("emailSearch", params.emailSearch)
  if (params.usernameSearch) qs.set("usernameSearch", params.usernameSearch)
  if (params.mobileSearch) qs.set("mobileSearch", params.mobileSearch)
  if (params.status) qs.set("status", params.status)
  if (params.role) qs.set("role", params.role)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListAdminUsersResult>(`/admin/users${suffix}`, { method: "GET" })
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUser> {
  return api<AdminUser>("/admin/users", { method: "POST", body: input })
}

export async function updateAdminUser(
  id: string,
  patch: UpdateAdminUserInput,
): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: patch })
}

export async function activateAdminUser(id: string): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}/activate`, { method: "POST" })
}

export async function deactivateAdminUser(id: string): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}/deactivate`, { method: "POST" })
}
