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
 * Downloads data as an Excel-compatible .xls file (HTML table format).
 * Dates and numbers stay as plain text — no Excel auto-conversion or "###" cells.
 */
export function downloadExcel(filename: string, headers: string[], rows: string[][]): void {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const th  = headers.map(h => `<th>${esc(h)}</th>`).join('')
  const trs = rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head>
<body><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body>
</html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = `${filename}.xls`
  link.click()
  URL.revokeObjectURL(url)
}
