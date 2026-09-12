import * as React from "react"
import { toast } from "sonner"
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  UserCheck,
  Users,
  X,
} from "lucide-react"

import { EmployeePicker } from "@/components/employee-picker"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
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
import { ApiError } from "@/lib/api"
import {
  getApprovalAction,
  listApprovalActions,
  setApprovalApprovers,
  type ApprovalAction,
  type ApprovalApprover,
} from "@/lib/approval-approvers"
import type { Employee } from "@/lib/employees"
import { cn } from "@/lib/utils"

declare module "@tanstack/react-table" {
  // Allow columns to declare per-column horizontal alignment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    align?: "left" | "right" | "center"
  }
}

type Mode = { kind: "list" } | { kind: "edit"; action: ApprovalAction }

export function ApprovalApproversPage() {
  const [actions, setActions] = React.useState<ApprovalAction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>({ kind: "list" })

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const initialLoadDoneRef = React.useRef(false)
  const loadIdRef = React.useRef(0)

  const load = React.useCallback(async () => {
    // Monotonic call id — only the newest response commits state, so
    // StrictMode's double-invoke and rapid refreshes can't race.
    const callId = ++loadIdRef.current
    const isLatest = () => callId === loadIdRef.current

    if (initialLoadDoneRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const groups = await listApprovalActions()
      if (!isLatest()) return
      // The server already returns groups and actions in catalog order; flatten
      // for the table and let the Module column carry the grouping.
      setActions(groups.flatMap((g) => g.actions))
      setLoadFailed(false)
      initialLoadDoneRef.current = true
    } catch (err) {
      if (!isLatest()) return
      setLoadFailed(true)
      toast.error("Couldn't load approval actions", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      if (isLatest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleSaved = async (action: ApprovalAction, count: number) => {
    setMode({ kind: "list" })
    toast.success(
      count === 0
        ? `${action.label} now has no approvers.`
        : `${action.label} — ${count} approver${count === 1 ? "" : "s"} saved.`,
    )
    await load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader
        title="Assign approvers"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <Sheet
        open={mode.kind !== "list"}
        onOpenChange={(open) => {
          if (!open) setMode({ kind: "list" })
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          {mode.kind === "edit" && (
            <ApproversForm
              action={mode.action}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(count) => handleSaved(mode.action, count)}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="rounded-lg border bg-card text-card-foreground">
        <ActionsTable
          actions={actions}
          loading={loading}
          refreshing={refreshing}
          loadFailed={loadFailed}
          onRetry={() => void load()}
          formOpen={mode.kind !== "list"}
          pagination={pagination}
          onPaginationChange={setPagination}
          onManage={(a) => setMode({ kind: "edit", action: a })}
        />
      </div>
    </div>
  )
}

function ActionsTable({
  actions,
  loading,
  refreshing,
  loadFailed,
  onRetry,
  formOpen,
  pagination,
  onPaginationChange,
  onManage,
}: {
  actions: ApprovalAction[]
  loading: boolean
  refreshing: boolean
  loadFailed: boolean
  onRetry: () => void
  formOpen: boolean
  pagination: PaginationState
  onPaginationChange: React.Dispatch<React.SetStateAction<PaginationState>>
  onManage: (a: ApprovalAction) => void
}) {
  const columns = React.useMemo<ColumnDef<ApprovalAction>[]>(
    () => [
      {
        id: "action",
        header: "Action",
        accessorFn: (a) => a.label,
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="min-w-0">
              <div className="font-medium">{a.label}</div>
              {a.description && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {a.description}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: "module",
        header: "Module",
        accessorFn: (a) => a.group_label,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        id: "approvers",
        header: "Approvers",
        accessorFn: (a) => a.approver_count,
        cell: ({ row }) => {
          const a = row.original
          if (a.approver_count === 0) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Not assigned
              </span>
            )
          }
          const extra = a.approver_count - a.approver_preview.length
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Users className="size-3" />
                {a.approver_count}
              </span>
              <span className="text-xs text-muted-foreground">
                {a.approver_preview.join(", ")}
                {extra > 0 && ` +${extra} more`}
              </span>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" as const },
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManage(row.original)}
            disabled={formOpen}
          >
            <UserCheck />
            Manage
          </Button>
        ),
      },
    ],
    [formOpen, onManage],
  )

  const table = useReactTable({
    data: actions,
    columns,
    state: { pagination },
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const { pageIndex, pageSize } = pagination
  const total = actions.length
  const pageCount = table.getPageCount()
  const firstRow = total === 0 ? 0 : pageIndex * pageSize + 1
  const lastRow = Math.min(total, (pageIndex + 1) * pageSize)

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const align = header.column.columnDef.meta?.align
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      align === "right" && "text-right",
                      align === "center" && "text-center",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading || refreshing ? (
            Array.from({ length: 3 }).map((_, rowIdx) => (
              <TableRow key={`s-${rowIdx}`} className="hover:bg-transparent">
                {table.getAllLeafColumns().map((column) => {
                  const id = column.id
                  const widths: Record<string, string> = {
                    action: "w-56",
                    module: "w-32",
                    approvers: "w-40",
                    actions: "w-20",
                  }
                  const align = column.columnDef.meta?.align
                  return (
                    <TableCell
                      key={`s-${rowIdx}-${id}`}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      <Skeleton
                        className={cn(
                          "inline-block h-4 align-middle",
                          widths[id] ?? "w-24",
                          id === "approvers" && "rounded-full",
                        )}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="p-0"
              >
                {loadFailed ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load approval actions"
                    description="There was a problem reaching the server."
                    action={
                      <Button size="sm" onClick={onRetry}>
                        <RefreshCw />
                        Try again
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={UserCheck}
                    title="No approvable actions"
                    description="Actions are defined in the server's approval-actions catalog. Add one there and it will appear here."
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/20 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor="rows-per-page" className="text-muted-foreground">
              Number of Rows:
            </label>
            <select
              id="rows-per-page"
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 pr-7 text-xs font-medium shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="text-muted-foreground">
            Results:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {firstRow} – {lastRow}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-foreground">
              {total}
            </span>
          </div>
        </div>

        <Pagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          onFirst={() => table.setPageIndex(0)}
          onPrev={() => table.previousPage()}
          onNext={() => table.nextPage()}
          onLast={() => table.setPageIndex(Math.max(0, pageCount - 1))}
          onPage={(p) => table.setPageIndex(p - 1)}
        />
      </div>
    </div>
  )
}

function Pagination({
  pageIndex,
  pageCount,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPage,
}: {
  pageIndex: number
  pageCount: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onPage: (page: number) => void
}) {
  const current = pageCount === 0 ? 0 : pageIndex + 1
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1
  const items = getPageRange(current, pageCount)

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center gap-1"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onFirst}
        disabled={!canPrev}
        aria-label="First page"
      >
        <ChevronsLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>

      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            aria-hidden="true"
            className="px-1 text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === current ? "outline" : "ghost"}
            size="icon"
            className={cn(
              "size-8 text-xs font-medium tabular-nums",
              item === current
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onPage(item)}
            aria-label={`Page ${item}`}
            aria-current={item === current ? "page" : undefined}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onLast}
        disabled={!canNext}
        aria-label="Last page"
      >
        <ChevronsRight />
      </Button>
    </nav>
  )
}

function getPageRange(
  current: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const items: (number | "ellipsis")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) items.push("ellipsis")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < totalPages - 1) items.push("ellipsis")
  items.push(totalPages)
  return items
}

/**
 * Editor for one action's approver set.
 *
 * Hydrates from the server on open, then edits a local list of chips. Saving is
 * a single wholesale PUT of the id list — the same shape the profile-verifier
 * editor uses, so a removed approver disappears in one round trip.
 */
function ApproversForm({
  action,
  onCancel,
  onSaved,
}: {
  action: ApprovalAction
  onCancel: () => void
  onSaved: (count: number) => void
}) {
  const [selected, setSelected] = React.useState<ApprovalApprover[]>([])
  const [initialIds, setInitialIds] = React.useState<number[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const actionKey = action.key

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    void (async () => {
      try {
        const detail = await getApprovalAction(actionKey)
        if (cancelled) return
        setSelected(detail.approvers)
        setInitialIds(detail.approvers.map((a) => a.id))
      } catch (err) {
        if (cancelled) return
        setLoadFailed(true)
        toast.error("Couldn't load approvers", {
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [actionKey])

  const selectedIds = selected.map((a) => a.id)

  const add = (employee: Employee | null) => {
    if (!employee) return
    setSelected((prev) =>
      prev.some((a) => a.id === employee.id)
        ? prev
        : [
            ...prev,
            {
              id: employee.id,
              emp_code: employee.emp_code,
              emp_display_name: employee.emp_display_name,
              designation: employee.designation?.name ?? null,
              department: employee.department?.name ?? null,
            },
          ],
    )
  }

  const remove = (id: number) =>
    setSelected((prev) => prev.filter((a) => a.id !== id))

  // Dirty = the id set differs from what the server gave us, order-insensitive.
  const dirty =
    initialIds !== null &&
    (initialIds.length !== selectedIds.length ||
      selectedIds.some((id) => !initialIds.includes(id)))

  const save = async () => {
    setSaving(true)
    try {
      const saved = await setApprovalApprovers(actionKey, selectedIds)
      onSaved(saved.length)
    } catch (err) {
      toast.error("Couldn't save approvers", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>{action.label}</SheetTitle>
        <SheetDescription>
          {action.description ?? `Approvers for ${action.label}.`}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-40 rounded-md" />
              <Skeleton className="h-8 w-36 rounded-md" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ) : loadFailed ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load approvers"
            description="There was a problem reaching the server. Close and try again."
          />
        ) : (
          <>
            <div className="space-y-2">
              <Label>Approvers ({selected.length})</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {selected.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No approvers yet.
                  </span>
                ) : (
                  selected.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{a.emp_display_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {a.emp_code}
                      </span>
                      <button
                        type="button"
                        className="ml-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(a.id)}
                        aria-label={`Remove ${a.emp_display_name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approver-picker">Add an approver</Label>
              <EmployeePicker
                id="approver-picker"
                value={null}
                onChange={() => {}}
                onSelect={add}
                excludeIds={selectedIds}
                status="active"
                placeholder="Search employees…"
              />
            </div>

            {selected.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                With no approvers assigned, nobody can sign off on{" "}
                {action.label.toLowerCase()}.
              </p>
            )}

            <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Approvers apply to every {action.label.toLowerCase()} — there is
              no department or programme scoping yet. Any one of them can
              approve.
            </p>
          </>
        )}
      </SheetBody>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading || loadFailed || !dirty}
        >
          {saving ? "Saving…" : "Save approvers"}
        </Button>
      </SheetFooter>
    </div>
  )
}
