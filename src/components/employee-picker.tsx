import * as React from "react"

import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import {
  useEmployeeNames,
  useEmployeeSearch,
  type EmployeeSearchOptions,
} from "@/lib/employee-search"
import type { Employee } from "@/lib/employees"

export interface EmployeePickerProps extends EmployeeSearchOptions {
  value: number | null
  onChange: (value: number | null) => void
  /**
   * Fired alongside `onChange` with the full row, for callers that need more
   * than the id — e.g. a multi-select chip list that has to render a name for
   * an employee it never fetched itself.
   */
  onSelect?: (employee: Employee | null) => void
  /** Ids to hide from the list — e.g. ones the caller has already picked. */
  excludeIds?: number[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  clearLabel?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
}

/**
 * Employee combobox backed by server-side search.
 *
 * Anything the old "fetch the first 100 and filter in the browser" pickers
 * couldn't reach is reachable here — see {@link useEmployeeSearch}.
 */
export function EmployeePicker({
  value,
  onChange,
  onSelect,
  status,
  departmentId,
  excludeIds,
  placeholder = "Select employee…",
  searchPlaceholder = "Search by name or code…",
  emptyMessage = "No employees found",
  clearLabel,
  disabled,
  invalid,
  id,
  className,
}: EmployeePickerProps) {
  const [query, setQuery] = React.useState("")
  const { rows, loading } = useEmployeeSearch(query, { status, departmentId })

  // The selected row usually comes straight out of the current results, but a
  // value set before the first fetch — or narrowed away by a later search —
  // has to be resolved by id, or the trigger falls back to the placeholder.
  const selectedFromRows = rows.find((e) => e.id === value) ?? null
  const unresolved = value != null && !selectedFromRows ? [value] : []
  const named = useEmployeeNames(unresolved)
  const selectedEmployee =
    selectedFromRows ?? (value != null ? (named.get(value) ?? null) : null)

  const excluded = new Set(excludeIds ?? [])
  const options: ComboboxOption[] = rows
    .filter((e) => !excluded.has(e.id))
    .map(toOption)

  return (
    <Combobox
      id={id}
      className={className}
      value={value}
      options={options}
      selectedOption={selectedEmployee ? toOption(selectedEmployee) : undefined}
      onChange={(next) => {
        onChange(next)
        onSelect?.(
          next == null ? null : (rows.find((e) => e.id === next) ?? null),
        )
      }}
      onQueryChange={setQuery}
      loading={loading}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      clearLabel={clearLabel}
      disabled={disabled}
      invalid={invalid}
    />
  )
}

function toOption(e: Employee): ComboboxOption {
  return { value: e.id, label: e.emp_display_name, sublabel: e.emp_code }
}
