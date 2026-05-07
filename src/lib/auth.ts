import { api } from "@/lib/api"
import { useAuthStore, type AdminProfile, type AuthTokens } from "@/store/auth-store"

export async function login(identifier: string, password: string): Promise<void> {
  const tokens = await api<AuthTokens>("/admin/login", {
    method: "POST",
    body: { identifier, password },
    auth: false,
  })
  useAuthStore.getState().setTokens(tokens)
  useAuthStore.getState().setLoginAt(Date.now())

  const profile = await api<AdminProfile>("/admin/me", { method: "GET" })
  useAuthStore.getState().setUser(profile)
}

export async function logout(): Promise<void> {
  try {
    await api<void>("/admin/logout", { method: "POST" })
  } catch {
    /* even if the server call fails, clear local state */
  }
  useAuthStore.getState().clearAuth()
}

export async function fetchProfile(): Promise<AdminProfile> {
  const profile = await api<AdminProfile>("/admin/me", { method: "GET" })
  useAuthStore.getState().setUser(profile)
  return profile
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await api<void>("/admin/change-password", {
    method: "POST",
    body: { oldPassword, newPassword },
  })
}
