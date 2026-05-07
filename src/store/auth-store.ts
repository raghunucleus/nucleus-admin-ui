import { create } from "zustand"
import { persist } from "zustand/middleware"

export type AdminProfile = {
  id: string
  username: string
  email: string
  createdAt?: string
  updatedAt?: string
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
