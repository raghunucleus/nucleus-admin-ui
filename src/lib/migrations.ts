import { api } from "@/lib/api"

export type Migration = {
  id?: number
  name: string
  timestamp?: number | string
}

export type MigrationsStatus = {
  executed: Migration[]
  pending: Migration[]
  runEnabled: boolean
}

export type RunMigrationsResult = {
  executed: Migration[]
}

export type MigrationRunErrorDetails = {
  message?: string
  sql?: string
  driverError?: {
    code?: string
    detail?: string
    hint?: string
    position?: string
    severity?: string
    where?: string
    schema?: string
    table?: string
    column?: string
    constraint?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export async function fetchMigrationsStatus(): Promise<MigrationsStatus> {
  return api<MigrationsStatus>("/admin/migrations", { method: "GET" })
}

export async function runMigrations(): Promise<RunMigrationsResult> {
  return api<RunMigrationsResult>("/admin/migrations/run", { method: "POST" })
}
