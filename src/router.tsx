import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { AppLayout } from "@/layouts/app-layout"
import { AuthLayout } from "@/layouts/auth-layout"
import { LoginPage } from "@/pages/login"
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
  protectedLayoutRoute.addChildren([welcomeRoute, migrationsRoute, profileRoute]),
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
