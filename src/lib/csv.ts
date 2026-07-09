function escapeCsv(val: string | number): string {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a BOM-prefixed CSV string so Excel opens UTF-8 content (৳, non-Latin names) correctly. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return "﻿" + csv;
}

/** Trigger a browser download of a CSV string built by `toCsv`. */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
