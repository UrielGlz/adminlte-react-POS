/**
 * Centralized date/time formatting helpers (server-side).
 *
 * Strategy:
 *   mysql2 is configured with dateStrings: true, so all DATE/DATETIME/TIMESTAMP
 *   values arrive as raw strings like "2026-03-25 09:05:00".
 *   We parse the string manually — no Date objects, no timezone shift.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

/** "Mar 25, 09:05 AM" */
export const formatDateTime = (value) => {
  const p = parse(value)
  if (!p) return '-'
  if (p.hour === null) return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`
  const { h, ampm } = to12h(p.hour)
  return `${MONTHS[p.month - 1]} ${p.day}, ${h}:${String(p.min).padStart(2, '0')} ${ampm}`
}

/** "Mar 25, 2026" */
export const formatDateOnly = (value) => {
  const p = parse(value)
  if (!p) return '-'
  return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`
}

/** "03/25/2026 09:05 AM" */
export const formatDateTimeCompact = (value) => {
  const p = parse(value)
  if (!p) return '-'
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  if (p.hour === null) return `${mm}/${dd}/${p.year}`
  const { h, ampm } = to12h(p.hour)
  return `${mm}/${dd}/${p.year} ${h}:${String(p.min).padStart(2, '0')} ${ampm}`
}

/** "Generated:" timestamp for report headers — uses local server time. */
export const formatGeneratedTimestamp = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  const { h, ampm } = to12h(d.getHours())
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd}/${yyyy} ${h}:${min} ${ampm}`
}

/** Today as YYYY-MM-DD (local server time). */
export const todayDateString = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}