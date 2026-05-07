import * as React from "react"
import { Link, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ChevronRight,
  KeyRound,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { changePassword } from "@/lib/auth"
import { useAuthStore } from "@/store/auth-store"
import type { ProfileSection } from "@/router"

type NavItem = {
  key: ProfileSection
  label: string
  description: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  {
    key: "profile",
    label: "Profile",
    description: "Your account details",
    icon: User,
  },
  {
    key: "password",
    label: "Change password",
    description: "Update your password",
    icon: KeyRound,
  },
  {
    key: "security",
    label: "Security",
    description: "Sessions & 2FA",
    icon: ShieldCheck,
  },
]

export function ProfilePage() {
  const search = useSearch({ strict: false }) as { section?: ProfileSection }
  const section: ProfileSection = search.section ?? "profile"

  const active = navItems.find((n) => n.key === section) ?? navItems[0]

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="size-4" /> Account
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your admin account and security preferences.
        </p>
      </div>

      <div className="grid gap-6 hd:grid-cols-[16rem_1fr]">
        <SideNav activeKey={section} />
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <header className="mb-5 flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <active.icon className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{active.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {active.description}
              </p>
            </div>
          </header>

          {section === "profile" && <ProfileDetails />}
          {section === "password" && <ChangePasswordForm />}
          {section === "security" && <SecurityPlaceholder />}
        </div>
      </div>
    </div>
  )
}

function SideNav({ activeKey }: { activeKey: ProfileSection }) {
  return (
    <nav className="flex flex-col gap-1 rounded-lg border bg-card p-2 text-card-foreground hd:self-start">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = item.key === activeKey
        return (
          <Link
            key={item.key}
            to="/profile"
            search={{ section: item.key }}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground/80">
                {item.description}
              </span>
            </span>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 transition-opacity",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50",
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}

function ProfileDetails() {
  const user = useAuthStore((s) => s.user)
  const initials = (user?.username ?? user?.email ?? "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {user?.username ?? "Unknown"}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-y-3 hd:grid-cols-2 hd:gap-x-6">
        <DetailRow label="User ID" value={user?.id ?? "—"} mono />
        <DetailRow
          label="Created"
          value={user?.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
        />
      </dl>
    </div>
  )
}

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Enter your current password").max(128, "Too long"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Too long"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.oldPassword !== d.newPassword, {
    message: "New password must differ from the old password",
    path: ["newPassword"],
  })

type PasswordValues = z.infer<typeof passwordSchema>

type Feedback = { kind: "success" | "error"; message: string }

function ChangePasswordForm() {
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null)
    try {
      await changePassword(values.oldPassword, values.newPassword)
      setFeedback({ kind: "success", message: "Password updated successfully." })
      reset({ oldPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Current password is incorrect."
            : err.message
          : "Could not change password. Please try again."
      setFeedback({ kind: "error", message })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid max-w-md gap-4">
      {feedback && (
        <div
          role="status"
          className={
            feedback.kind === "success"
              ? "rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="oldPassword">Current password</Label>
        <Input
          id="oldPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.oldPassword}
          {...register("oldPassword")}
        />
        {errors.oldPassword && (
          <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  )
}

function SecurityPlaceholder() {
  return (
    <p className="text-sm text-muted-foreground">
      Two-factor authentication, active sessions, and notification preferences are
      coming soon.
    </p>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono text-xs break-all" : "mt-0.5 text-sm"}>
        {value}
      </dd>
    </div>
  )
}
