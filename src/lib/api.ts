import { useAuthStore, type AuthTokens } from "@/store/auth-store"

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "/api"

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  auth?: boolean
}

let refreshInflight: Promise<string | null> | null = null

async function refreshTokens(): Promise<string | null> {
  if (refreshInflight) return refreshInflight

  refreshInflight = (async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) return null

    try {
      const res = await fetch(`${API_BASE}/admin/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        useAuthStore.getState().clearAuth()
        return null
      }
      const tokens = (await res.json()) as AuthTokens
      useAuthStore.getState().setTokens(tokens)
      return tokens.accessToken
    } catch {
      useAuthStore.getState().clearAuth()
      return null
    }
  })()

  try {
    return await refreshInflight
  } finally {
    refreshInflight = null
  }
}

function buildRequest(path: string, opts: ApiOptions): Request {
  const { body, auth = true, headers, ...rest } = opts
  const h = new Headers(headers)
  if (body !== undefined) h.set("Content-Type", "application/json")
  if (auth) {
    const token = useAuthStore.getState().accessToken
    if (token) h.set("Authorization", `Bearer ${token}`)
  }
  return new Request(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function extractError(res: Response): Promise<ApiError> {
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* ignore non-JSON */
  }
  const message = pickErrorMessage(data) ?? res.statusText ?? "Request failed"
  return new ApiError(message, res.status, data)
}

function pickErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const m = (data as { message?: unknown }).message
  if (typeof m === "string") return m
  if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join("; ") || null
  return null
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res = await fetch(buildRequest(path, opts))

  if (res.status === 401 && (opts.auth ?? true)) {
    const newAccess = await refreshTokens()
    if (newAccess) {
      res = await fetch(buildRequest(path, opts))
    }
  }

  if (!res.ok) throw await extractError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
