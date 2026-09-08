import * as React from "react"
import { AlertTriangle, Check, Copy, Mail, SkipForward } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import {
  SKIP_REASON_LABELS,
  previewAccountInvites,
  sendAccountInvites,
  type InviteBatchFilter,
  type InvitePreviewRow,
  type InviteSubjectType,
  type SendInvitesResult,
  type SkipReason,
} from "@/lib/account-invites"

/**
 * Recipients per request. The server caps a batch far higher
 * (ACCOUNT_INVITE_MAX_BATCH), but a single request that sends more than this
 * can brush nginx's default 60s proxy_read_timeout — the admin would see a
 * network error while the server kept sending, and a retry would double-send.
 * So a large batch is chunked here and the summaries are added up.
 */
const CHUNK_SIZE = 200

export type SendInvitesTarget =
  /** An explicit selection from the table. */
  | {
      kind: "ids"
      ids: number[]
      /** Pre-checked "resend" — the "Resend to selected" menu entry. */
      resend: boolean
    }
  /** Everyone matching the applied filters. */
  | { kind: "batch"; filter: InviteBatchFilter; label: string }

type Phase =
  | { k: "confirm" }
  | { k: "sending"; done: number; total: number }
  | { k: "result"; result: SendInvitesResult }

/**
 * Send account invitations to a selection or a whole batch.
 *
 * Built on Sheet rather than ConfirmDialog: this has three phases (confirm →
 * sending → result) and the result is a report the admin needs to read, not a
 * yes/no.
 */
