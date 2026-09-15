const SIGNS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€', PLN: 'zł', GBP: '£' }

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень']
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']

export const sign = (currency: string) => SIGNS[currency] ?? currency

/** Копійки -> «1 250,50 ₴». compact: великі суми як «45,0 тис». */
export function money(minor: number, currency = 'UAH', opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(minor)
  if (opts.compact && abs >= 10_000_00) {
    return `${(abs / 100_000).toFixed(abs >= 100_000_00 ? 0 : 1).replace('.', ',')} тис ${sign(currency)}`
  }
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  const grouped = whole.toLocaleString('uk-UA').replace(/ |,/g, ' ')
  const body = frac === 0 ? grouped : `${grouped},${String(frac).padStart(2, '0')}`
  return `${minor < 0 ? '−' : ''}${body} ${sign(currency)}`
}

export function monthTitle(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const name = MONTHS[m - 1]
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
  return year === new Date().getFullYear() ? capitalized : `${capitalized} ${year}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const index = year * 12 + (m - 1) + delta
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function todayISO(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function humanDay(iso: string): string {
  const diff = Math.round((Date.parse(todayISO()) - Date.parse(iso)) / 86_400_000)
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Вчора'
  const date = new Date(iso)
  return `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`
}

export function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10))
}
