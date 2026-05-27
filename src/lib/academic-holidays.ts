import { api } from "@/lib/api"
import type { AttendanceGroup } from "@/lib/attendance-groups"
import type { Programme } from "@/lib/programmes"

export type AcademicHolidayScope = "institution" | "programme" | "group"
export type AcademicHolidayType =
  | "public"
  | "institutional"
  | "unplanned"
  | "half_day"

export type AcademicHoliday = {
  id: number
  date: string
  end_date: string | null
  name: string
  scope: AcademicHolidayScope
  programme_id: number | null
  programme: Programme | null
  attendance_group_id: number | null
  attendance_group: AttendanceGroup | null
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
  scope?: AcademicHolidayScope
  programme_id?: number
  attendance_group_id?: number
}

export type CreateHolidayInput = {
  date: string
  end_date?: string | null
  name: string
  scope: AcademicHolidayScope
  programme_id?: number | null
  attendance_group_id?: number | null
  type: AcademicHolidayType
  reason?: string | null
  cancel_existing_sessions?: boolean
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
  if (params.scope) qs.set("scope", params.scope)
  if (params.programme_id !== undefined)
    qs.set("programme_id", String(params.programme_id))
  if (params.attendance_group_id !== undefined)
    qs.set("attendance_group_id", String(params.attendance_group_id))
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

export async function removeAcademicHoliday(id: number): Promise<void> {
  return api<void>(`/admin/academic-holidays/${id}`, { method: "DELETE" })
}
