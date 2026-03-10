export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines  = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  // \ufeff BOM ensures Excel opens as UTF-8 and treats date-like values as text (prevents ####)
  const blob   = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const link   = document.createElement('a')
  link.href    = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Downloads data as a proper CSV file.
 * Universally compatible — no security warnings in Excel or other spreadsheet apps.
 */
export function downloadExcel(filename: string, headers: string[], rows: string[][]): void {
  downloadCSV(filename, headers, rows)
}
