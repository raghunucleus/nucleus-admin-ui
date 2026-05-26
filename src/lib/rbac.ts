import { api } from "@/lib/api"

// --- Catalog -----------------------------------------------------------

export type Platform = "web" | "mobile" | "both"

/**
 * Concrete platform values that can be stored on a role's `allowed_platforms`.
 * The catalog `Platform` type includes the legacy `'both'` marker, but the
 * data layer only ever stores the discrete platforms.
 */
export type RolePlatform = "web" | "mobile"

export type ModuleDef = {
  key: string
  label: string
  icon: string
  order: number
}

export type RoleTypeDef = {
  key: string
  label: string
  description?: string
}

export type AttributeTypeDef = {
  key: string
  label: string
  /**
   * Informational tag — what backs this attribute (e.g. "departments",
   * "enum"). The picker doesn't use it; options come from the server's
   * fetcher registry via /admin/rbac/attribute-options.
   */
  source: string
}

/**
 * Canonical picker-option shape returned by /admin/rbac/attribute-options.
 * `id` is what gets stored on the assignment; `label` is the display text.
 */
export type PickerOption = { id: number | string; label: string }

export type AttributeSchemaItem = {
  key: string
  type: string
  label: string
  required: boolean
  multi: boolean
  /**
   * When true, this attribute can be set to the "all" wildcard on a role
   * assignment — meaning unrestricted scope (and auto-includes any future
   * entities). The assignment editor renders an "All" toggle for these.
   */
  allow_all?: boolean
}

/** Sentinel JSONB shape that means "wildcard / no scope filter". */
export type WildcardAllValue = { all: true }
export const WILDCARD_ALL: WildcardAllValue = { all: true }
export function isWildcardAll(value: unknown): value is WildcardAllValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { all?: unknown }).all === true
  )
}

export type ScreenDef = {
  key: string
  module_key: string
  role_type_keys: string[]
  platforms: Platform[]
  label: string
  description?: string
  web_route?: string
  mobile_route?: string
  actions: string[]
  attributes: AttributeSchemaItem[]
}

export type Catalog = {
  modules: ModuleDef[]
  role_types: RoleTypeDef[]
  attribute_types: AttributeTypeDef[]
  screens: ScreenDef[]
}

export async function getCatalog(): Promise<Catalog> {
  return api<Catalog>("/admin/rbac/catalog", { method: "GET" })
}

// --- Roles -------------------------------------------------------------

export type RoleDetail = {
  id: number
  code: string
  name: string
  description: string | null
  role_type_keys: string[]
  is_active: boolean
  /** Count of currently-active assignments. Server refuses deactivation while > 0. */
  active_assignment_count: number
  screens: {
    screen_key: string
    allowed_actions: string[]
    /** Subset of the catalog screen's platforms this role grants. */
    allowed_platforms: RolePlatform[]
  }[]
  created_at: string
  updated_at: string
}

export type RoleSortField =
  | "code"
  | "name"
  | "is_active"
  | "created_at"
  | "updated_at"

export type ListRolesParams = {
  page?: number
  pageSize?: number
  name?: string
  status?: "active" | "inactive"
  sortBy?: RoleSortField
  sortOrder?: "asc" | "desc"
}

export type ListRolesResult = {
  rows: RoleDetail[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type CreateRoleInput = {
  code: string
  name: string
  description?: string | null
  role_type_keys: string[]
  screens: {
    screen_key: string
    allowed_actions: string[]
    allowed_platforms: RolePlatform[]
  }[]
}

export type UpdateRoleInput = Partial<CreateRoleInput>

export async function listRoles(
  params: ListRolesParams = {},
): Promise<ListRolesResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.name) qs.set("name", params.name)
  if (params.status) qs.set("status", params.status)
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListRolesResult>(`/admin/rbac/roles${suffix}`, { method: "GET" })
}

export async function getRole(id: number): Promise<RoleDetail> {
  return api<RoleDetail>(`/admin/rbac/roles/${id}`, { method: "GET" })
}

export async function createRole(input: CreateRoleInput): Promise<RoleDetail> {
  return api<RoleDetail>("/admin/rbac/roles", { method: "POST", body: input })
}

export async function updateRole(
  id: number,
  patch: UpdateRoleInput,
): Promise<RoleDetail> {
  return api<RoleDetail>(`/admin/rbac/roles/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateRole(id: number): Promise<RoleDetail> {
  return api<RoleDetail>(`/admin/rbac/roles/${id}/activate`, { method: "POST" })
}

export async function deactivateRole(id: number): Promise<RoleDetail> {
  return api<RoleDetail>(`/admin/rbac/roles/${id}/deactivate`, {
    method: "POST",
  })
}

// --- Assignments -------------------------------------------------------

export type AssignmentAttribute = {
  screen_key: string
  attribute_key: string
  value: unknown
}

export type AssignmentDetail = {
  id: number
  role_id: number
  role_code: string
  role_name: string
  employee_id: number
  employee_emp_code: string
  employee_display_name: string
  attributes: AssignmentAttribute[]
  created_at: string
  updated_at: string
}

export type AssignmentSortField =
  | "employee"
  | "role"
  | "created_at"
  | "updated_at"

export type ListAssignmentsParams = {
  employee_id?: number
  role_id?: number
  /** Free-text search over employee + role name/code. */
  q?: string
  page?: number
  pageSize?: number
  sortBy?: AssignmentSortField
  sortOrder?: "asc" | "desc"
}

export type ListAssignmentsResult = {
  rows: AssignmentDetail[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type CreateAssignmentInput = {
  role_id: number
  employee_id: number
  attributes: AssignmentAttribute[]
}

export type UpdateAssignmentInput = {
  attributes?: AssignmentAttribute[]
}

export async function listAssignments(
  params: ListAssignmentsParams = {},
): Promise<ListAssignmentsResult> {
  const qs = new URLSearchParams()
  if (params.employee_id !== undefined)
    qs.set("employee_id", String(params.employee_id))
  if (params.role_id !== undefined) qs.set("role_id", String(params.role_id))
  if (params.q) qs.set("q", params.q)
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined)
    qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListAssignmentsResult>(`/admin/rbac/assignments${suffix}`, {
    method: "GET",
  })
}

export async function getAssignment(id: number): Promise<AssignmentDetail> {
  return api<AssignmentDetail>(`/admin/rbac/assignments/${id}`, {
    method: "GET",
  })
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentDetail> {
  return api<AssignmentDetail>("/admin/rbac/assignments", {
    method: "POST",
    body: input,
  })
}

export async function updateAssignment(
  id: number,
  patch: UpdateAssignmentInput,
): Promise<AssignmentDetail> {
  return api<AssignmentDetail>(`/admin/rbac/assignments/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function revokeAssignment(id: number): Promise<void> {
  return api<void>(`/admin/rbac/assignments/${id}`, { method: "DELETE" })
}

// --- Attribute picker options -----------------------------------------

/**
 * Fetch the picker options for a catalog attribute type. The server runs a
 * registered fetcher (src/rbac/catalog/attribute-fetchers.ts) and returns
 * the canonical `{ id, label }[]` shape — no per-attribute URL or field
 * mapping in the client.
 */
export async function fetchAttributeOptions(
  attrType: AttributeTypeDef,
): Promise<PickerOption[]> {
  return api<PickerOption[]>(
    `/admin/rbac/attribute-options?type=${encodeURIComponent(attrType.key)}`,
    { method: "GET" },
  )
}
