// Small CSV writer for exports that open cleanly in Excel and Google Sheets.

/**
 * Quotes a cell when needed, and defuses spreadsheet formulas: a cell starting with = + - or @
 * (e.g. an item someone named "=HYPERLINK(...)") gets a leading apostrophe so it shows as text.
 */
function cell(value: string | number): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV text with a header row. Starts with a BOM so Excel reads ₹ and accents correctly. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
