import { api } from "@/lib/api"
import type { AttendanceGroup } from "@/lib/attendance-groups"
import type { Employee } from "@/lib/employees"
import type { ProgrammeSemester } from "@/lib/programme-semesters"
import type { Subject } from "@/lib/subjects"

// ISO weekday numbers (1 = Mon … 7 = Sun) with display labels.
export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
] as const

// --- entity shapes ----------------------------------------------------------

// One period row of a timetable's grid. Times come back as "HH:MM:SS".
export type TimetablePeriod = {
  id: number
  timetable_id: number
  position: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
  created_at: string
}

export type TimetableCourseFaculty = {
  id: number
  timetable_course_id: number
  employee_id: number
  employee: Employee
  created_at: string
}

// A subject added exclusively to one timetable — either a master subject
// (subject set) or a free-text activity (custom_label set).
export type TimetableCourse = {
  id: number
  timetable_id: number
  subject_id: number | null
  subject: Subject | null
  custom_label: string | null
  faculty: TimetableCourseFaculty[]
  created_at: string
  updated_at: string
}

// Trimmed programme-semester-subject as nested on a grid cell — enough to
// label the cell; the full subject graph is fetched separately for the
// palette.
export type TimetableEntrySubject = {
  id: number
  subject_id: number | null
  subject: Subject | null
  placeholder_name: string | null
}

// One filled grid cell.
export type TimetableEntry = {
  id: number
  timetable_id: number
  day_of_week: number
  timetable_period_id: number
  /** Consecutive periods this class occupies on its day (1 = single). */
  span: number
  programme_semester_subject_id: number | null
  programme_semester_subject: TimetableEntrySubject | null
  timetable_course_id: number | null
  timetable_course: TimetableCourse | null
  employee_id: number | null
  employee: Employee | null
  room: string | null
  note: string | null
  created_at: string
  updated_at: string
}

// A timetable with its full graph — returned by getTimetable and every
// mutation that returns the whole timetable.
export type Timetable = {
  id: number
  programme_semester_id: number
  programme_semester?: ProgrammeSemester
  attendance_group_id: number
  attendance_group?: AttendanceGroup
  name: string
  /**
   * One template per (programme_semester, attendance_group) carries this
   * flag. The Schedule preview modal auto-picks it.
   */
  is_default: boolean
  working_days: number[]
  periods: TimetablePeriod[]
  courses: TimetableCourse[]
  entries: TimetableEntry[]
  created_at: string
  updated_at: string
}

// Lightweight row for the list screen — counts instead of the full graph.
export type TimetableListItem = {
  id: number
  programme_semester_id: number
  attendance_group_id: number
  attendance_group?: AttendanceGroup
  name: string
  is_default: boolean
  working_days: number[]
  period_count: number
  teaching_period_count: number
  entry_count: number
  created_at: string
  updated_at: string
}

// --- input shapes -----------------------------------------------------------

export type TimetablePeriodInput = {
  /** Present for an existing row (kept in place); absent for a new row. */
  id?: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
}

export type CreateTimetableInput = {
  programme_semester_id: number
  attendance_group_id: number
  name: string
  working_days: number[]
  periods: Omit<TimetablePeriodInput, "id">[]
}

export type UpdateTimetableInput = {
  name?: string
  working_days?: number[]
}

export type CreateTimetableCourseInput = {
  subject_id?: number
  custom_label?: string
  employee_ids?: number[]
}

export type UpdateTimetableCourseInput = {
  subject_id?: number | null
  custom_label?: string | null
}

export type UpsertTimetableEntryInput = {
  day_of_week: number
  timetable_period_id: number
  /** Consecutive periods to occupy (merged-period labs). Defaults to 1. */
  span?: number
  programme_semester_subject_id?: number
  timetable_course_id?: number
  employee_id?: number | null
  room?: string | null
  note?: string | null
}

// Per-week preview / publish shapes —————————————————————————————————

export type PreviewSession = {
  session_date: string
  day_of_week: number
  timetable_period_id: number
  period_label: string | null
  period_start_time: string | null
  period_end_time: string | null
  span: number
  timetable_entry_id: number
  programme_semester_subject_id: number
  programme_semester_subject_option_id: number | null
  /** Set when this row is an elective cohort — the slot's placeholder name. */
  slot_placeholder_name: string | null
  subject_id: number
  subject_code: string | null
  subject_name: string | null
  scheduled_employee_id: number
  teacher_name: string | null
  teacher_emp_code: string | null
  room: string | null
  already_exists: boolean
}

