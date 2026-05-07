import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Copy, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import { enableTotp, logout, setupTotp, type TotpSetupResponse } from "@/lib/auth"

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator"),
})

type CodeValues = z.infer<typeof codeSchema>

type Stage =
  | { kind: "loading" }
  | { kind: "scan"; setup: TotpSetupResponse }
  | { kind: "recovery"; codes: string[] }
  | { kind: "error"; message: string }

export function SetupTwoFactorPage() {
  const navigate = useNavigate()
  const [stage, setStage] = React.useState<Stage>({ kind: "loading" })
  const startedRef = React.useRef(false)

  React.useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void (async () => {
      try {
        const setup = await setupTotp()
        setStage({ kind: "scan", setup })
      } catch (err) {
        setStage({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Could not start setup. Please try again.",
        })
      }
    })()
  }, [])

  const handleSignOut = async () => {
    await logout()
    navigate({ to: "/login" })
  }

  return (
    <div className="grid min-h-full place-items-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Set up two-factor authentication
          </h1>
          <p className="text-sm text-muted-foreground">
            All admins are required to enable an authenticator app before continuing.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
          {stage.kind === "loading" && <SetupLoading />}
          {stage.kind === "error" && (
            <div className="space-y-3">
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {stage.message}
              </div>
              <Button
                onClick={() => {
                  startedRef.current = false
                  setStage({ kind: "loading" })
                }}
                className="w-full"
              >
                Try again
              </Button>
            </div>
          )}
          {stage.kind === "scan" && (
            <ScanAndVerify
              setup={stage.setup}
              onEnabled={(codes) => setStage({ kind: "recovery", codes })}
            />
          )}
          {stage.kind === "recovery" && (
            <RecoveryCodes
              codes={stage.codes}
              onContinue={() => navigate({ to: "/" })}
            />
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function SetupLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-60 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

function ScanAndVerify({
  setup,
  onEnabled,
}: {
  setup: TotpSetupResponse
  onEnabled: (codes: string[]) => void
}) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const { recoveryCodes } = await enableTotp(values.code)
      onEnabled(recoveryCodes)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "That code didn't match. Try the most recent one in your app."
            : err.message
          : "Something went wrong. Please try again."
      setServerError(message)
    }
  })

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Scan this QR code with Google Authenticator, 1Password, Authy, or any TOTP app.
        </p>
        <div className="grid place-items-center rounded-md border bg-background p-3">
          <img
            src={setup.qrDataUrl}
            alt="Scan with your authenticator app"
            className="h-48 w-48"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="totp-secret" className="text-xs text-muted-foreground">
            Or enter this secret manually
          </Label>
          <div className="flex gap-2">
            <Input
              id="totp-secret"
              value={setup.secret}
              readOnly
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void copySecret()}
              aria-label="Copy secret"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          aria-invalid={!!errors.code}
          {...register("code")}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Verifying…" : "Verify and enable"}
      </Button>
    </form>
  )
}

function RecoveryCodes({
  codes,
  onContinue,
}: {
  codes: string[]
  onContinue: () => void
}) {
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto grid size-9 place-items-center rounded-full bg-success/10 text-success">
          <Check className="size-4" />
        </div>
        <h2 className="text-base font-semibold">Save your recovery codes</h2>
        <p className="text-sm text-muted-foreground">
          Each code can be used once if you lose access to your authenticator app.
          We won't show them again.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void copyAll()}
      >
        {copied ? (
          <>
            <Check className="size-4" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-4" /> Copy all
          </>
        )}
      </Button>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have saved these codes somewhere secure.</span>
      </label>

      <Button
        type="button"
        className="w-full"
        disabled={!acknowledged}
        onClick={onContinue}
      >
        Continue to dashboard
      </Button>
    </div>
  )
}
