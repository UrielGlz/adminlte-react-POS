/**
 * Centralized date/time formatting helpers.
 *
 * Strategy:
 *   mysql2 is configured with dateStrings: true, so all DATE/DATETIME/TIMESTAMP
 *   values arrive as raw strings like "2026-03-25 09:05:00".
 *   We parse the string manually and format it for display — no Date objects,
 *   no timezone interpretation, no shift. What MySQL stores is what we show.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Parse a MySQL date(time) string into its components.
 * Accepts "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DD", or Date objects.
 * Returns null if unparseable.
 */
const parse = (value) => {
  if (!value) return null
  const s = String(value)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  return {
    year:  parseInt(m[1]),
    month: parseInt(m[2]),
    day:   parseInt(m[3]),
    hour:  m[4] !== undefined ? parseInt(m[4]) : null,
    min:   m[5] !== undefined ? parseInt(m[5]) : null,
    sec:   m[6] !== undefined ? parseInt(m[6]) : null,
  }
}

const to12h = (h24) => {
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return { h: String(h).padStart(2, '0'), ampm }
}

/**
 * Full datetime: "Mar 25, 09:05 AM"
 * Use for tables, detail pages, modals.
 */
export const formatDateTime = (value) => {
  const p = parse(value)
  if (!p) return '-'
  if (p.hour === null) return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`
  const { h, ampm } = to12h(p.hour)
  return `${MONTHS[p.month - 1]} ${p.day}, ${h}:${String(p.min).padStart(2, '0')} ${ampm}`
}

/**
 * Date only: "Mar 25, 2026"
 * Use for date-only fields.
 */
export const formatDateOnly = (value) => {
  const p = parse(value)
  if (!p) return '-'
  return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`
}

/**
 * Compact datetime: "03/25/2026 09:05 AM"
 * Use for reports, exports, dense layouts.
 */
export const formatDateTimeCompact = (value) => {
  const p = parse(value)
  if (!p) return '-'
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  if (p.hour === null) return `${mm}/${dd}/${p.year}`
  const { h, ampm } = to12h(p.hour)
  return `${mm}/${dd}/${p.year} ${h}:${String(p.min).padStart(2, '0')} ${ampm}`
}

/**
 * Today's date as YYYY-MM-DD for <input type="date"> default values.
 */
export const todayDateString = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Date N days ago as YYYY-MM-DD.
 */
export const pastDateString = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}