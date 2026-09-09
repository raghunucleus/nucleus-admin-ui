/**
 * SheetJS is ~400 KB minified and only the bulk-upload / enrollment screens
 * read spreadsheets. Load it on demand at the call site
 * (`const XLSX = await loadXlsx()`) instead of a static
 * `import * as XLSX from "xlsx"`, which would pull it into that page's chunk —
 * and, before route splitting, into the login screen.
 *
 * Writing styled workbooks still goes through `await import("exceljs")` at the
 * call site, for the same reason.
 */
export function loadXlsx() {
  return import("xlsx")
}
