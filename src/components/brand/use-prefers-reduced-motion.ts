import { useSyncExternalStore } from "react"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

const canQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"

function subscribe(onChange: () => void) {
  if (!canQuery()) return () => {}
  const mql = window.matchMedia(REDUCED_MOTION)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

const getSnapshot = () => canQuery() && window.matchMedia(REDUCED_MOTION).matches
const getServerSnapshot = () => false

/**
 * The OS / browser "reduce motion" preference, live. Needed in JS (not just
 * CSS) because the animated mark uses different markup from the static logo.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
