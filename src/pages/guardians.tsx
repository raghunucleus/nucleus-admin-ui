import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MonitorSmartphone,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react"

import {
  SignedInDevicesCard,
  type SignedInDevicesResult,
} from "@/components/signed-in-devices-card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { listStudents, type Student } from "@/lib/students"
import {
  GUARDIAN_RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  createGuardian,
  listGuardians,
  removeGuardian,
  sendGuardianOtp,
  setGuardianLoginPassword,
  updateGuardian,
  type GuardianContact,
  type GuardianRelationship,
} from "@/lib/guardians"
import { listGuardianSessions, revokeGuardianSession } from "@/lib/sessions"

const MOBILE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAGE_SIZE = 10

export function GuardiansPage() {
  const navigate = useNavigate()
  const [rows, setRows] = React.useState<GuardianContact[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [nameSearch, setNameSearch] = React.useState("")
  const [studentSearch, setStudentSearch] = React.useState("")
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const [formTarget, setFormTarget] = React.useState<
    GuardianContact | "create" | null
  >(null)
  const [passwordTarget, setPasswordTarget] =
    React.useState<GuardianContact | null>(null)
  const [deleteTarget, setDeleteTarget] =
    React.useState<GuardianContact | null>(null)
  const [devicesTarget, setDevicesTarget] =
    React.useState<GuardianContact | null>(null)

  const filtersRef = React.useRef({ nameSearch, studentSearch })
  filtersRef.current = { nameSearch, studentSearch }

  const load = React.useCallback(
    async (opts?: { page?: number }) => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const res = await listGuardians({
          page: opts?.page ?? page,
          pageSize: PAGE_SIZE,
          sortBy: "created_at",
          sortOrder: "desc",
          nameSearch: filtersRef.current.nameSearch.trim() || undefined,
          studentSearch: filtersRef.current.studentSearch.trim() || undefined,
        })
        setRows(res.rows)
        setTotal(res.total)
        setPageCount(res.pageCount)
      } catch {
        setLoadFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [page],
  )

  React.useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void load({ page: 1 })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 py-2">
      <PageHeader
        title="Guardians / Parents"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/guardians/bulk-upload" })}
            >
              <Upload />
              Bulk upload
            </Button>
            <Button size="sm" onClick={() => setFormTarget("create")}>
              <Plus />
              Add contact
            </Button>
          </>
        }
      />

      <form
        onSubmit={onSearchSubmit}
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-xs"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Name or mobile…"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Input
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Student roll…"
          className="h-9 w-44"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{total} total</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void load()}
            title="Refresh"
          >
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card text-card-foreground">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : loadFailed ? (
          <EmptyState
            icon={Users}
            title="Couldn't load guardians"
            description="There was a problem reaching the server."
            action={
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No guardian contacts yet"
            description="Add a contact, or bulk-upload father/mother/guardian details from a per-student sheet."
            action={
              <Button size="sm" onClick={() => setFormTarget("create")}>
                <Plus />
                Add contact
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Relationship</TableHead>
                <TableHead className="text-xs">Contact name</TableHead>
                <TableHead className="text-xs">Mobile</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="w-12 text-right text-xs" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.student_roll}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.student_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] capitalize">
                      {RELATIONSHIP_LABELS[r.relationship]}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="tabular-nums">{r.mobile_number}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setFormTarget(r)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPasswordTarget(r)}>
                          <KeyRound /> Set login password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={async () => {
                            setBusyId(r.id)
                            try {
                              await sendGuardianOtp(r.mobile_number)
                              toast.info(
                                "If a delivery channel is available, a code was sent.",
                              )
                            } catch (err) {
                              toast.error(
                                err instanceof ApiError
                                  ? err.message
                                  : "Couldn't send code",
                              )
                            } finally {
                              setBusyId(null)
                            }
                          }}
                        >
                          <Send /> Send login OTP
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDevicesTarget(r)}>
                          <MonitorSmartphone /> Signed-in devices
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeleteTarget(r)}
                          className="text-destructive data-[highlighted]:text-destructive"
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      )}

      {formTarget && (
        <GuardianFormSheet
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null)
            void load()
          }}
        />
      )}

      {passwordTarget && (
        <SetPasswordSheet
          contact={passwordTarget}
          onClose={() => setPasswordTarget(null)}
        />
      )}

      {devicesTarget && (
        <SignedInDevicesSheet
          contact={devicesTarget}
          onClose={() => setDevicesTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete guardian contact?"
        description={
          deleteTarget ? (
            <>
              This removes the {RELATIONSHIP_LABELS[deleteTarget.relationship]}{" "}
              contact for{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.student_roll}
              </span>
              . If this mobile is no longer attached to any student, its login
              sessions are revoked.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={busyId === deleteTarget?.id}
        onConfirm={async () => {
          if (!deleteTarget) return
          setBusyId(deleteTarget.id)
          try {
            await removeGuardian(deleteTarget.id)
            toast.success("Contact deleted")
            setDeleteTarget(null)
            void load()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Delete failed")
          } finally {
            setBusyId(null)
          }
        }}
      />
    </div>
  )
}

// ---------- Create / edit ----------

function GuardianFormSheet({
  target,
  onClose,
  onSaved,
}: {
  target: GuardianContact | "create"
  onClose: () => void
  onSaved: () => void
}) {
  const isCreate = target === "create"
  const existing = isCreate ? null : target

  const [relationship, setRelationship] = React.useState<GuardianRelationship>(
    existing?.relationship ?? "father",
  )
  const [name, setName] = React.useState(existing?.name ?? "")
  const [mobile, setMobile] = React.useState(existing?.mobile_number ?? "")
  const [email, setEmail] = React.useState(existing?.email ?? "")

  // Student picker (create only).
  const [rollQuery, setRollQuery] = React.useState("")
  const [matches, setMatches] = React.useState<Student[]>([])
  const [searching, setSearching] = React.useState(false)
  const [picked, setPicked] = React.useState<Student | null>(null)

  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const doSearch = async () => {
    const q = rollQuery.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await listStudents({ studentIdSearch: q, pageSize: 8 })
      setMatches(res.rows)
    } catch {
      toast.error("Couldn't search students")
    } finally {
      setSearching(false)
    }
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (isCreate && !picked) e.student = "Pick a student"
    if (!name.trim()) e.name = "Required"
    if (!MOBILE_REGEX.test(mobile.trim()))
      e.mobile = "10-digit Indian mobile (starts 6-9)"
    if (email.trim() && !EMAIL_REGEX.test(email.trim())) e.email = "Invalid email"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (isCreate) {
        await createGuardian({
          student_id: picked!.id,
          relationship,
          name: name.trim(),
          mobile_number: mobile.trim(),
          email: email.trim() || null,
        })
        toast.success("Contact added")
      } else {
        await updateGuardian(existing!.id, {
          relationship,
          name: name.trim(),
          mobile_number: mobile.trim(),
          email: email.trim() || null,
        })
        toast.success("Contact updated")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isCreate ? "Add guardian contact" : "Edit guardian contact"}
          </SheetTitle>
          <SheetDescription>
            {isCreate
              ? "Attach a parent/guardian to a student."
              : `For ${existing?.student_roll} · ${existing?.student_name}`}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit}>
          <SheetBody className="space-y-4">
            {isCreate ? (
              <Field label="Student" error={errors.student} required>
                {picked ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{picked.student_id}</span>{" "}
                      <span className="text-muted-foreground">
                        {picked.display_name}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPicked(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={rollQuery}
                        onChange={(e) => setRollQuery(e.target.value)}
                        placeholder="Roll number…"
                        className="h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void doSearch()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void doSearch()}
                        disabled={searching}
                      >
                        {searching ? "…" : "Find"}
                      </Button>
                    </div>
                    {matches.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setPicked(s)
                          setMatches([])
                        }}
                        className="flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm hover:bg-accent/40"
                      >
                        <span>
                          <span className="font-medium">{s.student_id}</span>{" "}
                          <span className="text-muted-foreground">
                            {s.display_name}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            ) : null}

            <Field label="Relationship" required>
              <select
                value={relationship}
                onChange={(e) =>
                  setRelationship(e.target.value as GuardianRelationship)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {GUARDIAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {RELATIONSHIP_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Contact name" error={errors.name} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Mobile number" error={errors.mobile} required>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="numeric"
              />
            </Field>

            <Field label="Email (optional)" error={errors.email}>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isCreate ? "Add" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Set password ----------

function SetPasswordSheet({
  contact,
  onClose,
}: {
  contact: GuardianContact
  onClose: () => void
}) {
  const [password, setPassword] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("At least 8 chars with a letter and a number")
      return
    }
    setSaving(true)
    try {
      await setGuardianLoginPassword(contact.mobile_number, password)
      toast.success(
        "Password set. The parent must change it on first login.",
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't set password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Set login password</SheetTitle>
          <SheetDescription>
            For mobile {contact.mobile_number}. Fallback for parents who can't
            receive an OTP; they'll change it on first sign-in.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit}>
          <SheetBody className="space-y-4">
            <Field label="Password" error={error ?? undefined} required>
              <Input
                type="text"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                autoComplete="off"
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Set password"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Signed-in devices ----------

/**
 * Parent logins are keyed by mobile number, not by contact row — so this lists
 * every device signed in with that number, whichever student(s) it covers.
 */
function SignedInDevicesSheet({
  contact,
  onClose,
}: {
  contact: GuardianContact
  onClose: () => void
}) {
  const mobile = contact.mobile_number
  const loadSessions = React.useCallback(
    async (): Promise<SignedInDevicesResult> => ({
      sessions: await listGuardianSessions(mobile),
    }),
    [mobile],
  )
  const revokeSession = React.useCallback(
    (sessionId: string) => revokeGuardianSession(mobile, sessionId),
    [mobile],
  )

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Signed-in devices</SheetTitle>
          <SheetDescription>
            Devices signed in to the parent app with mobile {mobile} (
            {contact.name}). The login is shared by every student this number
            is a contact for. Signing a device out takes effect immediately.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <SignedInDevicesCard
            variant="plain"
            load={loadSessions}
            revoke={revokeSession}
            noun="parent"
            subjectName={contact.name}
          />
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Field wrapper ----------

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
