import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router"

import { RoutePending } from "@/components/route-pending"
import { AuthLayout } from "@/layouts/auth-layout"
import { LoginPage } from "@/pages/login"
import { NotFoundPage } from "@/pages/not-found"
import { SetupTwoFactorPage } from "@/pages/setup-2fa"
import { useAuthStore } from "@/store/auth-store"

// The signed-in chrome (sidebar, header, its dropdown menu) is only reachable
// once `beforeLoad` has let the admin through, so it loads with them rather
// than with the login form — that keeps Radix's dropdown/dialog/floating-ui
// and the sidebar's icon set out of the entry chunk.
const AppLayout = lazyRouteComponent(
  () => import("@/layouts/app-layout"),
  "AppLayout",
)

// Every screen behind the auth guard is its own chunk, fetched on first
// navigation (or on link hover — see `defaultPreload`). Only the auth layout,
// the 404, and the pre-app screens (login, setup-2FA) are static, because they
// render before any of this is reachable.
//
// Never `import { XPage } from "@/pages/..."` here — one static import drags
// that page, and everything it pulls in, into the entry chunk that the login
// screen downloads. Pages export named components, so each wrapper passes the
// export name as the second argument. Type-only imports are fine: they are
// erased, which is why the three pages that import their search-param type back
// from this module create no runtime cycle.
const AcademicHolidaysPage = lazyRouteComponent(
  () => import("@/pages/academic-holidays"),
  "AcademicHolidaysPage",
)
const AdminUsersPage = lazyRouteComponent(
  () => import("@/pages/admin-users"),
  "AdminUsersPage",
)
const ApprovalApproversPage = lazyRouteComponent(
  () => import("@/pages/approval-approvers"),
  "ApprovalApproversPage",
)
const AdmissionYearsPage = lazyRouteComponent(
  () => import("@/pages/admission-years"),
  "AdmissionYearsPage",
)
const DegreesPage = lazyRouteComponent(
  () => import("@/pages/degrees"),
  "DegreesPage",
)
const DepartmentsPage = lazyRouteComponent(
  () => import("@/pages/departments"),
  "DepartmentsPage",
)
const DesignationsPage = lazyRouteComponent(
  () => import("@/pages/designations"),
  "DesignationsPage",
)
const EmployeesPage = lazyRouteComponent(
  () => import("@/pages/employees"),
  "EmployeesPage",
)
const EmployeesBulkUploadPage = lazyRouteComponent(
  () => import("@/pages/employees-bulk-upload"),
  "EmployeesBulkUploadPage",
)
const ProgrammeConfigurationPage = lazyRouteComponent(
  () => import("@/pages/programme-configuration"),
  "ProgrammeConfigurationPage",
)
const ProgrammeAdmissionYearsPage = lazyRouteComponent(
  () => import("@/pages/programme-admission-years"),
  "ProgrammeAdmissionYearsPage",
)
const ProgrammeSemestersPage = lazyRouteComponent(
  () => import("@/pages/programme-semesters"),
  "ProgrammeSemestersPage",
)
const ProgrammesPage = lazyRouteComponent(
  () => import("@/pages/programmes"),
  "ProgrammesPage",
)
const RegulationsPage = lazyRouteComponent(
  () => import("@/pages/regulations"),
  "RegulationsPage",
)
const RegulationMarkStructuresPage = lazyRouteComponent(
  () => import("@/pages/regulation-mark-structures"),
  "RegulationMarkStructuresPage",
)
const MarkStructureEditorPage = lazyRouteComponent(
  () => import("@/pages/mark-structure-editor"),
  "MarkStructureEditorPage",
)
const ProgrammeAttendanceGroupsPage = lazyRouteComponent(
  () => import("@/pages/programme-attendance-groups"),
  "ProgrammeAttendanceGroupsPage",
)
const SemesterFacultyPage = lazyRouteComponent(
  () => import("@/pages/semester-faculty"),
  "SemesterFacultyPage",
)
const SemesterSettingsPage = lazyRouteComponent(
  () => import("@/pages/semester-settings"),
  "SemesterSettingsPage",
)
const SemesterStudentAllocationPage = lazyRouteComponent(
  () => import("@/pages/semester-student-allocation"),
  "SemesterStudentAllocationPage",
)
const SemesterSubjectsPage = lazyRouteComponent(
  () => import("@/pages/semester-subjects"),
  "SemesterSubjectsPage",
)
const SlotEnrollmentsPage = lazyRouteComponent(
  () => import("@/pages/slot-enrollments"),
  "SlotEnrollmentsPage",
)
const SemesterTimetablesPage = lazyRouteComponent(
  () => import("@/pages/semester-timetables"),
  "SemesterTimetablesPage",
)
const SemestersPage = lazyRouteComponent(
  () => import("@/pages/semesters"),
  "SemestersPage",
)
const StudentsPage = lazyRouteComponent(
  () => import("@/pages/students"),
  "StudentsPage",
)
const StudentsBulkUploadPage = lazyRouteComponent(
  () => import("@/pages/students-bulk-upload"),
  "StudentsBulkUploadPage",
)
const GuardiansPage = lazyRouteComponent(
  () => import("@/pages/guardians"),
  "GuardiansPage",
)
const GuardiansBulkUploadPage = lazyRouteComponent(
  () => import("@/pages/guardians-bulk-upload"),
  "GuardiansBulkUploadPage",
)
const StudentDetailsPage = lazyRouteComponent(
  () => import("@/pages/student-details"),
  "StudentDetailsPage",
)
const AddressAttributesPage = lazyRouteComponent(
  () => import("@/pages/address-attributes/address-attributes"),
  "AddressAttributesPage",
)
const StudentAttributesPage = lazyRouteComponent(
  () => import("@/pages/student-attributes/student-attributes"),
  "StudentAttributesPage",
)
const SubjectsPage = lazyRouteComponent(
  () => import("@/pages/subjects"),
  "SubjectsPage",
)
const SubjectTypesPage = lazyRouteComponent(
  () => import("@/pages/subject-types"),
  "SubjectTypesPage",
)
const LeaveTypesPage = lazyRouteComponent(
  () => import("@/pages/leave-types"),
  "LeaveTypesPage",
)
const TimetableEditorPage = lazyRouteComponent(
  () => import("@/pages/timetable-editor"),
  "TimetableEditorPage",
)
const TimetableSchedulePage = lazyRouteComponent(
  () => import("@/pages/timetable-schedule"),
  "TimetableSchedulePage",
)
const MigrationsPage = lazyRouteComponent(
  () => import("@/pages/migrations"),
  "MigrationsPage",
)
const ProfilePage = lazyRouteComponent(
  () => import("@/pages/profile"),
  "ProfilePage",
)
const AssignmentEditorPage = lazyRouteComponent(
  () => import("@/pages/role-management/assignment-editor"),
  "AssignmentEditorPage",
)
const AssignmentsListPage = lazyRouteComponent(
  () => import("@/pages/role-management/assignments-list"),
  "AssignmentsListPage",
)
const RoleBuilderPage = lazyRouteComponent(
  () => import("@/pages/role-management/role-builder"),
  "RoleBuilderPage",
)
const RolesListPage = lazyRouteComponent(
  () => import("@/pages/role-management/roles-list"),
  "RolesListPage",
)
const WelcomePage = lazyRouteComponent(
  () => import("@/pages/welcome"),
  "WelcomePage",
)

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

const mastersLeaveTypesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/leave-types",
  component: LeaveTypesPage,
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
    mastersLeaveTypesRoute,
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

export const router = createRouter({
  routeTree,
  // Suspense fallback while a page chunk downloads. The router gives each match
  // its own boundary, so this renders inside AppLayout's <Outlet> and the
  // sidebar never unmounts. Hovering or focusing a <Link> prefetches its chunk.
  defaultPendingComponent: RoutePending,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
