import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { login, loginWithGoogle, verifyTwoFactor } from "@/lib/auth"

const googleClientId = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID as
  | string
  | undefined

const credentialsSchema = z.object({
  identifier: z
    .string()
    .min(1, "Enter your email or username")
    .max(255, "Too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Too long"),
})

type CredentialsValues = z.infer<typeof credentialsSchema>

const codeSchema = z.object({
  code: z
    .string()
    .min(6, "Enter the code from your authenticator")
    .max(16, "Too long")
    .transform((v) => v.trim()),
})

type CodeValues = z.infer<typeof codeSchema>

type Step =
  | { kind: "credentials" }
  | { kind: "challenge"; challengeToken: string }

export function LoginPage() {
  const [step, setStep] = React.useState<Step>({ kind: "credentials" })

  return step.kind === "credentials" ? (
    <CredentialsStep onChallenge={(challengeToken) => setStep({ kind: "challenge", challengeToken })} />
  ) : (
    <ChallengeStep
      challengeToken={step.challengeToken}
      onCancel={() => setStep({ kind: "credentials" })}
    />
  )
}

function CredentialsStep({
  onChallenge,
}: {
  onChallenge: (challengeToken: string) => void
}) {
  const navigate = useNavigate()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { identifier: "", password: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await login(values.identifier, values.password)
      if (result.kind === "challenge") {
        onChallenge(result.challengeToken)
        return
      }
      navigate({ to: result.requiresTotpSetup ? "/setup-2fa" : "/" })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Invalid credentials"
          : "Something went wrong. Please try again."
      setServerError(message)
    }
  })

  const handleGoogleSuccess = async (cred: CredentialResponse) => {
    if (!cred.credential) {
      setServerError("Google sign-in did not return a credential")
      return
    }
    setServerError(null)
    setGoogleSubmitting(true)
    try {
      const result = await loginWithGoogle(cred.credential)
      if (result.kind === "challenge") {
        onChallenge(result.challengeToken)
        return
      }
      navigate({ to: result.requiresTotpSetup ? "/setup-2fa" : "/" })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? err.message || "This Google account cannot sign in here"
            : err.message
          : "Something went wrong. Please try again."
      setServerError(message)
    } finally {
      setGoogleSubmitting(false)
    }
  }

  const handleGoogleError = () => {
    setServerError("Google sign-in failed. Please try again.")
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-lg border bg-card p-6 text-card-foreground shadow-xs"
    >
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your admin email or username to continue.
        </p>
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
        <Label htmlFor="identifier">Email or username</Label>
        <Input
          id="identifier"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.identifier}
          {...register("identifier")}
        />
        {errors.identifier && (
          <p className="text-xs text-destructive">{errors.identifier.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className="pr-9"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-md"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || googleSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      {googleClientId && (
        <>
          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="bg-card relative px-2">or continue with</span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 -z-0 border-t"
            />
          </div>

          <div
            className="flex justify-center"
            aria-busy={googleSubmitting}
            aria-disabled={googleSubmitting || isSubmitting}
          >
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
        </>
      )}
    </form>
  )
}

function ChallengeStep({
  challengeToken,
  onCancel,
}: {
  challengeToken: string
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  React.useEffect(() => {
    setFocus("code")
  }, [setFocus])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await verifyTwoFactor(challengeToken, values.code)
      navigate({ to: "/" })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Invalid or expired code"
            : err.message
          : "Something went wrong. Please try again."
      setServerError(message)
    }
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-lg border bg-card p-6 text-card-foreground shadow-xs"
    >
      <div className="space-y-1.5 text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or a recovery code.
        </p>
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
        <Label htmlFor="code">Verification code</Label>
        <Input
          id="code"
          inputMode="text"
          autoComplete="one-time-code"
          aria-invalid={!!errors.code}
          placeholder="XXXXXX"
          {...register("code")}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </div>
    </form>
  )
}
