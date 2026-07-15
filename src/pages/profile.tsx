import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
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
import { changePassword, disableTotp, updateProfile } from "@/lib/auth"
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
          {section === "security" && <SecuritySection />}
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
              "group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-primary bg-accent text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">
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

const INDIA_DIAL_CODE = "91"
const INDIA_PREFIX_DISPLAY = "+91"

const profileSchema = z.object({
  first_name: z
    .string()
    .max(64, "Too long")
    .transform((v) => v.trim()),
  last_name: z
    .string()
    .max(64, "Too long")
    .transform((v) => v.trim()),
  email: z.email("Enter a valid email").max(255, "Too long"),
  mobile_local: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || v.length === 10, "Enter exactly 10 digits")
    .refine(
      (v) => v.length === 0 || /^[6-9]\d{9}$/.test(v),
      "Indian mobile must start with 6-9",
    ),
})

type ProfileValues = z.infer<typeof profileSchema>

function toLocal(stored: string | null | undefined): string {
  return (stored ?? "").replace(/\D/g, "").slice(0, 10)
}

function ProfileDetails() {
  const user = useAuthStore((s) => s.user)
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)

  const defaults: ProfileValues = React.useMemo(
    () => ({
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      email: user?.email ?? "",
      mobile_local: toLocal(user?.mobile_number),
    }),
    [user?.first_name, user?.last_name, user?.email, user?.mobile_number],
  )

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const watchedFirst = watch("first_name")
  const watchedLast = watch("last_name")
  const displayName =
    [watchedFirst, watchedLast]
      .map((p) => (p ?? "").trim())
      .filter(Boolean)
      .join(" ") || null
  const initialsSource = displayName ?? user?.username ?? user?.email ?? "?"
  const initials = initialsSource
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null)
    try {
      const hasMobile = values.mobile_local !== ""
      await updateProfile({
        first_name: values.first_name === "" ? null : values.first_name,
        last_name: values.last_name === "" ? null : values.last_name,
        country_code: hasMobile ? INDIA_DIAL_CODE : null,
        mobile_number: hasMobile ? values.mobile_local : null,
        email: values.email,
      })
      setFeedback({ kind: "success", message: "Profile updated." })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 409
            ? err.message || "That email is already in use."
            : err.message
          : "Could not update profile. Please try again."
      setFeedback({ kind: "error", message })
    }
  })

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials || "?"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {displayName ?? user?.username ?? "Unknown"}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
        </div>
      </div>

      <form noValidate onSubmit={onSubmit} className="mt-6 grid max-w-2xl gap-4">
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

        <div className="grid gap-4 hd:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">First name</Label>
            <Input
              id="first_name"
              autoComplete="given-name"
              aria-invalid={!!errors.first_name}
              {...register("first_name")}
            />
            {errors.first_name && (
              <p className="text-xs text-destructive">{errors.first_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              autoComplete="family-name"
              aria-invalid={!!errors.last_name}
              {...register("last_name")}
            />
            {errors.last_name && (
              <p className="text-xs text-destructive">{errors.last_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mobile_local">Mobile number</Label>
            <div
              className={cn(
                "flex h-9 w-full items-stretch rounded-md border border-input bg-background text-sm shadow-xs transition-[color,box-shadow] focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2 focus-within:ring-offset-background",
                errors.mobile_local && "border-destructive",
              )}
            >
              <span className="grid select-none place-items-center border-r border-input bg-muted px-3 text-muted-foreground">
                {INDIA_PREFIX_DISPLAY}
              </span>
              <input
                id="mobile_local"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9876543210"
                maxLength={10}
                aria-invalid={!!errors.mobile_local}
                className="w-full rounded-r-md bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                {...register("mobile_local", {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                    if (digits !== e.target.value) e.target.value = digits
                  },
                })}
              />
            </div>
            {errors.mobile_local && (
              <p className="text-xs text-destructive">{errors.mobile_local.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName ?? ""}
              readOnly
              disabled
              aria-describedby="display_name_hint"
            />
            <p id="display_name_hint" className="text-xs text-muted-foreground">
              Auto-generated from first and last name.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={user?.username ?? ""} readOnly disabled />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting || !isDirty}
            onClick={() => {
              reset(defaults)
              setFeedback(null)
            }}
          >
            Cancel
          </Button>
        </div>

        <dl className="mt-2 grid grid-cols-1 gap-y-3 hd:grid-cols-2 hd:gap-x-6">
          <DetailRow label="User ID" value={user?.id ?? "—"} mono />
          <DetailRow
            label="Created"
            value={user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}
          />
        </dl>
      </form>
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

const disable2faSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Too long"),
  code: z
    .string()
    .min(6, "Enter the 6-digit code or a recovery code")
    .max(16, "Too long")
    .transform((v) => v.trim()),
})

type Disable2faValues = z.infer<typeof disable2faSchema>

function SecuritySection() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const enabled = !!user?.totp_enabled_at

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Authenticator app (TOTP)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {enabled
              ? `Enabled on ${new Date(user!.totp_enabled_at!).toLocaleString()}.`
              : "Two-factor authentication is required for all admins."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            enabled
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>

      {enabled ? (
        <DisableTwoFactorForm />
      ) : (
        <Button onClick={() => navigate({ to: "/setup-2fa" })}>
          Set up two-factor authentication
        </Button>
      )}
    </div>
  )
}

function DisableTwoFactorForm() {
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Disable2faValues>({
    resolver: zodResolver(disable2faSchema),
    defaultValues: { password: "", code: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null)
    try {
      await disableTotp(values.password, values.code)
      reset({ password: "", code: "" })
      setFeedback({
        kind: "success",
        message: "Two-factor authentication disabled. Set it up again before signing out.",
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Password or verification code is incorrect."
            : err.message
          : "Could not disable two-factor authentication. Please try again."
      setFeedback({ kind: "error", message })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid max-w-md gap-4">
      <p className="text-xs text-muted-foreground">
        To disable, confirm with your password and a current 6-digit code (or a recovery code).
      </p>

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
        <Label htmlFor="disable-password">Current password</Label>
        <Input
          id="disable-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="disable-code">Verification or recovery code</Label>
        <Input
          id="disable-code"
          inputMode="text"
          autoComplete="one-time-code"
          aria-invalid={!!errors.code}
          {...register("code")}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting ? "Disabling…" : "Disable two-factor authentication"}
        </Button>
      </div>
    </form>
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
