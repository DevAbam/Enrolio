export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines  = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob   = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const link   = document.createElement('a')
  link.href    = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
