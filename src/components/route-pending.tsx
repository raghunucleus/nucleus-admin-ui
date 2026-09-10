import { NucleusLoader } from "@/components/brand"

/**
 * Suspense fallback for a route whose page chunk is still downloading. Every
 * page is a `lazyRouteComponent`, so this is what the router paints inside the
 * app chrome (the sidebar stays mounted) on a cold deep link or a slow
 * navigation — never a full-screen splash.
 *
 * This covers the wait for *code*. Waits for *data* still use the `Skeleton`
 * shimmer inside the page itself (see CLAUDE.md → Loading states).
 */
export function RoutePending() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <NucleusLoader size={48} />
    </div>
  )
}
