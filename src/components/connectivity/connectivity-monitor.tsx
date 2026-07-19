import * as React from "react"

import { pingServer } from "@/lib/api"
import { useConnectivityStore } from "@/store/connectivity-store"

import { ServerUnreachable } from "./server-unreachable"

/** How often we re-probe `/health/live` while offline, awaiting recovery. */
const RECOVERY_POLL_MS = 5_000

/**
 * Server-unreachable detection + full-screen offline takeover. Mounted once at
 * the app root (a sibling of the router) so an outage on any screen — login
 * included — shows the takeover. The state machine:
 *
 *  - A passively-reported failure fires one confirming probe before we take
 *    over, so a single transient blip never blanks the screen.
 *  - While offline, poll `/health/live` every 5s and clear on the first success.
 *  - Browser `offline`/`online` events give an instant extra trigger.
 *
 * Recovery bumps the store's `reconnectNonce`; `AppLayout` keys its `<Outlet>`
 * on it, so the active page remounts and refetches — no page reload, the user
 * stays on the same route.
 */
export function ConnectivityMonitor() {
  const status = useConnectivityStore((s) => s.status)
  const failureSeq = useConnectivityStore((s) => s.failureSeq)
  const [checking, setChecking] = React.useState(false)

  // Confirm a passively-reported failure with one probe before going offline.
  React.useEffect(() => {
    if (failureSeq === 0) return
    if (useConnectivityStore.getState().status === "offline") return
    let cancelled = false
    void pingServer().then((ok) => {
      if (!cancelled && !ok) useConnectivityStore.getState().setOffline()
    })
    return () => {
      cancelled = true
    }
  }, [failureSeq])

  // While offline, poll for recovery and clear the moment the server answers.
  React.useEffect(() => {
    if (status !== "offline") return
    let stopped = false
    const id = window.setInterval(() => {
      void pingServer().then((ok) => {
        if (!stopped && ok) useConnectivityStore.getState().setOnline()
      })
    }, RECOVERY_POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [status])

  // Browser network events: instant offline, confirm-then-clear on return.
  React.useEffect(() => {
    const onOffline = () => useConnectivityStore.getState().setOffline()
    const onOnline = () => {
      void pingServer().then((ok) => {
        if (ok) useConnectivityStore.getState().setOnline()
      })
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  const handleRetry = React.useCallback(() => {
    setChecking(true)
    void pingServer().then((ok) => {
      if (ok) useConnectivityStore.getState().setOnline()
      setChecking(false)
    })
  }, [])

  if (status !== "offline") return null
  return <ServerUnreachable onRetry={handleRetry} checking={checking} />
}
