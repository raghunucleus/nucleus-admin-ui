import { useAuthStore, type AuthTokens } from "@/store/auth-store"
import { useConnectivityStore } from "@/store/connectivity-store"

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "/api"

/** Unauthenticated liveness probe (NestJS Terminus) used for recovery checks. */
const HEALTH_PATH = "/health/live"

/** Gateway statuses that mean an upstream proxy couldn't reach the app server. */
const GATEWAY_DOWN = new Set([502, 503, 504])

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

/**
 * `fetch` that passively reports reachability into the connectivity store. A
 * resolved `Response` is treated as online (even a 4xx/5xx app error), except
 * gateway statuses {502,503,504} which mean a proxy couldn't reach the app. A
 * thrown error (network down / DNS / abort) is a failure. The original
 * result/error is always returned/rethrown unchanged so call-site handling is
 * untouched.
 */
async function fetchReporting(input: Request): Promise<Response> {
  try {
    const res = await fetch(input)
    const conn = useConnectivityStore.getState()
    if (GATEWAY_DOWN.has(res.status)) conn.reportFail()
    else conn.reportOk()
    return res
  } catch (err) {
    useConnectivityStore.getState().reportFail()
    throw err
  }
}

/**
 * Cheap, unauthenticated liveness check against `/health/live`. Returns a
 * boolean and writes nothing to the store — the monitor uses it for the
 * confirming probe and recovery polling. Aborts after `timeoutMs`.
 */
export async function pingServer(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${HEALTH_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
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
      const res = await fetchReporting(
        new Request(`${API_BASE}/admin/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }),
      )
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
  // FormData bodies (file uploads) set their own multipart boundary — the
  // browser must own the Content-Type header for those.
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) h.set("Content-Type", "application/json")
  if (auth) {
    const token = useAuthStore.getState().accessToken
    if (token) h.set("Authorization", `Bearer ${token}`)
  }
  return new Request(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
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
  let res = await fetchReporting(buildRequest(path, opts))

  if (res.status === 401 && (opts.auth ?? true)) {
    const newAccess = await refreshTokens()
    if (newAccess) {
      res = await fetchReporting(buildRequest(path, opts))
    }
  }

  if (!res.ok) throw await extractError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
