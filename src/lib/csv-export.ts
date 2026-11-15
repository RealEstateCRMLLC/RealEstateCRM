/**
 * Client- & Server-Safe RFC-4180 CSV Builder (`src/lib/csv-export.ts`).
 *
 * Kept 100% free of `node:*` imports so both browser components
 * (`WorkflowStudio`, `LeadTableClient`) and Next.js server routes
 * (`/api/export`) share identical escaping and formula-injection guards.
 */

const FORMULA_TRIGGER_RE = /^(?:[=@\t\r]|[+-][A-Za-z(])/;

/**
 * Guards against spreadsheet formula injection (`=CMD()`, `@SUM()`, `+HYPERLINK()`, `-IMPORTXML()`)
 * while leaving E.164 phone numbers (`+15865550100`) and negative numbers (`-500.25`) untouched.
 */
export function sanitizeCsvValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const str =
    typeof raw === "object"
      ? raw instanceof Date
        ? raw.toISOString()
        : JSON.stringify(raw)
      : String(raw);

  if (FORMULA_TRIGGER_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escapes a single cell per RFC-4180 (doubles embedded `"` and quotes cells
 * containing `,`, `"`, `\r`, or `\n`).
 */
export function escapeCsvCell(raw: unknown): string {
  const clean = sanitizeCsvValue(raw);
  if (
    clean.includes(",") ||
    clean.includes('"') ||
    clean.includes("\n") ||
    clean.includes("\r")
  ) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

/**
 * Converts an array of flat records into an RFC-4180 CSV string (`\r\n` rows).
 * When `columns` is supplied, emits those exact header names even if `rows` is empty.
 */
export function objectsToCsv(
  rows: readonly Record<string, unknown>[],
  columns?: readonly string[],
): string {
  const headers =
    columns && columns.length > 0
      ? [...columns]
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  if (headers.length === 0) return "";

  const lines: string[] = [headers.map((h) => escapeCsvCell(h)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
