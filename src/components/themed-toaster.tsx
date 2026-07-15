import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/components/theme-provider"

/**
 * App-wide toast host that follows the active theme. Sonner defaults to a light
 * surface, so without passing `theme` it renders white in dark mode.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} />
}
