import { api } from "@/lib/api"

/**
 * Approver assignment per approvable action.
 *
 * The action catalog is static on the server (`src/approval-approvers/
 * approval-actions.ts`) — this endpoint just reflects it back with each
 * action's current approver set, so there is no create/delete of actions here.
 */

export type ApprovalApprover = {
  id: number
  emp_code: string
  emp_display_name: string
  designation: string | null
  department: string | null
}

export type ApprovalAction = {
  key: string
  group_key: string
  group_label: string
  label: string
  description?: string
  order: number
  approver_count: number
  /** First few approver names, for the list cell. */
  approver_preview: string[]
}

export type ApprovalActionGroup = {
  key: string
  label: string
  order: number
  actions: ApprovalAction[]
}

export type ApprovalActionDetail = {
  action: {
    key: string
    group_key: string
    group_label: string
    label: string
    description?: string
    order: number
  }
  approvers: ApprovalApprover[]
}

export async function listApprovalActions(): Promise<ApprovalActionGroup[]> {
  return api<ApprovalActionGroup[]>("/admin/approval-approvers/actions", {
    method: "GET",
  })
}

export async function getApprovalAction(
  actionKey: string,
): Promise<ApprovalActionDetail> {
  return api<ApprovalActionDetail>(
    `/admin/approval-approvers/actions/${encodeURIComponent(actionKey)}`,
    { method: "GET" },
  )
}

/** Wholesale replace — an empty list clears every approver for the action. */
export async function setApprovalApprovers(
  actionKey: string,
  employeeIds: number[],
): Promise<ApprovalApprover[]> {
  return api<ApprovalApprover[]>(
    `/admin/approval-approvers/actions/${encodeURIComponent(actionKey)}`,
    { method: "PUT", body: { employee_ids: employeeIds } },
  )
}
