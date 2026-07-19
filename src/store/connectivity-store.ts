import { create } from "zustand"

interface ConnectivityState {
  /** Current reachability of the API server. */
  status: "online" | "offline"
  /** Bumped on every reported failure — drives one confirming probe. */
  failureSeq: number
  /**
   * Bumped exactly once per offline→online transition. `AppLayout` keys its
   * `<Outlet>` on it, so the active page remounts and refetches on recovery —
   * never on the per-request `reportOk` of a healthy session.
   */
  reconnectNonce: number
  /** Informational: ms timestamp of the last successful reach. */
  lastOkAt: number | null

  /** A request reached the server (any non-gateway-down response). */
  reportOk: () => void
  /** A request failed to reach the server (network error / timeout / 5xx gw). */
  reportFail: () => void
  /** Force-mark online (used by the recovery probe / online event). */
  setOnline: () => void
  /** Force-mark offline (used by the confirming probe / offline event). */
  setOffline: () => void
}

/**
 * Patch that brings the store online, bumping `reconnectNonce` *only* on a real
 * offline→online transition (so the page remounts/refetches exactly once, never
 * on the per-request `reportOk` of a healthy session).
 */
function onlinePatch(s: ConnectivityState): Partial<ConnectivityState> {
  const base = { status: "online" as const, lastOkAt: Date.now() }
  return s.status === "offline"
    ? { ...base, reconnectNonce: s.reconnectNonce + 1 }
    : base
}

/**
 * App-wide connectivity state. Fed passively by the fetch wrapper in
 * `lib/api.ts` and driven as a state machine by `ConnectivityMonitor`. No side
 * effects live here — the monitor owns confirming probes and recovery polling.
 */
export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: "online",
  failureSeq: 0,
  reconnectNonce: 0,
  lastOkAt: null,
  reportOk: () => set(onlinePatch),
  reportFail: () => set((s) => ({ failureSeq: s.failureSeq + 1 })),
  setOnline: () => set(onlinePatch),
  setOffline: () => set({ status: "offline" }),
}))
