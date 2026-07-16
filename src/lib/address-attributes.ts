import { api } from "@/lib/api"

// Country -> State -> District master data, all three consumed by the single
// Address attributes screen. They share the qs builder below and their types
// reference each other (State.country, District.state.country), so they live in
// one module rather than three cross-importing ones.

export type Country = {
  id: number
  name: string
  iso2: string | null
  iso3: string | null
  dial_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// The API hydrates `country` on every state and `state.country` on every
// district (eager relations), so the tables can show parent names without a
// second fetch.
export type State = {
  id: number
  country_id: number
  country: Country
  name: string
  lgd_code: string | null
  iso_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type District = {
  id: number
  state_id: number
  state: State
  name: string
  lgd_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StatusFilter = "active" | "inactive"
export type SortOrder = "asc" | "desc"

export type ListResult<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

type QueryValue = string | number | boolean | undefined

// Skips undefined, so callers can pass a params object straight through.
function qs(params: Record<string, QueryValue>): string {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue
    out.set(k, String(v))
  }
  const s = out.toString()
  return s ? `?${s}` : ""
}

/* -------------------------------------------------------------- countries */

export type CountriesSortField =
  | "name"
  | "iso2"
  | "iso3"
  | "status"
  | "created_at"
  | "updated_at"

export type ListCountriesParams = {
  page?: number
  pageSize?: number
  sortBy?: CountriesSortField
  sortOrder?: SortOrder
  nameSearch?: string
  iso2Search?: string
  status?: StatusFilter
}

export type CreateCountryInput = {
  name: string
  iso2?: string | null
  iso3?: string | null
  dial_code?: string | null
}

export type UpdateCountryInput = Partial<CreateCountryInput>

export async function listCountries(
  params: ListCountriesParams = {},
): Promise<ListResult<Country>> {
  return api<ListResult<Country>>(`/admin/countries${qs(params)}`, {
    method: "GET",
  })
}

export async function createCountry(
  input: CreateCountryInput,
): Promise<Country> {
  return api<Country>("/admin/countries", { method: "POST", body: input })
}

export async function updateCountry(
  id: number,
  patch: UpdateCountryInput,
): Promise<Country> {
  return api<Country>(`/admin/countries/${id}`, { method: "PATCH", body: patch })
}

export async function activateCountry(id: number): Promise<Country> {
  return api<Country>(`/admin/countries/${id}/activate`, { method: "POST" })
}

export async function deactivateCountry(id: number): Promise<Country> {
  return api<Country>(`/admin/countries/${id}/deactivate`, { method: "POST" })
}

/* ----------------------------------------------------------------- states */

export type StatesSortField =
  | "name"
  | "lgd_code"
  | "iso_code"
  | "country"
  | "status"
  | "created_at"
  | "updated_at"

export type ListStatesParams = {
  page?: number
  pageSize?: number
  sortBy?: StatesSortField
  sortOrder?: SortOrder
  countryId?: number
  nameSearch?: string
  lgdCodeSearch?: string
  isoCodeSearch?: string
  // The row's own is_active — what the management screen filters on.
  status?: StatusFilter
  // The whole state -> country chain. Use this, not `status`, when offering
  // states for downstream selection.
  effectiveActive?: boolean
}

export type CreateStateInput = {
  country_id: number
  name: string
  lgd_code?: string | null
  iso_code?: string | null
}

export type UpdateStateInput = Partial<CreateStateInput>

export async function listStates(
  params: ListStatesParams = {},
): Promise<ListResult<State>> {
  return api<ListResult<State>>(`/admin/states${qs(params)}`, { method: "GET" })
}

export async function createState(input: CreateStateInput): Promise<State> {
  return api<State>("/admin/states", { method: "POST", body: input })
}

export async function updateState(
  id: number,
  patch: UpdateStateInput,
): Promise<State> {
  return api<State>(`/admin/states/${id}`, { method: "PATCH", body: patch })
}

export async function activateState(id: number): Promise<State> {
  return api<State>(`/admin/states/${id}/activate`, { method: "POST" })
}

export async function deactivateState(id: number): Promise<State> {
  return api<State>(`/admin/states/${id}/deactivate`, { method: "POST" })
}

/* -------------------------------------------------------------- districts */

export type DistrictsSortField =
  | "name"
  | "lgd_code"
  | "state"
  | "country"
  | "status"
  | "created_at"
  | "updated_at"

export type ListDistrictsParams = {
  page?: number
  pageSize?: number
  sortBy?: DistrictsSortField
  sortOrder?: SortOrder
  // Filters through the state join, so "all districts in India" is valid
  // without picking a state.
  countryId?: number
  stateId?: number
  nameSearch?: string
  lgdCodeSearch?: string
  status?: StatusFilter
  effectiveActive?: boolean
}

export type CreateDistrictInput = {
  state_id: number
  name: string
  lgd_code?: string | null
}

export type UpdateDistrictInput = Partial<CreateDistrictInput>

export async function listDistricts(
  params: ListDistrictsParams = {},
): Promise<ListResult<District>> {
  return api<ListResult<District>>(`/admin/districts${qs(params)}`, {
    method: "GET",
  })
}

export async function createDistrict(
  input: CreateDistrictInput,
): Promise<District> {
  return api<District>("/admin/districts", { method: "POST", body: input })
}

export async function updateDistrict(
  id: number,
  patch: UpdateDistrictInput,
): Promise<District> {
  return api<District>(`/admin/districts/${id}`, {
    method: "PATCH",
    body: patch,
  })
}

export async function activateDistrict(id: number): Promise<District> {
  return api<District>(`/admin/districts/${id}/activate`, { method: "POST" })
}

export async function deactivateDistrict(id: number): Promise<District> {
  return api<District>(`/admin/districts/${id}/deactivate`, { method: "POST" })
}

/* ------------------------------------------------------------ shared bits */

// A row is only usable downstream when its whole ancestor chain is active.
// is_active is independent per level, so an active district can sit under a
// deactivated state — the management tables surface that with a badge instead
// of hiding the row.
export function stateEffectivelyActive(s: State): boolean {
  return s.is_active && s.country.is_active
}

export function districtEffectivelyActive(d: District): boolean {
  return d.is_active && d.state.is_active && d.state.country.is_active
}
