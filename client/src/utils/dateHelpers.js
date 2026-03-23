/**
 * Centralized date/time formatting helpers.
 *
 * Strategy:
 *   The mysql2 driver is configured with timezone: '+00:00', so DB datetime
 *   values are passed through as-is into JS Date objects at UTC.
 *   All display formatters use timeZone: 'UTC' to render the exact value
 *   stored in the database — no browser timezone shift.
 */

/**
 * Full datetime: "Mar 23, 02:30 PM"
 * Use for tables, detail pages, modals — anywhere a datetime is shown.
 */
export const formatDateTime = (date) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

/**
 * Date only: "Mar 23, 2026"
 * Use for date-only fields (no time component).
 */
export const formatDateOnly = (date) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Compact datetime: "03/23/2026 02:30 PM"
 * Use for reports, exports, and dense layouts.
 */
export const formatDateTimeCompact = (date) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

/**
 * Today's date as YYYY-MM-DD for <input type="date"> default values.
 * Uses UTC to avoid date rollover issues near midnight.
 */
export const todayDateString = () => {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Date N days ago as YYYY-MM-DD.
 */
export const pastDateString = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}