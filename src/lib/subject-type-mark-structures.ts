import { api } from "@/lib/api"
import type { SubjectType } from "@/lib/subject-types"

export const MARK_RULE_KINDS = [
  "direct",
  "sum",
  "best_k_of_n",
  "rank_weighted",
] as const
export type MarkRuleKind = (typeof MARK_RULE_KINDS)[number]

export const MARK_RULE_LABELS: Record<MarkRuleKind, string> = {
  direct: "Direct (one mark)",
  sum: "Sum of inputs",
  best_k_of_n: "Best K of N",
  rank_weighted: "Rank-weighted",
}

export type MarkRuleInput = {
  code: string
  name?: string
  max_marks: number
}

export type MarkRule =
  | { kind: "direct" }
  | { kind: "sum"; inputs: MarkRuleInput[] }
  | { kind: "best_k_of_n"; k: number; inputs: MarkRuleInput[] }
  | { kind: "rank_weighted"; weights: number[]; inputs: MarkRuleInput[] }

export type MarkStructureL2Item = {
  code: string
  name?: string
  max_marks: number
  rule: MarkRule
}

export type MarkStructureL1Component = {
  code: string
  name?: string
  max_marks: number
  items: MarkStructureL2Item[]
}

export type SubjectTypeMarkStructure = {
  id: number
  regulation_id: number
  subject_type_id: number
  max_marks: number
  components: MarkStructureL1Component[]
  created_at: string
  updated_at: string
}

export type MarkStructureBySubjectType = {
  subject_type: SubjectType
  structure: SubjectTypeMarkStructure | null
}

export type SaveMarkStructureInput = {
  max_marks: number
  components: MarkStructureL1Component[]
}

export async function listRegulationMarkStructures(
  regulationId: number,
): Promise<MarkStructureBySubjectType[]> {
  return api<MarkStructureBySubjectType[]>(
    `/admin/regulations/${regulationId}/mark-structures`,
    { method: "GET" },
  )
}

export async function getMarkStructure(
  regulationId: number,
  subjectTypeId: number,
): Promise<SubjectTypeMarkStructure> {
  return api<SubjectTypeMarkStructure>(
    `/admin/regulations/${regulationId}/mark-structures/${subjectTypeId}`,
    { method: "GET" },
  )
}

export async function saveMarkStructure(
  regulationId: number,
  subjectTypeId: number,
  input: SaveMarkStructureInput,
): Promise<SubjectTypeMarkStructure> {
  return api<SubjectTypeMarkStructure>(
    `/admin/regulations/${regulationId}/mark-structures/${subjectTypeId}`,
    { method: "PUT", body: input },
  )
}

export async function deleteMarkStructure(
  regulationId: number,
  subjectTypeId: number,
): Promise<void> {
  await api<null>(
    `/admin/regulations/${regulationId}/mark-structures/${subjectTypeId}`,
    { method: "DELETE" },
  )
}
