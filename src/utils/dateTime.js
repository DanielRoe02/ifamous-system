export const MALAYSIA_TIME_ZONE = 'Asia/Kuala_Lumpur'

function parseDateTime(value) {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getTime())
  if (typeof value === 'number') return new Date(value)

  const text = String(value).trim()
  if (!text) return null

  // MySQL DATETIME values returned as raw strings have no zone. I-FAMOUS
  // stores server timestamps in UTC, so make that zone explicit before parsing.
  const mysqlDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
  const normalized = mysqlDateTime.test(text)
    ? `${text.replace(' ', 'T')}Z`
    : text

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function upperCaseDayPeriod(value) {
  return String(value).replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase())
}

export function formatMalaysiaDateTime(value, options = {}) {
  const date = parseDateTime(value)
  if (!date) return '-'

  const formatted = new Intl.DateTimeFormat('en-MY', {
    timeZone: MALAYSIA_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    ...(options.includeYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    ...(options.includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date)

  return upperCaseDayPeriod(formatted)
}

export function formatMalaysiaDate(value, options = {}) {
  if (!value) return '-'
  const text = String(value).trim()

  // Preserve calendar-only values without applying a timezone shift.
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dateOnlyMatch
    ? new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12))
    : parseDateTime(value)

  if (!date) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: MALAYSIA_TIME_ZONE,
    day: options.twoDigitDay ? '2-digit' : 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
