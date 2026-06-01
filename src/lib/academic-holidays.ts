import { api } from "@/lib/api"

export type AcademicHolidayType = "public" | "institutional" | "unplanned"

// Holidays are always institution-wide.
export type AcademicHoliday = {
  id: number
  date: string
  end_date: string | null
  name: string
  type: AcademicHolidayType
  reason: string | null
  declared_by_employee_id: number | null
  declared_by_admin_id: number | null
  created_at: string
  updated_at: string
}

export type ListHolidaysParams = {
  from?: string
  to?: string
}

export type CreateHolidayInput = {
  date: string
  end_date?: string | null
  name: string
  type: AcademicHolidayType
  reason?: string | null
}

export type DeclareHolidayResult = {
  holiday: AcademicHoliday
  sessions_cancelled: number
}

export async function listAcademicHolidays(
  params: ListHolidaysParams = {},
): Promise<AcademicHoliday[]> {
  const qs = new URLSearchParams()
  if (params.from) qs.set("from", params.from)
  if (params.to) qs.set("to", params.to)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<AcademicHoliday[]>(`/admin/academic-holidays${suffix}`, {
    method: "GET",
  })
}

export async function declareAcademicHoliday(
  input: CreateHolidayInput,
): Promise<DeclareHolidayResult> {
  return api<DeclareHolidayResult>("/admin/academic-holidays", {
    method: "POST",
    body: input,
  })
}

// Editing reuses the create shape. Scheduled sessions newly caught by the
// edited range are cancelled server-side; previously-cancelled ones are never
// restored.
export type UpdateHolidayInput = CreateHolidayInput

export async function updateAcademicHoliday(
  id: number,
  input: UpdateHolidayInput,
): Promise<DeclareHolidayResult> {
  return api<DeclareHolidayResult>(`/admin/academic-holidays/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export async function removeAcademicHoliday(id: number): Promise<void> {
  return api<void>(`/admin/academic-holidays/${id}`, { method: "DELETE" })
}
