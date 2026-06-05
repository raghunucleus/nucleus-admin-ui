import * as React from "react"
import { Link, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  Maximize2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  activateAttendanceGroup,
  addAttendanceGroupStudents,
  createAttendanceGroup,
  deactivateAttendanceGroup,
  listAttendanceGroups,
  listEligibleStudents,
  removeAttendanceGroupStudent,
  updateAttendanceGroup,
  type AttendanceGroup,
} from "@/lib/attendance-groups"
import { listProgrammes, type Programme } from "@/lib/programmes"
import {
  listAdmissionYears,
  type AdmissionYear,
} from "@/lib/admission-years"
import { listEmployees, type Employee } from "@/lib/employees"
import {
  BLOOD_GROUPS,
  GENDERS,
  GENDER_LABELS,
  type BloodGroup,
  type Gender,
  type Student,
} from "@/lib/students"

// What's being dragged: a student, and the group they came from (null = the
// unassigned pool).
type DragState = { studentId: number; fromGroupId: number | null }

type DragProps = {
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

type FormMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; group: AttendanceGroup }

// Dedicated full-screen for a batch's attendance groups — a responsive board:
// a searchable, multi-selectable "Unassigned" pool above a wrapping grid of
// group cards. Groups belong to a programme × admission-year batch and carry
// across every semester of that batch.
export function ProgrammeAttendanceGroupsPage() {
  const search = useSearch({ strict: false }) as {
    programmeId?: number
    admissionYearId?: number
  }
  const { programmeId, admissionYearId } = search

  const [batch, setBatch] = React.useState<{
    programme: Programme
    year: AdmissionYear
  } | null>(null)
  const [shellLoading, setShellLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)

  const [students, setStudents] = React.useState<Student[]>([])
  const [groups, setGroups] = React.useState<AttendanceGroup[]>([])
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [listLoading, setListLoading] = React.useState(true)

  const [busyGroupIds, setBusyGroupIds] = React.useState<Set<number>>(new Set())
  const [formMode, setFormMode] = React.useState<FormMode>({ kind: "closed" })
  const [formBusy, setFormBusy] = React.useState(false)
  const [toggleTarget, setToggleTarget] =
    React.useState<AttendanceGroup | null>(null)
  const [toggling, setToggling] = React.useState(false)
  const [expandGroupId, setExpandGroupId] = React.useState<number | null>(null)
  const [detailMoving, setDetailMoving] = React.useState(false)

  // Pool search + multi-select for bulk assignment.
  const [poolSearch, setPoolSearch] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)

  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [dropKey, setDropKey] = React.useState<string | null>(null)
  const [dndBusy, setDndBusy] = React.useState(false)

  // Resolve the batch's programme + admission year for the header. Both come
  // from their list endpoints — this page is always reached from Programme
  // configuration, where an active programme and year were chosen.
  const loadShell = React.useCallback(async () => {
    if (programmeId === undefined || admissionYearId === undefined) {
      setShellLoading(false)
      setFailed(true)
      return
    }
    setShellLoading(true)
    setFailed(false)
    try {
      const [progs, years] = await Promise.all([
        listProgrammes({
          status: "active",
          pageSize: 100,
          sortBy: "name",
          sortOrder: "asc",
        }),
        listAdmissionYears({
          status: "active",
          pageSize: 100,
          sortBy: "year",
          sortOrder: "desc",
        }),
      ])
      const programme = progs.rows.find((p) => p.id === programmeId) ?? null
      const year = years.rows.find((y) => y.id === admissionYearId) ?? null
      if (!programme || !year) {
        setFailed(true)
        return
      }
      setBatch({ programme, year })
    } catch {
      setFailed(true)
    } finally {
      setShellLoading(false)
    }
  }, [programmeId, admissionYearId])

  React.useEffect(() => {
    void loadShell()
  }, [loadShell])

  // This batch's groups, plus the students relevant to it: the eligible
  // "unassigned" pool (students with no group) merged with the members already
  // in this batch's groups.
  const loadList = React.useCallback(async () => {
    if (programmeId === undefined || admissionYearId === undefined) {
      setListLoading(false)
      return
    }
    setListLoading(true)
    try {
      const [groupRows, eligible] = await Promise.all([
        listAttendanceGroups(programmeId, admissionYearId),
        listEligibleStudents(programmeId, admissionYearId),
      ])
      const byId = new Map<number, Student>()
      for (const s of eligible) byId.set(s.id, s)
      for (const g of groupRows)
        for (const m of g.members) byId.set(m.student_id, m.student)
      setGroups(groupRows)
      setStudents([...byId.values()])
    } catch (err) {
      toast.error("Couldn't load attendance groups", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setListLoading(false)
    }
  }, [programmeId, admissionYearId])

  React.useEffect(() => {
    void loadList()
  }, [loadList])

  // Active employees for the group-incharge dropdown. Non-fatal if it fails —
  // the form just shows an empty dropdown, and the user gets a toast on submit.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await listEmployees({
          status: "active",
          pageSize: 100,
          sortBy: "emp_display_name",
          sortOrder: "asc",
        })
        if (!cancelled) setEmployees(result.rows)
      } catch {
        // Ignore — dropdown stays empty.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshGroups = React.useCallback(async () => {
    if (programmeId === undefined || admissionYearId === undefined) return
    setGroups(await listAttendanceGroups(programmeId, admissionYearId))
  }, [programmeId, admissionYearId])

  const assignedIds = React.useMemo(() => {
    const s = new Set<number>()
    for (const g of groups) for (const m of g.members) s.add(m.student_id)
    return s
  }, [groups])
  const unassigned = React.useMemo(
    () => students.filter((s) => !assignedIds.has(s.id)),
    [students, assignedIds],
  )
  const unassignedIdSet = React.useMemo(
    () => new Set(unassigned.map((s) => s.id)),
    [unassigned],
  )
  // The group whose expand window is open (re-derived so it stays current
  // as members are moved).
  const expandGroup = React.useMemo(
    () => groups.find((g) => g.id === expandGroupId) ?? null,
    [groups, expandGroupId],
  )

  // Drop any selected ids that are no longer unassigned (assigned elsewhere
  // via drag, the per-card picker, etc.).
  React.useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const sid of prev) {
        if (unassignedIdSet.has(sid)) next.add(sid)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [unassignedIdSet])

  const filteredUnassigned = React.useMemo(() => {
    const q = poolSearch.trim().toLowerCase()
    if (!q) return unassigned
    return unassigned.filter(
      (s) =>
        s.display_name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q),
    )
  }, [unassigned, poolSearch])

  const selectedCount = React.useMemo(
    () => unassigned.reduce((n, s) => (selectedIds.has(s.id) ? n + 1 : n), 0),
    [unassigned, selectedIds],
  )

  const markBusy = (groupId: number, busy: boolean) => {
    setBusyGroupIds((s) => {
      const n = new Set(s)
      if (busy) n.add(groupId)
      else n.delete(groupId)
      return n
    })
  }

  const sortGroups = (rows: AttendanceGroup[]) =>
    [...rows].sort((a, b) => a.name.localeCompare(b.name))

  const handleSubmitForm = async (
    name: string,
    code: string,
    groupInchargeEmployeeIds: number[],
    description: string,
  ) => {
    if (programmeId === undefined || admissionYearId === undefined) return
    setFormBusy(true)
    try {
      if (formMode.kind === "create") {
        const created = await createAttendanceGroup({
          programme_id: programmeId,
          admission_year_id: admissionYearId,
          name,
          code,
          group_incharge_employee_ids: groupInchargeEmployeeIds,
          description,
        })
        setGroups((prev) => sortGroups([...prev, created]))
        toast.success(`Group "${created.name}" created.`)
      } else if (formMode.kind === "edit") {
        const updated = await updateAttendanceGroup(formMode.group.id, {
          name,
          code,
          group_incharge_employee_ids: groupInchargeEmployeeIds,
          description,
        })
        setGroups((prev) =>
          sortGroups(prev.map((g) => (g.id === updated.id ? updated : g))),
        )
        toast.success("Group updated.")
      }
      setFormMode({ kind: "closed" })
    } catch (err) {
      toast.error("Couldn't save group", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setFormBusy(false)
    }
  }

  const handleAddOne = async (groupId: number, studentId: number) => {
    markBusy(groupId, true)
    try {
      const updated = await addAttendanceGroupStudents(groupId, [studentId])
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    } catch (err) {
      toast.error("Couldn't add student", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      markBusy(groupId, false)
    }
  }

  const handleRemoveStudent = async (groupId: number, studentId: number) => {
    markBusy(groupId, true)
    try {
      const updated = await removeAttendanceGroupStudent(groupId, studentId)
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    } catch (err) {
      toast.error("Couldn't remove student", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      markBusy(groupId, false)
    }
  }

  // Deactivating a group with members would lose their assignment. Surface
  // that up-front instead of opening the confirm dialog (the server enforces
  // the rule too). Reactivation is always allowed.
  const requestToggleActive = (group: AttendanceGroup) => {
    if (group.is_active && group.members.length > 0) {
      toast.info("Can't deactivate this group yet", {
        description: `Move or remove its ${group.members.length} student${
          group.members.length === 1 ? "" : "s"
        } first.`,
      })
      return
    }
    setToggleTarget(group)
  }

  const handleConfirmToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const updated = toggleTarget.is_active
        ? await deactivateAttendanceGroup(toggleTarget.id)
        : await activateAttendanceGroup(toggleTarget.id)
      setGroups((prev) =>
        sortGroups(prev.map((g) => (g.id === updated.id ? updated : g))),
      )
      toast.success(
        `Group "${updated.name}" ${updated.is_active ? "activated" : "deactivated"}.`,
      )
      setToggleTarget(null)
    } catch (err) {
      toast.error("Couldn't update group status", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setToggling(false)
    }
  }

  // Move students out of the expanded group into another group. Both groups
  // change, so the whole list is refreshed afterwards.
  const handleMoveStudents = async (
    targetGroupId: number,
    studentIds: number[],
  ): Promise<boolean> => {
    setDetailMoving(true)
    try {
      const updated = await addAttendanceGroupStudents(
        targetGroupId,
        studentIds,
      )
      await refreshGroups()
      toast.success(
        `Moved ${studentIds.length} student${
          studentIds.length === 1 ? "" : "s"
        } to ${updated.name}.`,
      )
      return true
    } catch (err) {
      toast.error("Couldn't move students", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      return false
    } finally {
      setDetailMoving(false)
    }
  }

  // --- selection / bulk assign --------------------------------------------

  const toggleSelect = (studentId: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(studentId)) n.delete(studentId)
      else n.add(studentId)
      return n
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      for (const s of filteredUnassigned) n.add(s.id)
      return n
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkAssign = async (groupId: number) => {
    const ids = unassigned
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.id)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const updated = await addAttendanceGroupStudents(groupId, ids)
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      setSelectedIds(new Set())
      toast.success(
        `Assigned ${ids.length} student${ids.length === 1 ? "" : "s"} to ${
          updated.name
        }.`,
      )
    } catch (err) {
      toast.error("Couldn't assign students", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setBulkBusy(false)
    }
  }

  // --- drag and drop -------------------------------------------------------

  const dragPropsFor = (
    studentId: number,
    fromGroupId: number | null,
  ): DragProps => ({
    draggable: !dndBusy,
    onDragStart: (e) => {
      setDrag({ studentId, fromGroupId })
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", String(studentId))
    },
    onDragEnd: () => {
      setDrag(null)
      setDropKey(null)
    },
  })

  const handleDropOnGroup = async (groupId: number) => {
    const d = drag
    setDrag(null)
    setDropKey(null)
    if (!d || d.fromGroupId === groupId) return
    setDndBusy(true)
    try {
      await addAttendanceGroupStudents(groupId, [d.studentId])
      await refreshGroups()
    } catch (err) {
      toast.error("Couldn't move student", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setDndBusy(false)
    }
  }

  const handleDropOnUnassigned = async () => {
    const d = drag
    setDrag(null)
    setDropKey(null)
    if (!d || d.fromGroupId === null) return
    setDndBusy(true)
    try {
      await removeAttendanceGroupStudent(d.fromGroupId, d.studentId)
      await refreshGroups()
    } catch (err) {
      toast.error("Couldn't unassign student", {
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setDndBusy(false)
    }
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-1">
        <Link
          to="/masters/programme-configuration"
          search={{ programmeId, admissionYearId }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
          Programme configuration
        </Link>
      </div>

      {shellLoading ? (
        <BoardSkeleton />
      ) : failed || !batch ? (
        <div className="rounded-lg border bg-card text-card-foreground">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load batch"
            description="This programme & admission-year batch could not be found, or the page was opened without its programme context. Open it from Programme configuration."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/masters/programme-configuration"
                  search={{ programmeId, admissionYearId }}
                >
                  Back to configuration
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3 text-card-foreground shadow-xs">
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-base font-semibold tracking-tight">
                Attendance groups
              </h1>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {batch.programme.code}
                </span>
                <span className="opacity-40">·</span>
                <span className="truncate">{batch.programme.display_name}</span>
                <span className="opacity-40">·</span>
                <span className="tabular-nums">
                  {batch.year.display_year}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {!listLoading && students.length > 0 && (
                <div className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Grouped{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {assignedIds.size}/{students.length}
                  </span>
                </div>
              )}
              <Button size="sm" onClick={() => setFormMode({ kind: "create" })}>
                <Plus />
                New group
              </Button>
            </div>
          </header>

          {listLoading ? (
            <BoardSkeleton headerless />
          ) : (
            <div className="flex h-[calc(100vh_-_15rem)] min-h-[26rem] flex-col gap-3">
              <UnassignedPanel
                students={filteredUnassigned}
                totalCount={unassigned.length}
                search={poolSearch}
                onSearchChange={setPoolSearch}
                selectedIds={selectedIds}
                selectedCount={selectedCount}
                groups={groups}
                bulkBusy={bulkBusy}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAllFiltered}
                onClearSelection={clearSelection}
                onBulkAssign={handleBulkAssign}
                drag={drag}
                isDropTarget={dropKey === "unassigned"}
                onDragEnter={() => setDropKey("unassigned")}
                onDrop={() => void handleDropOnUnassigned()}
                dragPropsFor={dragPropsFor}
              />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {groups.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center rounded-lg border border-dashed bg-card px-6 text-center">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No attendance groups yet.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFormMode({ kind: "create" })}
                      >
                        <Plus />
                        New group
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {groups.map((g) => (
                      <GroupCard
                        key={g.id}
                        group={g}
                        unassigned={unassigned}
                        busy={busyGroupIds.has(g.id) || dndBusy}
                        drag={drag}
                        isDropTarget={dropKey === `group-${g.id}`}
                        onDragEnter={() => setDropKey(`group-${g.id}`)}
                        onDrop={() => void handleDropOnGroup(g.id)}
                        dragPropsFor={dragPropsFor}
                        onExpand={() => setExpandGroupId(g.id)}
                        onEdit={() => setFormMode({ kind: "edit", group: g })}
                        onToggleActive={() => requestToggleActive(g)}
                        onAdd={handleAddOne}
                        onRemoveStudent={handleRemoveStudent}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Sheet
        open={formMode.kind !== "closed"}
        onOpenChange={(o) => {
          if (!o && !formBusy) setFormMode({ kind: "closed" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          {formMode.kind !== "closed" && (
            <GroupForm
              mode={formMode.kind}
              initialName={
                formMode.kind === "edit" ? formMode.group.name : ""
              }
              initialCode={
                formMode.kind === "edit" ? formMode.group.code : ""
              }
              initialInchargeEmployeeIds={
                formMode.kind === "edit"
                  ? formMode.group.incharges.map((i) => i.employee_id)
                  : []
              }
              initialInchargeEmployees={
                formMode.kind === "edit"
                  ? formMode.group.incharges.map((i) => i.employee)
                  : []
              }
              initialDescription={
                formMode.kind === "edit"
                  ? (formMode.group.description ?? "")
                  : ""
              }
              employees={employees}
              submitting={formBusy}
              onSubmit={handleSubmitForm}
              onCancel={() => setFormMode({ kind: "closed" })}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={expandGroupId !== null}
        onOpenChange={(o) => {
          if (!o && !detailMoving) setExpandGroupId(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-5xl">
          {expandGroup && (
            <GroupDetailSheet
              group={expandGroup}
              groups={groups}
              moving={detailMoving}
              onMove={handleMoveStudents}
              onClose={() => setExpandGroupId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(o) => !o && !toggling && setToggleTarget(null)}
        title={
          toggleTarget?.is_active
            ? "Deactivate attendance group?"
            : "Activate attendance group?"
        }
        description={
          toggleTarget ? (
            <div>
              {toggleTarget.is_active
                ? "Existing members stay assigned, but new students can't be added until the group is reactivated."
                : "The group will accept new students again."}
              <div className="mt-2 font-medium text-foreground">
                {toggleTarget.name}
              </div>
            </div>
          ) : undefined
        }
        confirmLabel={toggleTarget?.is_active ? "Deactivate" : "Activate"}
        tone={toggleTarget?.is_active ? "destructive" : "success"}
        loading={toggling}
        onConfirm={handleConfirmToggle}
      />
    </div>
  )
}

function initials(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

// The unassigned pool — searchable, multi-selectable, and a drop target for
// taking a student out of a group.
function UnassignedPanel({
  students,
  totalCount,
  search,
  onSearchChange,
  selectedIds,
  selectedCount,
  groups,
  bulkBusy,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkAssign,
  drag,
  isDropTarget,
  onDragEnter,
  onDrop,
  dragPropsFor,
}: {
  students: Student[]
  totalCount: number
  search: string
  onSearchChange: (v: string) => void
  selectedIds: Set<number>
  selectedCount: number
  groups: AttendanceGroup[]
  bulkBusy: boolean
  onToggleSelect: (studentId: number) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onBulkAssign: (groupId: number) => void
  drag: DragState | null
  isDropTarget: boolean
  onDragEnter: () => void
  onDrop: () => void
  dragPropsFor: (studentId: number, fromGroupId: number | null) => DragProps
}) {
  const droppable = drag !== null && drag.fromGroupId !== null

  const groupOptions = React.useMemo<ComboboxOption[]>(
    () =>
      groups.map((g) => ({
        value: g.id,
        label: g.name,
        sublabel: `${g.members.length} student${
          g.members.length === 1 ? "" : "s"
        }`,
      })),
    [groups],
  )

  return (
    <section
      onDragOver={(e) => {
        if (droppable) {
          e.preventDefault()
          onDragEnter()
        }
      }}
      onDrop={(e) => {
        if (droppable) {
          e.preventDefault()
          onDrop()
        }
      }}
      className={cn(
        "flex shrink-0 flex-col rounded-lg border bg-muted/40 text-card-foreground transition-colors",
        droppable && !isDropTarget && "border-primary/30",
        isDropTarget && "border-primary ring-2 ring-primary/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">Unassigned</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {totalCount}
        </span>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or ID…"
            autoComplete="off"
            className="h-8 pl-8"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSelectAll}
          disabled={students.length === 0}
        >
          Select all{search.trim() ? " matching" : ""}
        </Button>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">
            <span className="tabular-nums">{selectedCount}</span> selected
          </span>
          <div className="w-56">
            <Combobox
              value={null}
              options={groupOptions}
              onChange={(v) => v != null && onBulkAssign(v)}
              placeholder={
                bulkBusy
                  ? "Assigning…"
                  : groups.length === 0
                    ? "Create a group first"
                    : "Assign selected to…"
              }
              searchPlaceholder="Search groups…"
              emptyMessage="No groups"
              disabled={bulkBusy || groups.length === 0}
            />
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={bulkBusy}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}

      <div className="max-h-44 overflow-y-auto p-2">
        {totalCount === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No students available to assign — everyone eligible is already in a
            group.
          </p>
        ) : students.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No unassigned students match “{search}”.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {students.map((s) => (
              <StudentChip
                key={s.id}
                student={s}
                selected={selectedIds.has(s.id)}
                onSelect={() => onToggleSelect(s.id)}
                dim={drag?.studentId === s.id}
                {...dragPropsFor(s.id, null)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// One attendance group as a fixed-height card in the responsive grid.
function GroupCard({
  group,
  unassigned,
  busy,
  drag,
  isDropTarget,
  onDragEnter,
  onDrop,
  dragPropsFor,
  onExpand,
  onEdit,
  onToggleActive,
  onAdd,
  onRemoveStudent,
}: {
  group: AttendanceGroup
  unassigned: Student[]
  busy: boolean
  drag: DragState | null
  isDropTarget: boolean
  onDragEnter: () => void
  onDrop: () => void
  dragPropsFor: (studentId: number, fromGroupId: number | null) => DragProps
  onExpand: () => void
  onEdit: () => void
  onToggleActive: () => void
  onAdd: (groupId: number, studentId: number) => void
  onRemoveStudent: (groupId: number, studentId: number) => void
}) {
  const droppable =
    group.is_active && drag !== null && drag.fromGroupId !== group.id
  const toggleLabel = group.is_active ? "Deactivate" : "Activate"

  return (
    <section
      onDragOver={(e) => {
        if (droppable) {
          e.preventDefault()
          onDragEnter()
        }
      }}
      onDrop={(e) => {
        if (droppable) {
          e.preventDefault()
          onDrop()
        }
      }}
      className={cn(
        "flex h-60 flex-col rounded-lg border bg-card text-card-foreground shadow-xs transition-colors",
        droppable && !isDropTarget && "border-primary/30",
        isDropTarget && "border-primary ring-2 ring-primary/40",
        !group.is_active && "border-dashed bg-muted/40",
      )}
    >
      <header className="shrink-0 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
            {group.code}
          </span>
          <h3
            className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
            title={group.name}
          >
            {group.name}
          </h3>
          {!group.is_active && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Inactive
            </span>
          )}
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            {group.members.length}
          </span>
          <button
            type="button"
            onClick={onExpand}
            disabled={busy}
            aria-label={`Expand ${group.name}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            aria-label={`Edit ${group.name}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            aria-label={`${toggleLabel} ${group.name}`}
            title={toggleLabel}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors disabled:opacity-40",
              group.is_active
                ? "hover:bg-destructive/10 hover:text-destructive"
                : "hover:bg-success/10 hover:text-success",
            )}
          >
            {group.is_active ? (
              <PowerOff className="size-3.5" />
            ) : (
              <Power className="size-3.5" />
            )}
          </button>
        </div>
        {group.incharges.length > 0 && (
          <InchargeList incharges={group.incharges} />
        )}
        {group.description && (
          <p
            className="mt-0.5 truncate text-[11px] text-muted-foreground"
            title={group.description}
          >
            {group.description}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {group.members.length === 0 ? (
          <div
            className={cn(
              "flex h-full min-h-20 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs transition-colors",
              droppable
                ? "border-primary/40 bg-primary/[0.04] font-medium text-primary"
                : "border-input text-muted-foreground",
            )}
          >
            {droppable ? "Drop here" : "Drag students in, or use the picker"}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {group.members.map((m) => (
              <StudentChip
                key={m.id}
                student={m.student}
                onRemove={() => onRemoveStudent(group.id, m.student_id)}
                disabled={busy}
                dim={drag?.studentId === m.student_id}
                {...dragPropsFor(m.student_id, group.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t p-2">
        <AddStudentCombobox
          students={unassigned}
          disabled={busy || !group.is_active}
          placeholderOverride={
            !group.is_active ? "Group inactive" : undefined
          }
          onAdd={(sid) => onAdd(group.id, sid)}
        />
      </div>
    </section>
  )
}

// Compact, draggable pill for one student. Shows the student ID since names
// can repeat. Click-to-select when `onSelect` is supplied.
function StudentChip({
  student,
  onRemove,
  onSelect,
  selected,
  disabled,
  draggable,
  onDragStart,
  onDragEnd,
  dim,
}: {
  student: Student
  onRemove?: () => void
  onSelect?: () => void
  selected?: boolean
  disabled?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  dim?: boolean
}) {
  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-1.5 text-xs shadow-xs transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-input bg-background",
        onSelect && "cursor-pointer select-none",
        draggable && !onSelect && "cursor-grab active:cursor-grabbing",
        dim && "opacity-40",
      )}
      title={`${student.display_name} · ${student.student_id}`}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        {selected ? (
          <Check className="size-3" />
        ) : (
          initials(student.display_name)
        )}
      </span>
      <span className="truncate font-medium">{student.display_name}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {student.student_id}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${student.display_name}`}
          className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

// Single-pick combobox in a group card's footer — picking a student adds
// them to that group straight away.
function AddStudentCombobox({
  students,
  disabled,
  placeholderOverride,
  onAdd,
}: {
  students: Student[]
  disabled?: boolean
  placeholderOverride?: string
  onAdd: (studentId: number) => void
}) {
  const options = React.useMemo<ComboboxOption[]>(
    () =>
      students.map((s) => ({
        value: s.id,
        label: s.display_name,
        sublabel: s.student_id,
      })),
    [students],
  )

  return (
    <Combobox
      value={null}
      options={options}
      onChange={(v) => v != null && onAdd(v)}
      placeholder={
        placeholderOverride ??
        (students.length === 0 ? "No unassigned students" : "Add a student…")
      }
      searchPlaceholder="Search name or ID…"
      emptyMessage={
        students.length === 0 ? "No unassigned students" : "No matches"
      }
      disabled={disabled || students.length === 0}
    />
  )
}

// Group in-charges in the card header: the first couple inline, the rest
// collapsed behind a "+N" pill that opens the complete list in a dropdown.
function InchargeList({
  incharges,
}: {
  incharges: AttendanceGroup["incharges"]
}) {
  const MAX_INLINE = 2
  const shown = incharges.slice(0, MAX_INLINE)
  const overflow = incharges.length - shown.length

  return (
    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground/80">
        In-charge{incharges.length > 1 ? "s" : ""}:
      </span>
      <span className="min-w-0 truncate">
        {shown
          .map(
            (i) => `${i.employee.emp_display_name} (${i.employee.emp_code})`,
          )
          .join(", ")}
      </span>
      {overflow > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-full border bg-muted/50 px-1.5 py-px text-[10px] font-medium text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label={`Show all ${incharges.length} in-charges`}
            >
              +{overflow}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-64 overflow-y-auto"
          >
            <DropdownMenuLabel>
              In-charges ({incharges.length})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {incharges.map((i) => (
              <DropdownMenuItem
                key={i.id}
                onSelect={(e) => e.preventDefault()}
                className="flex-col items-start gap-0 !cursor-default"
              >
                <span className="text-sm text-foreground">
                  {i.employee.emp_display_name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {i.employee.emp_code}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// Create / edit form for an attendance group.
function GroupForm({
  mode,
  initialName,
  initialCode,
  initialInchargeEmployeeIds,
  initialInchargeEmployees,
  initialDescription,
  employees,
  submitting,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit"
  initialName: string
  initialCode: string
  initialInchargeEmployeeIds: number[]
  initialInchargeEmployees: Pick<
    Employee,
    "id" | "emp_code" | "emp_display_name"
  >[]
  initialDescription: string
  employees: Employee[]
  submitting: boolean
  onSubmit: (
    name: string,
    code: string,
    groupInchargeEmployeeIds: number[],
    description: string,
  ) => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState(initialName)
  const [code, setCode] = React.useState(initialCode)
  const [inchargeIds, setInchargeIds] = React.useState<number[]>(
    initialInchargeEmployeeIds,
  )
  const [description, setDescription] = React.useState(initialDescription)
  const valid =
    name.trim().length > 0 && code.trim().length > 0 && inchargeIds.length > 0

  // Build the picker options. If editing and a current in-charge isn't in the
  // active-employee list (e.g. they've been deactivated since), surface them as
  // a synthetic option so they stay selectable/visible. Already-selected
  // in-charges are filtered out of the add-picker.
  const inchargeOptions = React.useMemo<ComboboxOption[]>(() => {
    const base: ComboboxOption[] = employees.map((e) => ({
      value: e.id,
      label: e.emp_display_name,
      sublabel: e.emp_code,
    }))
    for (const cur of initialInchargeEmployees) {
      if (!employees.some((e) => e.id === cur.id)) {
        base.unshift({
          value: cur.id,
          label: cur.emp_display_name,
          sublabel: `${cur.emp_code} · current`,
        })
      }
    }
    return base
  }, [employees, initialInchargeEmployees])

  // Resolve an employee id to a display label for the selected-chip list.
  const labelForId = React.useCallback(
    (id: number) =>
      inchargeOptions.find((o) => o.value === id)?.label ?? `#${id}`,
    [inchargeOptions],
  )

  const addPickerOptions = React.useMemo(
    () => inchargeOptions.filter((o) => !inchargeIds.includes(o.value)),
    [inchargeOptions, inchargeIds],
  )

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (valid)
          onSubmit(name.trim(), code.trim(), inchargeIds, description.trim())
      }}
      className="flex h-full flex-col"
    >
      <SheetHeader>
        <SheetTitle>
          {mode === "create" ? "New attendance group" : "Edit group"}
        </SheetTitle>
        <SheetDescription>
          Students are dragged into groups; each group later follows its own
          timetable.
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="grp-name">Name</Label>
            <Input
              id="grp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              autoComplete="off"
              autoFocus
              placeholder="e.g. Group A"
            />
          </div>
          <div className="space-y-1.5 sm:w-32">
            <Label htmlFor="grp-code">Code</Label>
            <Input
              id="grp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={32}
              autoComplete="off"
              placeholder="e.g. A"
              className="font-mono uppercase"
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Code must be unique within this programme & admission year.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="grp-incharge">Group in-charges</Label>
          {inchargeIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inchargeIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
                >
                  <span className="truncate">{labelForId(id)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setInchargeIds((ids) => ids.filter((x) => x !== id))
                    }
                    className="grid size-4 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${labelForId(id)}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Combobox
            id="grp-incharge"
            value={null}
            options={addPickerOptions}
            onChange={(v) =>
              v != null &&
              setInchargeIds((ids) =>
                ids.includes(v) ? ids : [...ids, v],
              )
            }
            placeholder={
              inchargeOptions.length === 0
                ? "Loading employees…"
                : addPickerOptions.length === 0
                  ? "All employees added"
                  : "Add an in-charge…"
            }
            searchPlaceholder="Search by name or emp code…"
            emptyMessage="No employees match"
            disabled={
              inchargeOptions.length === 0 || addPickerOptions.length === 0
            }
          />
          <p className="text-xs text-muted-foreground">
            The employees responsible for this group. Add at least one.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grp-desc">
            Description{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="grp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={256}
            autoComplete="off"
            placeholder="e.g. Morning lab batch"
          />
          <p className="text-xs text-muted-foreground">
            A short note to tell groups apart.
          </p>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !valid}>
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Create group"
              : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}

type SortKey =
  | "student_id"
  | "display_name"
  | "gender"
  | "dob"
  | "blood_group"
  | "email"

function sortValue(s: Student, key: SortKey): string {
  switch (key) {
    case "student_id":
      return s.student_id.toLowerCase()
    case "display_name":
      return s.display_name.toLowerCase()
    case "gender":
      return s.gender
    case "dob":
      return s.dob
    case "blood_group":
      return s.blood_group ?? ""
    case "email":
      return s.email.toLowerCase()
  }
}

// Expanded view of one group — its students in a searchable, sortable,
// filterable table, with multi-select move into another group.
function GroupDetailSheet({
  group,
  groups,
  moving,
  onMove,
  onClose,
}: {
  group: AttendanceGroup
  groups: AttendanceGroup[]
  moving: boolean
  onMove: (targetGroupId: number, studentIds: number[]) => Promise<boolean>
  onClose: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [genderFilter, setGenderFilter] = React.useState<"" | Gender>("")
  const [bloodFilter, setBloodFilter] = React.useState<"" | BloodGroup>("")
  const [sortKey, setSortKey] = React.useState<SortKey>("student_id")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  const roster = React.useMemo(
    () => group.members.map((m) => m.student),
    [group.members],
  )

  // Drop selections that are no longer in the group (e.g. moved out).
  React.useEffect(() => {
    const ids = new Set(roster.map((s) => s.id))
    setSelected((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const x of prev) {
        if (ids.has(x)) next.add(x)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [roster])

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    let r = roster
    if (q) {
      r = r.filter(
        (s) =>
          s.display_name.toLowerCase().includes(q) ||
          s.student_id.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.mobile_number.includes(q),
      )
    }
    if (genderFilter) r = r.filter((s) => s.gender === genderFilter)
    if (bloodFilter) r = r.filter((s) => s.blood_group === bloodFilter)
    const dir = sortDir === "asc" ? 1 : -1
    return [...r].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [roster, search, genderFilter, bloodFilter, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(k)
      setSortDir("asc")
    }
  }

  const allShownSelected =
    rows.length > 0 && rows.every((s) => selected.has(s.id))
  const someShownSelected =
    rows.some((s) => selected.has(s.id)) && !allShownSelected

  const toggleAll = () => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (allShownSelected) for (const s of rows) n.delete(s.id)
      else for (const s of rows) n.add(s.id)
      return n
    })
  }
  const toggleRow = (sid: number) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(sid)) n.delete(sid)
      else n.add(sid)
      return n
    })
  }

  const otherGroups = groups.filter((g) => g.id !== group.id)
  const moveOptions = React.useMemo<ComboboxOption[]>(
    () =>
      otherGroups.map((g) => ({
        value: g.id,
        label: g.name,
        sublabel: `${g.members.length} student${
          g.members.length === 1 ? "" : "s"
        }`,
      })),
    [otherGroups],
  )

  const handleMove = async (targetGroupId: number) => {
    const ids = [...selected]
    if (ids.length === 0) return
    const ok = await onMove(targetGroupId, ids)
    if (ok) setSelected(new Set())
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>{group.name}</SheetTitle>
        <SheetDescription>
          {group.members.length} student
          {group.members.length === 1 ? "" : "s"}
          {group.description ? ` · ${group.description}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, email…"
            autoComplete="off"
            className="h-8 pl-8"
          />
        </div>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value as "" | Gender)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <option value="">All genders</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {GENDER_LABELS[g]}
            </option>
          ))}
        </select>
        <select
          value={bloodFilter}
          onChange={(e) => setBloodFilter(e.target.value as "" | BloodGroup)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium tabular-nums">
              {selected.size} selected
            </span>
            <div className="w-52">
              <Combobox
                value={null}
                options={moveOptions}
                onChange={(v) => v != null && void handleMove(v)}
                placeholder={
                  moving
                    ? "Moving…"
                    : otherGroups.length === 0
                      ? "No other groups"
                      : "Move to group…"
                }
                searchPlaceholder="Search groups…"
                emptyMessage="No groups"
                disabled={moving || otherGroups.length === 0}
              />
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Table containerClassName="h-full overflow-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="size-4 rounded border-input accent-primary"
                  checked={allShownSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someShownSelected
                  }}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                />
              </TableHead>
              <SortHead
                label="Student ID"
                sortKey="student_id"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHead
                label="Name"
                sortKey="display_name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHead
                label="Gender"
                sortKey="gender"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHead
                label="Date of birth"
                sortKey="dob"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHead
                label="Blood"
                sortKey="blood_group"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <TableHead>ABC ID</TableHead>
              <TableHead>Mobile</TableHead>
              <SortHead
                label="Email"
                sortKey="email"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {group.members.length === 0
                    ? "This group has no students yet."
                    : "No students match the search or filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => {
                const sel = selected.has(s.id)
                return (
                  <TableRow
                    key={s.id}
                    data-state={sel ? "selected" : undefined}
                  >
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.display_name}`}
                        className="size-4 rounded border-input accent-primary"
                        checked={sel}
                        onChange={() => toggleRow(s.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.student_id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.display_name}
                    </TableCell>
                    <TableCell>{GENDER_LABELS[s.gender]}</TableCell>
                    <TableCell className="tabular-nums">{s.dob}</TableCell>
                    <TableCell>{s.blood_group ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.abc_id ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.mobile_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.email}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <SheetFooter className="justify-between">
        <span className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground tabular-nums">
            {rows.length}
          </span>{" "}
          of {group.members.length}
        </span>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>
    </div>
  )
}

// A sortable column header inside the group detail table.
function SortHead({
  label,
  sortKey: key,
  activeKey,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const active = activeKey === key
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(key)}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

function BoardSkeleton({ headerless }: { headerless?: boolean }) {
  return (
    <>
      {!headerless && (
        <div className="flex items-center justify-between rounded-lg border bg-card px-5 py-3 shadow-xs">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3.5 w-56" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      )}
      <div className="flex h-[calc(100vh_-_15rem)] min-h-[26rem] flex-col gap-3">
        <div className="shrink-0 rounded-lg border bg-card p-3 shadow-xs">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2.5 h-7 w-full rounded-full" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  )
}
