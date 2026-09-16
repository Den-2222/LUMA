import { useMemo, useState } from 'react'
import { dayNumber, money, todayISO } from '../lib/format'
import { haptic } from '../lib/telegram'
import type { Kind, Summary } from '../types'

/** Один ряд — одна серія за раз: змішувати доходи й витрати в одному стовпчику було б оманливо. */
export function DayBars({ summary }: { summary: Summary }) {
  const [kind, setKind] = useState<Kind>('expense')
  const [picked, setPicked] = useState<string | null>(null)

  const days = useMemo(() => {
    const [year, month] = summary.month.split('-').map(Number)
    const count = new Date(year, month, 0).getDate()
    const totals = new Map<string, number>()
    for (const row of summary.by_day) {
      if (row.kind === kind) totals.set(row.day, (totals.get(row.day) ?? 0) + row.total)
    }
    return Array.from({ length: count }, (_, index) => {
      const day = `${summary.month}-${String(index + 1).padStart(2, '0')}`
      return { day, total: totals.get(day) ?? 0 }
    })
  }, [summary, kind])

  const max = Math.max(...days.map((entry) => entry.total), 1)
  const selected = days.find((entry) => entry.day === picked)
  const today = todayISO()

  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {(['expense', 'income'] as Kind[]).map((option) => (
          <button
            key={option}
            className="chip"
            data-active={kind === option}
            onClick={() => {
              haptic.select()
              setKind(option)
              setPicked(null)
            }}
          >
            {option === 'expense' ? '➖ Витрати' : '➕ Доходи'}
          </button>
        ))}
      </div>

      <div className="bars">
        {days.map((entry) => (
          <div
            key={entry.day}
            className="bar-col"
            data-today={entry.day === today}
            onClick={() => {
              haptic.select()
              setPicked((current) => (current === entry.day ? null : entry.day))
            }}
          >
            <div
              className={`bar ${kind}`}
              style={{
                height: `${entry.total ? Math.max((entry.total / max) * 100, 3) : 0}%`,
                opacity: picked && picked !== entry.day ? 0.35 : 1,
              }}
            />
          </div>
        ))}
      </div>

      <div className="bars-axis">
        <span>1</span>
        <span>{Math.ceil(days.length / 2)}</span>
        <span>{days.length}</span>
      </div>
      {/* Підпис максимуму дає шкалу: без нього висота стовпчика ні про що не говорить */}
      <div className="bars-axis" style={{ justifyContent: 'flex-end' }}>
        <span>макс. за день — {money(max, summary.currency)}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, margin: '10px 0 0', minHeight: 18 }}>
        {selected
          ? `${dayNumber(selected.day)} число — ${money(selected.total, summary.currency)}`
          : 'Торкнись стовпчика, щоб побачити суму за день'}
      </p>
    </div>
  )
}
