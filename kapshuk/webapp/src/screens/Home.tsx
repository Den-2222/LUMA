import { useEffect, useState } from 'react'
import { Donut } from '../components/Donut'
import { DayBars } from '../components/DayBars'
import { api } from '../lib/api'
import { currentMonth, humanDay, money, monthTitle, shiftMonth } from '../lib/format'
import { haptic } from '../lib/telegram'
import type { Budget, Summary, Transaction } from '../types'

export function Home({ onOpenHistory }: { onOpenHistory: () => void }) {
  const [month, setMonth] = useState(currentMonth())
  const [summary, setSummary] = useState<Summary | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recent, setRecent] = useState<Transaction[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    Promise.all([api.summary(month), api.budgets(month), api.transactions({ month, limit: 5 })])
      .then(([summaryData, budgetData, recentData]) => {
        if (cancelled) return
        setSummary(summaryData)
        setBudgets(budgetData)
        setRecent(recentData)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [month])

  const expenses = summary?.by_category.filter((item) => item.kind === 'expense') ?? []
  const isCurrent = month === currentMonth()

  return (
    <div className="screen">
      <div className="month-nav">
        <button onClick={() => { haptic.tap(); setMonth(shiftMonth(month, -1)) }} aria-label="Попередній місяць">‹</button>
        <h1>{monthTitle(month)}</h1>
        <button
          onClick={() => { haptic.tap(); setMonth(shiftMonth(month, 1)) }}
          disabled={isCurrent}
          aria-label="Наступний місяць"
        >›</button>
      </div>

      {error && <div className="error">Не вдалося завантажити: {error}</div>}
      {!summary && !error && <><div className="skeleton" /><div className="skeleton" /></>}

      {summary && (
        <>
          <div className="card balance">
            <div className="label">Залишилось за місяць</div>
            <div className={`value ${summary.balance < 0 ? 'negative' : ''}`}>
              {money(summary.balance, summary.currency)}
            </div>
            <div className="totals">
              <div className="total">
                <div className="label">➕ Доходи</div>
                <div className="amount income">{money(summary.income, summary.currency)}</div>
              </div>
              <div className="total">
                <div className="label">➖ Витрати</div>
                <div className="amount expense">{money(summary.expense, summary.currency)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Куди пішли гроші</h2>
            <Donut items={expenses} total={summary.expense} currency={summary.currency} />
          </div>

          <div className="card">
            <h2 className="card-title">По днях</h2>
            <DayBars summary={summary} />
          </div>

          {budgets.length > 0 && (
            <div className="card">
              <h2 className="card-title">Ліміти</h2>
              {budgets.map((budget) => {
                const share = budget.amount ? budget.spent / budget.amount : 0
                const color = share > 1 ? 'var(--danger)' : share >= 0.8 ? 'var(--series-4)' : 'var(--good)'
                return (
                  <div key={budget.category_id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{budget.emoji} {budget.name}</span>
                      <span className="muted">
                        {money(budget.spent, summary.currency)} / {money(budget.amount, summary.currency)}
                      </span>
                    </div>
                    <div className="budget-bar">
                      <div className="budget-fill" style={{ width: `${Math.min(share * 100, 100)}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {recent.length > 0 && (
            <>
              <h2 className="card-title" style={{ marginTop: 18 }}>Останні записи</h2>
              <div className="tx-list">
                {recent.map((tx) => (
                  <div key={tx.id} className="tx">
                    <span className="tx-icon">{tx.category_emoji ?? '❔'}</span>
                    <span className="tx-main">
                      <div className="tx-name">{tx.category_name ?? 'Без категорії'}</div>
                      <div className="tx-note">{tx.note || humanDay(tx.occurred_at)}</div>
                    </span>
                    <span className={`tx-amount ${tx.kind}`}>
                      {tx.kind === 'income' ? '+' : '−'}{money(tx.amount, tx.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn secondary" style={{ marginTop: 12 }} onClick={onOpenHistory}>
                Уся історія
              </button>
            </>
          )}

          {!summary.income && !summary.expense && (
            <div className="empty">
              <span className="icon">🧾</span>
              За цей місяць записів немає.<br />Додай перший через кнопку «Додати».
            </div>
          )}
        </>
      )}
    </div>
  )
}
