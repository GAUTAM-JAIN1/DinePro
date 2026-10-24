// Restaurant-local day handling (Bug #14).
//
// "Today" for dashboards, reports and the hourly chart is the restaurant's
// calendar day in the restaurant's own timezone. It used to be the server's
// local day (UTC on Render), which moved the day boundary to 05:30 IST and split
// evening service across two reports.

const DEFAULT_TIMEZONE = 'Asia/Kolkata'

function isValidTimezone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function resolveTimezone(timeZone) {
  return isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const read = (type) => Number(parts.find((p) => p.type === type).value)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' for an instant, as seen on the restaurant's clock. */
function dayKeyFor(date, timeZone = DEFAULT_TIMEZONE) {
  const d = date instanceof Date ? date : new Date(date)
  const p = zonedParts(d, resolveTimezone(timeZone))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Hour of day (0-23) for an instant on the restaurant's clock. */
function hourFor(date, timeZone = DEFAULT_TIMEZONE) {
  const d = date instanceof Date ? date : new Date(date)
  return zonedParts(d, resolveTimezone(timeZone)).hour
}

/** Offset of `timeZone` from UTC at this instant, in milliseconds. */
function offsetMs(instantMs, timeZone) {
  const whole = instantMs - (instantMs % 1000)
  const p = zonedParts(new Date(whole), timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole
}

/** Epoch ms of local midnight at the start of `dayKey` in `timeZone`. */
function startOfDayMs(dayKey, timeZone) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const asUtc = Date.UTC(y, m - 1, d)
  const first = asUtc - offsetMs(asUtc, timeZone)
  // One refinement pass handles zones whose offset changes on that day (DST).
  return asUtc - offsetMs(first, timeZone)
}

/**
 * Half-open ISO range [start, end) covering one restaurant day, so Firestore
 * range queries on ISO timestamp fields can use it directly.
 */
function dayBounds(dayKey, timeZone = DEFAULT_TIMEZONE) {
  const zone = resolveTimezone(timeZone)
  const [y, m, d] = dayKey.split('-').map(Number)
  const nextKey = dayKeyFor(new Date(Date.UTC(y, m - 1, d + 1)), 'UTC')
  return {
    start: new Date(startOfDayMs(dayKey, zone)).toISOString(),
    end: new Date(startOfDayMs(nextKey, zone)).toISOString(),
  }
}

module.exports = {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  resolveTimezone,
  dayKeyFor,
  hourFor,
  dayBounds,
}
