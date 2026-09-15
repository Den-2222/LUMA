import { useMemo, useState } from 'react'
import { money } from '../lib/format'
import { haptic } from '../lib/telegram'
import type { CategoryTotal } from '../types'

const MAX_SLICES = 7 // 8-й слот резервуємо під «Інше» — кольори ніколи не повторюються
const SIZE = 200
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3 // px розриву між секторами, щоб сусідні кольори не зливались

interface Slice {
  key: string
  name: string
  emoji: string
  total: number
  color: string
}

export function Donut({ items, total, currency }: { items: CategoryTotal[]; total: number; currency: string }) {
  const [selected, setSelected] = useState<string | null>(null)

  const slices = useMemo<Slice[]>(() => {
    const sorted = [...items].sort((a, b) => b.total - a.total)
    const head = sorted.slice(0, MAX_SLICES).map((item, index) => ({
      key: String(item.category_id ?? `none-${index}`),
      name: item.name,
      emoji: item.emoji,
      total: item.total,
      color: `var(--series-${index + 1})`,
    }))
    const tail = sorted.slice(MAX_SLICES)
    if (tail.length) {
      head.push({
        key: 'other',
        name: `Інше (${tail.length})`,
        emoji: '•',
        total: tail.reduce((sum, item) => sum + item.total, 0),
        color: 'var(--series-8)',
      })
    }
    return head
  }, [items])

  if (!total || !slices.length) {
    return <p className="muted" style={{ textAlign: 'center', margin: '24px 0' }}>Витрат за цей місяць ще немає</p>
  }

  const active = slices.find((slice) => slice.key === selected) ?? null
  let offset = 0

  return (
    <div className="donut-wrap">
      <svg
        className="donut"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Витрати по категоріях, разом ${money(total, currency)}`}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((slice) => {
            const length = (slice.total / total) * CIRCUMFERENCE
            const dash = Math.max(length - GAP, 1)
            const circle = (
              <circle
                key={slice.key}
                className="donut-slice"
                data-dim={Boolean(selected) && selected !== slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                onClick={() => {
                  haptic.select()
                  setSelected((current) => (current === slice.key ? null : slice.key))
                }}
              />
            )
            offset += length
            return circle
          })}
        </g>
        <text className="donut-center-value" x="50%" y="48%" textAnchor="middle">
          {money(active ? active.total : total, currency, { compact: true })}
        </text>
        <text className="donut-center-label" x="50%" y="60%" textAnchor="middle">
          {active ? active.name : 'усі витрати'}
        </text>
      </svg>

      {/* Значення підписані текстом — колір ніколи не єдиний носій інформації */}
      <div className="legend">
        {slices.map((slice) => (
          <button
            key={slice.key}
            className="legend-row"
            data-active={selected === slice.key}
            onClick={() => {
              haptic.select()
              setSelected((current) => (current === slice.key ? null : slice.key))
            }}
          >
            <span className="legend-dot" style={{ background: slice.color }} />
            <span className="legend-name">
              {slice.emoji !== '•' ? `${slice.emoji} ` : ''}
              {slice.name}
              <span className="share">{Math.round((slice.total / total) * 100)}%</span>
            </span>
            <span className="legend-value">{money(slice.total, currency)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
