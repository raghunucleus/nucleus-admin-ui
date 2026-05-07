import { api } from "@/lib/api"
import { useAuthStore, type AdminProfile, type AuthTokens } from "@/store/auth-store"

type LoginTokensResponse = AuthTokens & {
  twoFactorRequired?: false
  requiresTotpSetup: boolean
}

type LoginChallengeResponse = {
  twoFactorRequired: true
  challengeToken: string
}

type LoginRawResponse = LoginTokensResponse | LoginChallengeResponse

export type LoginResult =
  | { kind: "tokens"; requiresTotpSetup: boolean; profile: AdminProfile }
  | { kind: "challenge"; challengeToken: string }

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const res = await api<LoginRawResponse>("/admin/login", {
    method: "POST",
    body: { identifier, password },
    auth: false,
  })

  if (res.twoFactorRequired) {
    return { kind: "challenge", challengeToken: res.challengeToken }
  }

  useAuthStore.getState().setTokens({
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
  })
  useAuthStore.getState().setLoginAt(Date.now())

  const profile = await api<AdminProfile>("/admin/me", { method: "GET" })
  useAuthStore.getState().setUser(profile)

  return { kind: "tokens", requiresTotpSetup: res.requiresTotpSetup, profile }
}

export async function verifyTwoFactor(
  challengeToken: string,
  code: string,
): Promise<AdminProfile> {
  const tokens = await api<AuthTokens>("/admin/login/verify-2fa", {
    method: "POST",
    body: { challengeToken, code },
    auth: false,
  })
  useAuthStore.getState().setTokens(tokens)
  useAuthStore.getState().setLoginAt(Date.now())

  const profile = await api<AdminProfile>("/admin/me", { method: "GET" })
  useAuthStore.getState().setUser(profile)
  return profile
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

export type UpdateProfileInput = {
  email?: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null
  mobile_number?: string | null
}

export async function updateProfile(
  patch: UpdateProfileInput,
): Promise<AdminProfile> {
  const profile = await api<AdminProfile>("/admin/me", {
    method: "PATCH",
    body: patch,
  })
  useAuthStore.getState().setUser(profile)
  return profile
}

export type TotpSetupResponse = {
  secret: string
  otpauthUrl: string
  qrDataUrl: string
}

export async function setupTotp(): Promise<TotpSetupResponse> {
  return await api<TotpSetupResponse>("/admin/totp/setup", { method: "POST" })
}

export async function enableTotp(code: string): Promise<{ recoveryCodes: string[] }> {
  const res = await api<{ recoveryCodes: string[]; tokens: AuthTokens }>(
    "/admin/totp/enable",
    { method: "POST", body: { code } },
  )
  // Server rotates tokens (the previous ones were issued with totp_pending=true).
  useAuthStore.getState().setTokens(res.tokens)
  // Refresh profile so totp_enabled_at lands in the store.
  await fetchProfile()
  return { recoveryCodes: res.recoveryCodes }
}

export async function disableTotp(password: string, code: string): Promise<void> {
  await api<void>("/admin/totp/disable", {
    method: "POST",
    body: { password, code },
  })
  await fetchProfile()
}
