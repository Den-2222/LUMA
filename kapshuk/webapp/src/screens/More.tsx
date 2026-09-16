import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { currentMonth, money } from '../lib/format'
import { confirmAction, haptic } from '../lib/telegram'
import type { Budget, Category, User } from '../types'

const CURRENCIES = ['UAH', 'USD', 'EUR', 'PLN', 'GBP']
const EMOJIS = ['🏷', '🍔', '🛒', '🚕', '🏠', '💊', '👕', '🎮', '📱', '🎓', '🎁', '✈️', '🐶', '💪', '💼', '💻', '📈', '💰']

export function More({ user, onChanged }: { user: User; onChanged: () => void }) {
  const [currency, setCurrency] = useState(user.currency)
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🏷')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState('')

  function reload(): void {
    Promise.all([api.categories(), api.budgets(currentMonth())])
      .then(([categoryList, budgetList]) => {
        setCategories(categoryList)
        setBudgets(budgetList)
      })
      .catch((err: Error) => setError(err.message))
  }

  useEffect(reload, [])

  async function changeCurrency(code: string): Promise<void> {
    haptic.select()
    setCurrency(code)
    await api.setCurrency(code)
    onChanged()
  }

  async function createCategory(): Promise<void> {
    if (!name.trim()) return
    try {
      await api.addCategory(kind, name.trim(), emoji)
      haptic.success()
      setName('')
      reload()
    } catch (err) {
      haptic.error()
      setError((err as Error).message)
    }
  }

  async function removeCategory(category: Category): Promise<void> {
    if (!(await confirmAction(`Прибрати категорію «${category.name}»? Записи залишаться.`))) return
    await api.deleteCategory(category.id)
    haptic.success()
    reload()
  }

  async function editBudget(category: Category): Promise<void> {
    const existing = budgets.find((budget) => budget.category_id === category.id)
    const raw = window.prompt(
      `Ліміт на місяць для «${category.name}» (0 — прибрати)`,
      existing ? String(existing.amount / 100) : '',
    )
    if (raw === null) return
    const value = Number(raw.replace(',', '.'))
    if (Number.isNaN(value) || value < 0) return
    await api.setBudget(category.id, Math.round(value * 100))
    haptic.success()
    reload()
  }

  const expenseCategories = categories.filter((category) => category.kind === 'expense')

  return (
    <div className="screen">
      <h1 style={{ fontSize: 20, margin: '4px 0 16px' }}>Налаштування</h1>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2 className="card-title">Валюта</h2>
        <div className="chips">
          {CURRENCIES.map((code) => (
            <button key={code} className="chip" data-active={currency === code} onClick={() => changeCurrency(code)}>
              {code}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>
          Записи, збережені раніше, лишаються у своїй валюті.
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Ліміти на місяць</h2>
        {expenseCategories.map((category) => {
          const budget = budgets.find((item) => item.category_id === category.id)
          return (
            <button key={category.id} className="row" style={{ width: '100%' }} onClick={() => editBudget(category)}>
              <span>{category.emoji} {category.name}</span>
              <span className="muted">{budget ? money(budget.amount, currency) : 'немає'}</span>
            </button>
          )
        })}
      </div>

      <div className="card">
        <h2 className="card-title">Нова категорія</h2>
        <div className="kind-switch" style={{ marginBottom: 10 }}>
          <button data-active={kind === 'expense'} onClick={() => setKind('expense')}>Витрата</button>
          <button data-active={kind === 'income'} onClick={() => setKind('income')}>Дохід</button>
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {EMOJIS.map((option) => (
            <button key={option} className="chip" data-active={emoji === option} onClick={() => setEmoji(option)}>
              {option}
            </button>
          ))}
        </div>
        <input
          className="field"
          placeholder="Назва категорії"
          value={name}
          maxLength={32}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="btn" style={{ marginTop: 10 }} disabled={!name.trim()} onClick={createCategory}>
          Додати
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Мої категорії</h2>
        {categories.map((category) => (
          <div key={category.id} className="row">
            <span>{category.emoji} {category.name}</span>
            <button className="muted" onClick={() => removeCategory(category)}>Прибрати</button>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
        Експорт у CSV — командою /export у боті
      </p>
    </div>
  )
}
