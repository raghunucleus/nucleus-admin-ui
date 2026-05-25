import { api } from "@/lib/api"
import type { ProgrammeSemesterSubjectSlotType } from "@/lib/programme-semester-subjects"

export type SlotEnrollmentFacultyView = {
  employee_id: number
  emp_code: string
  emp_display_name: string
}

export type SlotEnrollmentOptionView = {
  option_id: number
  subject_id: number
  subject_code: string
  subject_name: string
  /** All faculty allocated to this candidate. Order is stable (by allocation id). */
  faculty: SlotEnrollmentFacultyView[]
  student_count: number
}

export type SlotEnrollmentStudentView = {
  student_id: number
  student_code: string
  display_name: string
  /** Student's current pick — both null when not assigned. */
  option_id: number | null
  employee_id: number | null
}

export type SlotEnrollmentView = {
  slot_id: number
  slot_name: string
  slot_type: ProgrammeSemesterSubjectSlotType | null
  programme_id: number
  admission_year_id: number
  options: SlotEnrollmentOptionView[]
  students: SlotEnrollmentStudentView[]
}

export type BulkSetSlotEnrollmentRow = {
  student_id: string
  /** Null clears this student's pick. Must be set together with faculty_emp_code. */
  option_subject_code: string | null
  /** Null clears this student's pick. Must be set together with option_subject_code. */
  faculty_emp_code: string | null
}

export type SlotEnrollmentRowError = {
  rowIndex: number
  field: "student_id" | "option_subject_code" | "faculty_emp_code"
  message: string
}

export async function getSlotEnrollments(
  slotId: number,
): Promise<SlotEnrollmentView> {
  return api<SlotEnrollmentView>(
    `/admin/programme-semester-subjects/${slotId}/enrollments`,
    { method: "GET" },
  )
}

export async function bulkSetSlotEnrollments(
  slotId: number,
  rows: BulkSetSlotEnrollmentRow[],
): Promise<{ applied: number; cleared: number }> {
  return api<{ applied: number; cleared: number }>(
    `/admin/programme-semester-subjects/${slotId}/enrollments/bulk`,
    { method: "POST", body: { rows } },
  )
}
