import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { currentMonth, humanDay, money, monthTitle, shiftMonth } from '../lib/format'
import { confirmAction, haptic } from '../lib/telegram'
import type { Kind, Transaction } from '../types'

const FILTERS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'expense', label: '➖ Витрати' },
  { key: 'income', label: '➕ Доходи' },
]

export function History({ refreshKey }: { refreshKey: number }) {
  const [month, setMonth] = useState(currentMonth())
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const [items, setItems] = useState<Transaction[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    api
      .transactions({ month, kind: filter === 'all' ? undefined : filter, limit: 200 })
      .then(setItems)
      .catch((err: Error) => setError(err.message))
  }, [month, filter])

  useEffect(load, [load, refreshKey])

  async function remove(tx: Transaction): Promise<void> {
    const ok = await confirmAction(
      `Видалити запис «${tx.category_name ?? 'Без категорії'}» на ${money(tx.amount, tx.currency)}?`,
    )
    if (!ok) return
    try {
      await api.deleteTransaction(tx.id)
      haptic.success()
      setItems((current) => current?.filter((item) => item.id !== tx.id) ?? null)
    } catch (err) {
      haptic.error()
      setError((err as Error).message)
    }
  }

  const groups = (items ?? []).reduce<Record<string, Transaction[]>>((acc, tx) => {
    ;(acc[tx.occurred_at] ??= []).push(tx)
    return acc
  }, {})

  return (
    <div className="screen">
      <div className="month-nav">
        <button onClick={() => { haptic.tap(); setMonth(shiftMonth(month, -1)) }} aria-label="Попередній місяць">‹</button>
        <h1>{monthTitle(month)}</h1>
        <button
          onClick={() => { haptic.tap(); setMonth(shiftMonth(month, 1)) }}
          disabled={month === currentMonth()}
          aria-label="Наступний місяць"
        >›</button>
      </div>

      <div className="chips" style={{ marginBottom: 8 }}>
        {FILTERS.map((option) => (
          <button
            key={option.key}
            className="chip"
            data-active={filter === option.key}
            onClick={() => { haptic.select(); setFilter(option.key) }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {!items && !error && <div className="skeleton" />}

      {items?.length === 0 && (
        <div className="empty">
          <span className="icon">🗓</span>
          За цей місяць записів немає
        </div>
      )}

      {Object.entries(groups).map(([day, dayItems]) => {
        const dayTotal = dayItems.reduce((sum, tx) => sum + (tx.kind === 'expense' ? tx.amount : 0), 0)
        return (
          <div key={day}>
            <div className="tx-day">
              {humanDay(day)}
              {dayTotal > 0 && <span style={{ float: 'right' }}>−{money(dayTotal, dayItems[0].currency)}</span>}
            </div>
            <div className="tx-list">
              {dayItems.map((tx) => (
                <button key={tx.id} className="tx" onClick={() => remove(tx)}>
                  <span className="tx-icon">{tx.category_emoji ?? '❔'}</span>
                  <span className="tx-main">
                    <div className="tx-name">{tx.category_name ?? 'Без категорії'}</div>
                    {tx.note && <div className="tx-note">{tx.note}</div>}
                  </span>
                  <span className={`tx-amount ${tx.kind}`}>
                    {tx.kind === 'income' ? '+' : '−'}{money(tx.amount, tx.currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {items && items.length > 0 && (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
          Торкнись запису, щоб видалити
        </p>
      )}
    </div>
  )
}
