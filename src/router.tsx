import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { AcademicHolidaysPage } from "@/pages/academic-holidays"
import { AdminUsersPage } from "@/pages/admin-users"
import { ApprovalApproversPage } from "@/pages/approval-approvers"
import { AppLayout } from "@/layouts/app-layout"
import { AuthLayout } from "@/layouts/auth-layout"
import { LoginPage } from "@/pages/login"
import { AdmissionYearsPage } from "@/pages/admission-years"
import { DegreesPage } from "@/pages/degrees"
import { DepartmentsPage } from "@/pages/departments"
import { DesignationsPage } from "@/pages/designations"
import { EmployeesPage } from "@/pages/employees"
import { EmployeesBulkUploadPage } from "@/pages/employees-bulk-upload"
import { ProgrammeConfigurationPage } from "@/pages/programme-configuration"
import { ProgrammeAdmissionYearsPage } from "@/pages/programme-admission-years"
import { ProgrammeSemestersPage } from "@/pages/programme-semesters"
import { ProgrammesPage } from "@/pages/programmes"
import { RegulationsPage } from "@/pages/regulations"
import { RegulationMarkStructuresPage } from "@/pages/regulation-mark-structures"
import { MarkStructureEditorPage } from "@/pages/mark-structure-editor"
import { ProgrammeAttendanceGroupsPage } from "@/pages/programme-attendance-groups"
import { SemesterFacultyPage } from "@/pages/semester-faculty"
import { SemesterSettingsPage } from "@/pages/semester-settings"
import { SemesterStudentAllocationPage } from "@/pages/semester-student-allocation"
import { SemesterSubjectsPage } from "@/pages/semester-subjects"
import { SlotEnrollmentsPage } from "@/pages/slot-enrollments"
import { SemesterTimetablesPage } from "@/pages/semester-timetables"
import { SemestersPage } from "@/pages/semesters"
import { StudentsPage } from "@/pages/students"
import { StudentsBulkUploadPage } from "@/pages/students-bulk-upload"
import { GuardiansPage } from "@/pages/guardians"
import { GuardiansBulkUploadPage } from "@/pages/guardians-bulk-upload"
import { StudentDetailsPage } from "@/pages/student-details"
import { AddressAttributesPage } from "@/pages/address-attributes/address-attributes"
import { StudentAttributesPage } from "@/pages/student-attributes/student-attributes"
import { SubjectsPage } from "@/pages/subjects"
import { SubjectTypesPage } from "@/pages/subject-types"
import { TimetableEditorPage } from "@/pages/timetable-editor"
import { TimetableSchedulePage } from "@/pages/timetable-schedule"
import { MigrationsPage } from "@/pages/migrations"
import { NotFoundPage } from "@/pages/not-found"
import { ProfilePage } from "@/pages/profile"
import { AssignmentEditorPage } from "@/pages/role-management/assignment-editor"
import { AssignmentsListPage } from "@/pages/role-management/assignments-list"
import { RoleBuilderPage } from "@/pages/role-management/role-builder"
import { RolesListPage } from "@/pages/role-management/roles-list"
import { SetupTwoFactorPage } from "@/pages/setup-2fa"
import { WelcomePage } from "@/pages/welcome"
import { useAuthStore } from "@/store/auth-store"

const rootRoute = createRootRoute({
  notFoundComponent: NotFoundPage,
})

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_auth",
  beforeLoad: () => {
    if (useAuthStore.getState().user) {
      throw redirect({ to: "/" })
    }
  },
  component: AuthLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  component: LoginPage,
})

// Logged-in but not yet enrolled in 2FA. Lives outside the protected layout
// so its beforeLoad doesn't bounce the admin away from the only page they
// are allowed to use.
const setup2faRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup-2fa",
  beforeLoad: () => {
    const user = useAuthStore.getState().user
    if (!user) throw redirect({ to: "/login" })
    if (user.totp_enabled_at) throw redirect({ to: "/" })
  },
  component: SetupTwoFactorPage,
})

const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: () => {
    const user = useAuthStore.getState().user
    if (!user) throw redirect({ to: "/login" })
    if (!user.totp_enabled_at) throw redirect({ to: "/setup-2fa" })
  },
  component: AppLayout,
})

const welcomeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/",
  component: WelcomePage,
})

const migrationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/migrations",
  component: MigrationsPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/admin-users",
  component: AdminUsersPage,
})

const approvalApproversRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/approval-approvers",
  component: ApprovalApproversPage,
})

const academicHolidaysRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/academic-holidays",
  component: AcademicHolidaysPage,
})

const mastersDegreesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/degrees",
  component: DegreesPage,
})

const mastersDepartmentsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/departments",
  component: DepartmentsPage,
})

const mastersProgrammesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programmes",
  component: ProgrammesPage,
})

const mastersProgrammeSemestersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-semesters",
  component: ProgrammeSemestersPage,
  validateSearch: (search: Record<string, unknown>): { programmeId?: number } => {
    const raw = search.programmeId
    const coerced =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN
    return Number.isInteger(coerced) && coerced > 0
      ? { programmeId: coerced }
      : {}
  },
})

const mastersSemestersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/semesters",
  component: SemestersPage,
})

const mastersAdmissionYearsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/admission-years",
  component: AdmissionYearsPage,
})

const mastersRegulationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/regulations",
  component: RegulationsPage,
})

const mastersRegulationMarkStructuresRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/regulations/$regulationId/mark-structures",
  component: RegulationMarkStructuresPage,
})

const mastersMarkStructureEditorRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/regulations/$regulationId/mark-structures/$subjectTypeId",
  component: MarkStructureEditorPage,
})

const mastersSubjectsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/subjects",
  component: SubjectsPage,
})

const mastersSubjectTypesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/subject-types",
  component: SubjectTypesPage,
})

const mastersProgrammeAdmissionYearsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-admission-years",
  component: ProgrammeAdmissionYearsPage,
})

// Shared by the programme-configuration screen and its per-semester settings
// sub-screens — coerces ?programmeId / ?admissionYearId from the URL.
function validateProgrammeBatchSearch(
  search: Record<string, unknown>,
): { programmeId?: number; admissionYearId?: number } {
  const out: { programmeId?: number; admissionYearId?: number } = {}
  for (const key of ["programmeId", "admissionYearId"] as const) {
    const raw = search[key]
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN
    if (Number.isInteger(n) && n > 0) out[key] = n
  }
  return out
}

const mastersProgrammeConfigurationRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration",
  component: ProgrammeConfigurationPage,
  validateSearch: validateProgrammeBatchSearch,
})

// Per-semester settings hub (bento) reached from a semester card.
const mastersSemesterSettingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId",
  component: SemesterSettingsPage,
  validateSearch: validateProgrammeBatchSearch,
})

// Configuration sections opened from the semester settings bento.
const mastersSemesterSubjectsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/subjects",
  component: SemesterSubjectsPage,
  validateSearch: validateProgrammeBatchSearch,
})

const mastersSemesterFacultyRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/faculty",
  component: SemesterFacultyPage,
  validateSearch: validateProgrammeBatchSearch,
})

// Student allocation hub — lists every slot in the semester and links into
// the per-slot enrollment matrix. Sibling of Faculty allocation.
const mastersSemesterStudentAllocationRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/student-allocation",
  component: SemesterStudentAllocationPage,
  validateSearch: validateProgrammeBatchSearch,
})

// Per-slot enrollment matrix — students of the batch × candidate subjects.
const mastersSlotEnrollmentsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/subjects/$slotId/enrollments",
  component: SlotEnrollmentsPage,
  validateSearch: validateProgrammeBatchSearch,
})

// Timetables for a semester — the list screen, and the per-timetable editor.
const mastersSemesterTimetablesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/timetables",
  component: SemesterTimetablesPage,
  validateSearch: validateProgrammeBatchSearch,
})

const mastersTimetableEditorRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/timetables/$timetableId",
  component: TimetableEditorPage,
  validateSearch: validateProgrammeBatchSearch,
})

const mastersTimetableScheduleRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/semester/$programmeSemesterId/timetables/$timetableId/schedule",
  component: TimetableSchedulePage,
  validateSearch: validateProgrammeBatchSearch,
})

// Attendance groups are configured once per programme × admission-year batch
// (shared across every semester), so this screen is scoped to the batch — not
// nested under a semester.
const mastersProgrammeAttendanceGroupsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/programme-configuration/attendance-groups",
  component: ProgrammeAttendanceGroupsPage,
  validateSearch: validateProgrammeBatchSearch,
})

const employeesDesignationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/employees/designations",
  component: DesignationsPage,
})

const employeesAllRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/employees/all",
  component: EmployeesPage,
})

const employeesBulkUploadRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/employees/bulk-upload",
  component: EmployeesBulkUploadPage,
})

const studentsAllRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/students/all",
  component: StudentsPage,
})

const studentsBulkUploadRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/students/bulk-upload",
  component: StudentsBulkUploadPage,
})

const guardiansAllRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/guardians/all",
  component: GuardiansPage,
})

const guardiansBulkUploadRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/guardians/bulk-upload",
  component: GuardiansBulkUploadPage,
})

// Dynamic detail route. Static siblings (/students/all, /students/bulk-upload)
// always win over this param route, so there's no collision.
const studentDetailsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/students/$studentId",
  component: StudentDetailsPage,
})

// --- Role management ----------------------------------------------------
const roleManagementRolesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/role-management/roles",
  component: RolesListPage,
})

const roleManagementRoleEditorRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/role-management/roles/$roleId",
  component: RoleBuilderPage,
})

function validateAssignmentsListSearch(
  search: Record<string, unknown>,
): { employee_id?: number; role_id?: number } {
  const out: { employee_id?: number; role_id?: number } = {}
  for (const key of ["employee_id", "role_id"] as const) {
    const raw = search[key]
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN
    if (Number.isInteger(n) && n > 0) out[key] = n
  }
  return out
}

const roleManagementAssignmentsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/role-management/assignments",
  component: AssignmentsListPage,
  validateSearch: validateAssignmentsListSearch,
})

const roleManagementAssignmentEditorRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/role-management/assignments/$assignmentId",
  component: AssignmentEditorPage,
  validateSearch: validateAssignmentsListSearch,
})

const studentAttributeTabs = [
  "industry-certification",
  "entrance-exam",
  "xth-board",
  "xiith-board",
  "diploma-board",
] as const
export type StudentAttributeTab = (typeof studentAttributeTabs)[number]

const additionalAttributesStudentRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/additional-attributes/student",
  component: StudentAttributesPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: StudentAttributeTab } => {
    const t = search.tab
    return {
      tab:
        typeof t === "string" &&
        (studentAttributeTabs as readonly string[]).includes(t)
          ? (t as StudentAttributeTab)
          : "industry-certification",
    }
  },
})

const addressAttributeTabs = ["countries", "states", "districts"] as const
export type AddressAttributeTab = (typeof addressAttributeTabs)[number]

const additionalAttributesAddressRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/additional-attributes/address",
  component: AddressAttributesPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab: AddressAttributeTab } => {
    const t = search.tab
    return {
      tab:
        typeof t === "string" &&
        (addressAttributeTabs as readonly string[]).includes(t)
          ? (t as AddressAttributeTab)
          : "countries",
    }
  },
})

const profileSections = ["profile", "password", "security"] as const
export type ProfileSection = (typeof profileSections)[number]

const profileRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/profile",
  component: ProfilePage,
  validateSearch: (search: Record<string, unknown>): { section: ProfileSection } => {
    const s = search.section
    return {
      section:
        typeof s === "string" &&
        (profileSections as readonly string[]).includes(s)
          ? (s as ProfileSection)
          : "profile",
    }
  },
})

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute]),
  setup2faRoute,
  protectedLayoutRoute.addChildren([
    welcomeRoute,
    migrationsRoute,
    adminUsersRoute,
    approvalApproversRoute,
    academicHolidaysRoute,
    mastersDegreesRoute,
    mastersDepartmentsRoute,
    mastersProgrammesRoute,
    mastersProgrammeSemestersRoute,
    mastersSemestersRoute,
    mastersAdmissionYearsRoute,
    mastersRegulationsRoute,
    mastersRegulationMarkStructuresRoute,
    mastersMarkStructureEditorRoute,
    mastersSubjectsRoute,
    mastersSubjectTypesRoute,
    mastersProgrammeAdmissionYearsRoute,
    mastersProgrammeConfigurationRoute,
    mastersSemesterSettingsRoute,
    mastersSemesterSubjectsRoute,
    mastersSemesterFacultyRoute,
    mastersSemesterStudentAllocationRoute,
    mastersSlotEnrollmentsRoute,
    mastersSemesterTimetablesRoute,
    mastersTimetableEditorRoute,
    mastersTimetableScheduleRoute,
    mastersProgrammeAttendanceGroupsRoute,
    employeesDesignationsRoute,
    employeesAllRoute,
    employeesBulkUploadRoute,
    studentsAllRoute,
    studentsBulkUploadRoute,
    guardiansAllRoute,
    guardiansBulkUploadRoute,
    studentDetailsRoute,
    additionalAttributesStudentRoute,
    additionalAttributesAddressRoute,
    roleManagementRolesRoute,
    roleManagementRoleEditorRoute,
    roleManagementAssignmentsRoute,
    roleManagementAssignmentEditorRoute,
    profileRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
