import { create } from "zustand"
import { persist } from "zustand/middleware"

export type AdminProfile = {
  id: string
  username: string
  email: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null
  mobile_number?: string | null
  display_name?: string | null
  is_master_admin?: boolean
  totp_enabled_at?: string | null
  created_at?: string
  updated_at?: string
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: AdminProfile | null
  loginAt: number | null
  setTokens: (tokens: AuthTokens) => void
  setUser: (user: AdminProfile) => void
  setLoginAt: (loginAt: number | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      loginAt: null,
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setLoginAt: (loginAt) => set({ loginAt }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null, loginAt: null }),
    }),
    { name: "nucleus-auth-v2" },
  ),
)
