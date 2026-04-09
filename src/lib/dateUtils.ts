/** Returns a YYYY-MM-DD string for the given date in the organization's timezone */
export function toOrgDateKey(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** Returns the UTC offset string ("+HH:MM" / "-HH:MM") for use in Supabase timestamp filters */
export function orgTzOffset(date: Date, tz: string): string {
  const utcMs = date.getTime()
  const localMs = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(date)
      .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6'),
  ).getTime()
  const diffMin = Math.round((localMs - utcMs) / 60000)
  const sign = diffMin >= 0 ? '+' : '-'
  const abs = Math.abs(diffMin)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const m = String(abs % 60).padStart(2, '0')
  return `${sign}${h}:${m}`
}

/** Builds the start/end ISO strings for Supabase timestamp range filters */
export function buildDateRange(tz: string) {
  const now = new Date()
  const tzOffset = orgTzOffset(now, tz)
  const todayStr = toOrgDateKey(now, tz)
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number)

  const monthStartStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-01`

  const lastDayOfPrevMonth = new Date(todayYear, todayMonth - 1, 0).getDate()
  const prevMonthDay = Math.min(todayDay, lastDayOfPrevMonth)
  const prevMonthYear = todayMonth === 1 ? todayYear - 1 : todayYear
  const prevMonthNum = todayMonth === 1 ? 12 : todayMonth - 1
  const prevMonthStartStr = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-01`
  const prevMonthEndStr = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(prevMonthDay).padStart(2, '0')}`

  const startOf = (dateStr: string) => `${dateStr}T00:00:00${tzOffset}`
  const endOf = (dateStr: string) => `${dateStr}T23:59:59${tzOffset}`

  return {
    monthStart: startOf(monthStartStr),
    prevMonthStart: startOf(prevMonthStartStr),
    prevMonthEnd: endOf(prevMonthEndStr),
  }
}