export function SendInvitesDialog({
  open,
  onOpenChange,
  subjectType,
  target,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectType: InviteSubjectType
  target: SendInvitesTarget | null
  /** Called once after a send completes, so the list can refresh its column. */
  onSent: () => void
}) {
  const [phase, setPhase] = React.useState<Phase>({ k: "confirm" })
  const [resend, setResend] = React.useState(false)
  const [onlyUninvited, setOnlyUninvited] = React.useState(true)
  const [preview, setPreview] = React.useState<{
    total: number
    sample: InvitePreviewRow[]
  } | null>(null)
  const [previewFailed, setPreviewFailed] = React.useState(false)

  const noun = subjectType === "student" ? "student" : "employee"

  // Reset every time the sheet opens, so a previous result never bleeds into a
  // new send.
  React.useEffect(() => {
    if (!open) return
    setPhase({ k: "confirm" })
    setPreview(null)
    setPreviewFailed(false)
    setResend(target?.kind === "ids" ? target.resend : false)
    setOnlyUninvited(true)
  }, [open, target])

  // Batch mode has no row list to count from, so ask the server what the
  // filter actually matches before anyone commits to sending.
  React.useEffect(() => {
    if (!open || target?.kind !== "batch") return
    let cancelled = false
    void (async () => {
      try {
        const res = await previewAccountInvites({
          subject_type: subjectType,
          ...target.filter,
          only_uninvited: true,
        })
        if (!cancelled) setPreview(res)
      } catch {
        if (!cancelled) setPreviewFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, target, subjectType])

  const idCount = target?.kind === "ids" ? target.ids.length : 0
  const batchCount = preview?.total ?? 0
  const totalToSend = target?.kind === "ids" ? idCount : batchCount
  const canSend =
    !!target && (target.kind === "ids" ? idCount > 0 : batchCount > 0)

  async function handleSend() {
    if (!target) return
    setPhase({ k: "sending", done: 0, total: totalToSend })

    const merged: SendInvitesResult = {
      requested: 0,
      sent: 0,
      skipped: [],
      failed: [],
    }

    try {
      if (target.kind === "batch") {
        const res = await sendAccountInvites({
          subject_type: subjectType,
          filter: target.filter,
          only_uninvited: onlyUninvited,
          resend,
        })
        mergeInto(merged, res)
      } else {
        // Chunked so no single request runs long enough to hit a proxy timeout.
        for (let i = 0; i < target.ids.length; i += CHUNK_SIZE) {
          const slice = target.ids.slice(i, i + CHUNK_SIZE)
          const res = await sendAccountInvites({
            subject_type: subjectType,
            subject_ids: slice,
            only_uninvited: onlyUninvited,
            resend,
          })
          mergeInto(merged, res)
          setPhase({
            k: "sending",
            done: Math.min(i + CHUNK_SIZE, target.ids.length),
            total: target.ids.length,
          })
        }
      }

      setPhase({ k: "result", result: merged })
      toast.success("Invitations sent", {
        description: `${merged.sent} sent · ${merged.skipped.length} skipped · ${merged.failed.length} failed`,
      })
      onSent()
    } catch (err) {
      setPhase({ k: "confirm" })
      toast.error("Couldn't send invitations", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Send account invitations</SheetTitle>
          <SheetDescription>
            Each {noun} receives a single-use link to choose their own password.
            No password is sent by email.
          </SheetDescription>
        </SheetHeader>

        {phase.k === "confirm" && (
          <>
            <SheetBody className="space-y-5">
              {target?.kind === "batch" ? (
                previewFailed ? (
                  <p className="text-sm text-destructive">
                    Couldn't work out who this batch covers. Close this panel and
                    try again.
                  </p>
                ) : preview === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      <span className="font-semibold tabular-nums">
                        {preview.total}
                      </span>{" "}
                      {preview.total === 1 ? noun : `${noun}s`} in{" "}
                      <span className="font-medium">{target.label}</span>{" "}
                      {preview.total === 1 ? "does" : "do"} not have a working
                      account yet.
                    </p>
                    {preview.sample.length > 0 && (
                      <SamplePeople rows={preview.sample} total={preview.total} />
                    )}
                  </div>
                )
              ) : (
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">{idCount}</span>{" "}
                  selected {idCount === 1 ? noun : `${noun}s`}.
                </p>
              )}

              <div className="space-y-3 rounded-md border p-3">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={resend}
                    onChange={(e) => setResend(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">
                      Also resend to people who already have a live invitation
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Their old link stops working. Off by default so a repeat
                      send doesn't spam anyone.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={onlyUninvited}
                    disabled={target?.kind === "batch"}
                    onChange={(e) => setOnlyUninvited(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">
                      Skip people who can already sign in
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {target?.kind === "batch"
                        ? "Always on for a whole batch — inviting an active account resets it."
                        : "Turn off to send anyway. Sending to an active account lets them set a new password."}
                    </span>
                  </span>
                </label>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSend()} disabled={!canSend}>
                <Mail />
                Send {totalToSend > 0 ? totalToSend : ""}{" "}
                {totalToSend === 1 ? "invitation" : "invitations"}
              </Button>
            </SheetFooter>
          </>
        )}

        {phase.k === "sending" && (
          <SheetBody className="space-y-4">
            <p className="text-sm">
              Sending{" "}
              <span className="font-semibold tabular-nums">{phase.total}</span>{" "}
              {phase.total === 1 ? "invitation" : "invitations"}… this can take a
              minute.
            </p>
            {phase.total > CHUNK_SIZE && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {phase.done} of {phase.total} processed
              </p>
            )}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </SheetBody>
        )}

        {phase.k === "result" && (
          <>
            <SheetBody className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Counter
                  tone="success"
                  icon={<Check className="size-3.5" />}
                  count={phase.result.sent}
                  label="sent"
                />
                <Counter
                  tone="muted"
                  icon={<SkipForward className="size-3.5" />}
                  count={phase.result.skipped.length}
                  label="skipped"
                />
                <Counter
                  tone="destructive"
                  icon={<AlertTriangle className="size-3.5" />}
                  count={phase.result.failed.length}
                  label="failed"
                />
              </div>

              {phase.result.skipped.length > 0 && (
                <SkippedList skipped={phase.result.skipped} />
              )}

              {phase.result.failed.length > 0 && (
                <FailedList failed={phase.result.failed} />
              )}

              {phase.result.sent === 0 &&
                phase.result.skipped.length === 0 &&
                phase.result.failed.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nobody matched — there was nothing to send.
                  </p>
                )}
            </SheetBody>

            <SheetFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SamplePeople({
  rows,
  total,
}: {
  rows: InvitePreviewRow[]
  total: number
}) {
  return (
    <div className="rounded-md border">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2 px-3 py-1.5">
            <span className="truncate text-sm">{r.display_name}</span>
            <span className="ml-auto truncate text-xs text-muted-foreground">
              {r.email || "no email"}
            </span>
          </li>
        ))}
      </ul>
      {total > rows.length && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
          and {total - rows.length} more
        </p>
      )}
    </div>
  )
}

function Counter({
  tone,
  icon,
  count,
  label,
}: {
  tone: "success" | "muted" | "destructive"
  icon: React.ReactNode
  count: number
  label: string
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {icon}
      <span className="tabular-nums">{count}</span> {label}
    </span>
  )
}

function SkippedList({
  skipped,
}: {
  skipped: SendInvitesResult["skipped"]
}) {
  // Grouped by reason: "12 already have a working account" is a far more
  // useful line than twelve identical rows.
  const groups = new Map<SkipReason, string[]>()
  for (const s of skipped) {
    const list = groups.get(s.reason) ?? []
    list.push(s.identifier)
    groups.set(s.reason, list)
  }

  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Skipped ({skipped.length})
      </summary>
      <div className="space-y-3 border-t px-3 py-2">
        {[...groups.entries()].map(([reason, identifiers]) => (
          <div key={reason}>
            <p className="text-xs font-medium">
              {SKIP_REASON_LABELS[reason]}{" "}
              <span className="text-muted-foreground tabular-nums">
                ({identifiers.length})
              </span>
            </p>
            <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground">
              {identifiers.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </details>
  )
}

function FailedList({ failed }: { failed: SendInvitesResult["failed"] }) {
  return (
    <details className="rounded-md border border-destructive/30" open>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-destructive">
        Failed ({failed.length})
      </summary>
      <div className="space-y-2 border-t px-3 py-2">
        <ul className="space-y-1">
          {failed.map((f) => (
            <li key={f.subject_id} className="text-xs">
              <span className="font-mono">{f.identifier}</span>{" "}
              <span className="text-muted-foreground">
                {f.email} — {f.message}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard
              .writeText(failed.map((f) => f.email).join(", "))
              .then(() => toast.success("Addresses copied"))
              .catch(() => toast.error("Couldn't copy to clipboard"))
          }}
        >
          <Copy />
          Copy failed addresses
        </Button>
      </div>
    </details>
  )
}

function mergeInto(target: SendInvitesResult, next: SendInvitesResult): void {
  target.requested += next.requested
  target.sent += next.sent
  target.skipped.push(...next.skipped)
  target.failed.push(...next.failed)
}