export type PreviewResult = {
  sessions: PreviewSession[]
  holidays: { date: string; name: string; end_date: string | null }[]
  blocked_dates: string[]
}

export type PublishResult = {
  inserted: number
  skipped_holidays: number
  replaced: number
}

export type WeekSummary = {
  week_start: string
  week_end: string
  scheduled: number
  completed: number
  cancelled: number
  rescheduled: number
  has_any: boolean
  /**
   * Templates that produced sessions in this week. Usually one entry; rare
   * multi-template weeks (mid-week template switch) list both.
   */
  templates: { id: number; name: string; session_count: number }[]
}

// --- API client -------------------------------------------------------------

export async function listTimetables(
  programmeSemesterId?: number,
  attendanceGroupId?: number,
): Promise<TimetableListItem[]> {
  const qs = new URLSearchParams()
  if (programmeSemesterId !== undefined)
    qs.set("programmeSemesterId", String(programmeSemesterId))
  if (attendanceGroupId !== undefined)
    qs.set("attendanceGroupId", String(attendanceGroupId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<TimetableListItem[]>(`/admin/timetables${suffix}`, {
    method: "GET",
  })
}

export async function getTimetable(id: number): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}`, { method: "GET" })
}

export async function createTimetable(
  input: CreateTimetableInput,
): Promise<Timetable> {
  return api<Timetable>("/admin/timetables", { method: "POST", body: input })
}

export async function updateTimetable(
  id: number,
  patch: UpdateTimetableInput,
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function previewTimetableWeek(
  id: number,
  window: { from: string; to: string },
): Promise<PreviewResult> {
  return api<PreviewResult>(`/admin/timetables/${id}/preview-week`, {
    method: "POST",
    body: window,
  })
}

export async function publishTimetableWeek(
  id: number,
  window: { from: string; to: string },
): Promise<PublishResult> {
  return api<PublishResult>(`/admin/timetables/${id}/publish-week`, {
    method: "POST",
    body: window,
  })
}

export async function getTimetableWeekSummaries(
  id: number,
  week_starts: string[],
): Promise<WeekSummary[]> {
  return api<WeekSummary[]>(`/admin/timetables/${id}/week-summaries`, {
    method: "POST",
    body: { week_starts },
  })
}

export async function cloneTimetable(
  id: number,
  input: { name: string },
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}/clone`, {
    method: "POST",
    body: input,
  })
}

export async function setDefaultTimetable(id: number): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}/set-default`, {
    method: "POST",
  })
}

export async function deleteTimetable(id: number): Promise<void> {
  return api<void>(`/admin/timetables/${id}`, { method: "DELETE" })
}

export async function saveTimetablePeriods(
  id: number,
  periods: TimetablePeriodInput[],
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}/periods`, {
    method: "PUT",
    body: { periods },
  })
}

export async function createTimetableCourse(
  id: number,
  input: CreateTimetableCourseInput,
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/${id}/courses`, {
    method: "POST",
    body: input,
  })
}

export async function updateTimetableCourse(
  courseId: number,
  patch: UpdateTimetableCourseInput,
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/courses/${courseId}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function deleteTimetableCourse(
  courseId: number,
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/courses/${courseId}`, {
    method: "DELETE",
  })
}

export async function setTimetableCourseFaculty(
  courseId: number,
  employeeIds: number[],
): Promise<Timetable> {
  return api<Timetable>(`/admin/timetables/courses/${courseId}/faculty`, {
    method: "PUT",
    body: { employee_ids: employeeIds },
  })
}

export async function upsertTimetableEntry(
  id: number,
  input: UpsertTimetableEntryInput,
): Promise<TimetableEntry> {
  return api<TimetableEntry>(`/admin/timetables/${id}/entries/cell`, {
    method: "PUT",
    body: input,
  })
}

export async function clearTimetableEntry(
  id: number,
  dayOfWeek: number,
  periodId: number,
): Promise<void> {
  return api<void>(
    `/admin/timetables/${id}/entries/cell?dayOfWeek=${dayOfWeek}&periodId=${periodId}`,
    { method: "DELETE" },
  )
}
