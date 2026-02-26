export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function isFutureDate(date: string): boolean {
  return new Date(date) > new Date()
}
