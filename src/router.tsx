import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { AdminUsersPage } from "@/pages/admin-users"
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
import { ProgrammeAttendanceGroupsPage } from "@/pages/programme-attendance-groups"
import { SemesterFacultyPage } from "@/pages/semester-faculty"
import { SemesterSettingsPage } from "@/pages/semester-settings"
import { SemesterSubjectsPage } from "@/pages/semester-subjects"
import { SemesterTimetablesPage } from "@/pages/semester-timetables"
import { SemestersPage } from "@/pages/semesters"
import { StudentsPage } from "@/pages/students"
import { StudentsBulkUploadPage } from "@/pages/students-bulk-upload"
import { StudentDetailsPage } from "@/pages/student-details"
import { SubjectsPage } from "@/pages/subjects"
import { TimetableEditorPage } from "@/pages/timetable-editor"
import { MigrationsPage } from "@/pages/migrations"
import { NotFoundPage } from "@/pages/not-found"
import { ProfilePage } from "@/pages/profile"
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

const mastersSubjectsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/masters/subjects",
  component: SubjectsPage,
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

// Dynamic detail route. Static siblings (/students/all, /students/bulk-upload)
// always win over this param route, so there's no collision.
const studentDetailsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/students/$studentId",
  component: StudentDetailsPage,
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
    mastersDegreesRoute,
    mastersDepartmentsRoute,
    mastersProgrammesRoute,
    mastersProgrammeSemestersRoute,
    mastersSemestersRoute,
    mastersAdmissionYearsRoute,
    mastersRegulationsRoute,
    mastersSubjectsRoute,
    mastersProgrammeAdmissionYearsRoute,
    mastersProgrammeConfigurationRoute,
    mastersSemesterSettingsRoute,
    mastersSemesterSubjectsRoute,
    mastersSemesterFacultyRoute,
    mastersSemesterTimetablesRoute,
    mastersTimetableEditorRoute,
    mastersProgrammeAttendanceGroupsRoute,
    employeesDesignationsRoute,
    employeesAllRoute,
    employeesBulkUploadRoute,
    studentsAllRoute,
    studentsBulkUploadRoute,
    studentDetailsRoute,
    profileRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
