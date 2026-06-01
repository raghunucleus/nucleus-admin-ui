import { api } from "@/lib/api"

export const GUARDIAN_RELATIONSHIPS = [
  "father",
  "mother",
  "guardian",
  "other",
] as const
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number]

export const RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
  other: "Other",
}

// A guardian/parent contact, stored per-student. There is no global guardian
// account — login is keyed by the mobile number.
export type GuardianContact = {
  id: number
  student_id: number
  student_roll: string
  student_name: string
  relationship: GuardianRelationship
  name: string
  mobile_number: string
  email: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export type CreateGuardianInput = {
  student_id: number
  relationship: GuardianRelationship
  name: string
  mobile_number: string
  email?: string | null
  is_primary?: boolean
}

export type UpdateGuardianInput = {
  relationship?: GuardianRelationship
  name?: string
  mobile_number?: string
  email?: string | null
  is_primary?: boolean
}

export type GuardiansSortField =
  | "name"
  | "mobile_number"
  | "relationship"
  | "created_at"
  | "updated_at"

export type GuardiansSortOrder = "asc" | "desc"

export type ListGuardiansParams = {
  page?: number
  pageSize?: number
  sortBy?: GuardiansSortField
  sortOrder?: GuardiansSortOrder
  nameSearch?: string
  mobileSearch?: string
  studentSearch?: string
}

export type ListGuardiansResult = {
  rows: GuardianContact[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function listGuardians(
  params: ListGuardiansParams = {},
): Promise<ListGuardiansResult> {
  const qs = new URLSearchParams()
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize))
  if (params.sortBy) qs.set("sortBy", params.sortBy)
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder)
  if (params.nameSearch) qs.set("nameSearch", params.nameSearch)
  if (params.mobileSearch) qs.set("mobileSearch", params.mobileSearch)
  if (params.studentSearch) qs.set("studentSearch", params.studentSearch)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<ListGuardiansResult>(`/admin/guardians${suffix}`, { method: "GET" })
}

export async function createGuardian(
  input: CreateGuardianInput,
): Promise<GuardianContact> {
  return api<GuardianContact>("/admin/guardians", {
    method: "POST",
    body: input,
  })
}

export async function updateGuardian(
  id: number,
  patch: UpdateGuardianInput,
): Promise<GuardianContact> {
  return api<GuardianContact>(`/admin/guardians/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function removeGuardian(id: number): Promise<void> {
  return api<void>(`/admin/guardians/${id}`, { method: "DELETE" })
}

/** Directly set a login password for a mobile number (out-of-band fallback). */
export async function setGuardianLoginPassword(
  mobile_number: string,
  password: string,
): Promise<void> {
  return api<void>(`/admin/guardians/set-password`, {
    method: "POST",
    body: { mobile_number, password },
  })
}

/** Trigger a password OTP to a mobile number (email channel for now). */
export async function sendGuardianOtp(
  mobile_number: string,
): Promise<{ message: string }> {
  return api<{ message: string }>(`/admin/guardians/send-otp`, {
    method: "POST",
    body: { mobile_number },
  })
}

export type BulkUploadGuardianRow = {
  student_id: string
  father_name?: string
  father_mobile?: string
  father_email?: string
  mother_name?: string
  mother_mobile?: string
  mother_email?: string
  guardian_name?: string
  guardian_mobile?: string
  guardian_email?: string
}

export type GuardianRowError = {
  rowIndex: number
  field?: string
  message: string
}

export type BulkUploadResult = {
  contacts_upserted: number
  students_affected: number
  warnings: GuardianRowError[]
}

export async function bulkUploadGuardians(
  rows: BulkUploadGuardianRow[],
): Promise<BulkUploadResult> {
  return api<BulkUploadResult>("/admin/guardians/bulk-upload", {
    method: "POST",
    body: { rows },
  })
}
