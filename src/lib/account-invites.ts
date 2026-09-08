import { api } from "@/lib/api"

export type InviteSubjectType = "employee" | "student"

export type AccountStatusKind = "not_invited" | "invited" | "expired" | "active"

/**
 * Per-row account state on the students/employees lists.
 *
 * "active" means the person can actually sign in — a password hash OR a linked
 * Google identity. "expired" and "invited" both describe an outstanding link;
 * "not_invited" covers both never-invited and revoked.
 */
export type AccountStatusView = {
  status: AccountStatusKind
  invited_at: string | null
  expires_at: string | null
  resend_count: number
  last_login_at: string | null
}

export type InviteBatchFilter =
  | { programme_id: number; admission_year_id: number }
  | { department_id: number }

export type SkipReason =
  | "already_active"
  | "no_email"
  | "inactive"
  | "cooldown"
  | "outstanding_invite"
  | "not_found"

export type SendInvitesBody = {
  subject_type: InviteSubjectType
  subject_ids?: number[]
  filter?: InviteBatchFilter
  only_uninvited?: boolean
  resend?: boolean
}

export type SendInvitesResult = {
  requested: number
  sent: number
  skipped: { subject_id: number; identifier: string; reason: SkipReason }[]
  failed: {
    subject_id: number
    identifier: string
    email: string
    message: string
  }[]
}

export type InvitePreviewRow = {
  id: number
  display_name: string
  identifier: string
  email: string
  account_status: AccountStatusKind
}

export type InviteHistoryRow = {
  id: number
  email: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  resend_count: number
  invited_by: { id: number; display_name: string } | null
}

/** Human copy for each skip reason, used in the result summary. */
export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  already_active: "Already has a working account",
  no_email: "No email address on record",
  inactive: "Record is deactivated",
  cooldown: "Invited moments ago",
  outstanding_invite: "Already has a live invitation",
  not_found: "Record no longer exists",
}

/**
 * Resolves 200 with a per-recipient summary even when individual sends fail.
 * Only a wholesale precondition failure (bad filter, over the server cap)
 * rejects.
 */
export async function sendAccountInvites(
  body: SendInvitesBody,
): Promise<SendInvitesResult> {
  return api<SendInvitesResult>("/admin/account-invites/send", {
    method: "POST",
    body,
  })
}

export async function previewAccountInvites(params: {
  subject_type: InviteSubjectType
  programme_id?: number
  admission_year_id?: number
  department_id?: number
  only_uninvited?: boolean
}): Promise<{ total: number; sample: InvitePreviewRow[] }> {
  const qs = new URLSearchParams()
  qs.set("subject_type", params.subject_type)
  if (params.programme_id !== undefined)
    qs.set("programme_id", String(params.programme_id))
  if (params.admission_year_id !== undefined)
    qs.set("admission_year_id", String(params.admission_year_id))
  if (params.department_id !== undefined)
    qs.set("department_id", String(params.department_id))
  if (params.only_uninvited !== undefined)
    qs.set("only_uninvited", String(params.only_uninvited))
  return api<{ total: number; sample: InvitePreviewRow[] }>(
    `/admin/account-invites/preview?${qs.toString()}`,
  )
}

export async function listAccountInvites(
  subject_type: InviteSubjectType,
  subject_id: number,
): Promise<InviteHistoryRow[]> {
  const qs = new URLSearchParams({
    subject_type,
    subject_id: String(subject_id),
  })
  return api<InviteHistoryRow[]>(`/admin/account-invites?${qs.toString()}`)
}

export async function revokeAccountInvite(
  subject_type: InviteSubjectType,
  subject_id: number,
): Promise<void> {
  return api<void>("/admin/account-invites/revoke", {
    method: "POST",
    body: { subject_type, subject_id },
  })
}
