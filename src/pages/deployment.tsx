import { LAST_DEPLOYED_ON } from "@/config/deployment"

/**
 * Shows when this build was last deployed, and nothing else.
 *
 * The value is free text from `@/config/deployment` and is printed verbatim:
 * never parsed, reformatted, or turned into a relative age.
 */
export function DeploymentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <h1 className="text-xl font-semibold tracking-tight">Deployment</h1>
      <div className="space-y-1 rounded-lg border bg-card p-6 text-card-foreground">
        <p className="text-sm text-muted-foreground">Last deployed on</p>
        <p className="text-base font-medium">{LAST_DEPLOYED_ON}</p>
      </div>
    </div>
  )
}
