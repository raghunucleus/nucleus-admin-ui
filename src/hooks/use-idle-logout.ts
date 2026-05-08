import * as React from "react"
import { useNavigate } from "@tanstack/react-router"

import { SESSION_CONFIG } from "@/config/session"
import { logout } from "@/lib/auth"
import { useAuthStore } from "@/store/auth-store"

export function useIdleLogout() {
  const navigate = useNavigate()
  const lastActivityRef = React.useRef<number>(Date.now())
  const loggingOutRef = React.useRef(false)

  React.useEffect(() => {
    lastActivityRef.current = Date.now()
    loggingOutRef.current = false

    let lastFired = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastFired < SESSION_CONFIG.activityThrottleMs) return
      lastFired = now
      lastActivityRef.current = now
    }

    for (const evt of SESSION_CONFIG.activityEvents) {
      window.addEventListener(evt, onActivity, { passive: true })
    }

    const check = () => {
      if (loggingOutRef.current) return
      if (!useAuthStore.getState().accessToken) return
      if (Date.now() - lastActivityRef.current < SESSION_CONFIG.idleTimeoutMs) return
      loggingOutRef.current = true
      void logout().finally(() => navigate({ to: "/login" }))
    }

    const interval = window.setInterval(check, SESSION_CONFIG.checkIntervalMs)

    const onVisibility = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      for (const evt of SESSION_CONFIG.activityEvents) {
        window.removeEventListener(evt, onActivity)
      }
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(interval)
    }
  }, [navigate])
}
