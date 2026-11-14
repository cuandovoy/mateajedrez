export interface TimeRange {
  open: string
  close: string
}

export interface DaySchedule {
  day: string
  /** Empty array means closed. */
  ranges: TimeRange[]
}

export interface HoursGroup {
  label: string
  value: string
}

const WEEKDAY: TimeRange[] = [
  { open: '9:30', close: '12:30' },
  { open: '15:30', close: '19:30' },
]

/** Store opening hours — single source of truth (Monday first). Edit here and every view updates. */
export const STORE_HOURS: DaySchedule[] = [
  { day: 'Lunes', ranges: WEEKDAY },
  { day: 'Martes', ranges: WEEKDAY },
  { day: 'Miércoles', ranges: WEEKDAY },
  { day: 'Jueves', ranges: WEEKDAY },
  { day: 'Viernes', ranges: WEEKDAY },
  { day: 'Sábado', ranges: [{ open: '9:30', close: '13:00' }] },
  { day: 'Domingo', ranges: [] },
]

/** "9:00 a 12:30 y 15:00 a 19:30 h", or "Cerrado" when there are no ranges. */
export function formatRanges(ranges: TimeRange[]): string {
  if (ranges.length === 0) return 'Cerrado'
  return `${ranges.map((r) => `${r.open} a ${r.close}`).join(' y ')} h`
}

function groupLabel(days: string[]): string {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
  if (days.length === 1) return days[0]
  if (days.length === 2) return `${days[0]} y ${lower(days[1])}`
  return `${days[0]} a ${lower(days[days.length - 1])}`
}

/** Collapses consecutive days that share the same schedule into display rows. */
export function groupStoreHours(schedule: DaySchedule[]): HoursGroup[] {
  const groups: { days: string[]; value: string }[] = []
  for (const { day, ranges } of schedule) {
    const value = formatRanges(ranges)
    const last = groups[groups.length - 1]
    if (last && last.value === value) last.days.push(day)
    else groups.push({ days: [day], value })
  }
  return groups.map((g) => ({ label: groupLabel(g.days), value: g.value }))
}
