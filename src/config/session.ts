export const SESSION_CONFIG = {
  idleTimeoutMs: 15 * 60 * 1000,
  checkIntervalMs: 30 * 1000,
  activityThrottleMs: 1000,
  activityEvents: [
    "mousemove",
    "keydown",
    "click",
    "scroll",
    "touchstart",
  ],
} as const
