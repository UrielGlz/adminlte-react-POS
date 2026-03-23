/**
 * Centralized date/time formatting helpers (server-side).
 *
 * Strategy:
 *   The mysql2 driver uses timezone: '+00:00', so DB datetime values
 *   arrive as JS Date objects at UTC. All formatters use timeZone: 'UTC'
 *   to render the exact value stored in the database.
 */

/**
 * Full datetime: "Mar 23, 02:30 PM"
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
 * "Generated:" timestamp for report headers.
 */
export const formatGeneratedTimestamp = () => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())
}

/**
 * Today as YYYY-MM-DD (UTC).
 */
export const todayDateString = () => {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}