import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { money, todayISO } from '../lib/format'
import { haptic, tg } from '../lib/telegram'
import type { Category, Kind } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

function yesterdayISO(): string {
  const date = new Date(Date.parse(todayISO()) - 86_400_000)
  return date.toISOString().slice(0, 10)
}

/** Ввід суми тримаємо рядком — так цифри з клавіатури не страждають від float-округлень. */
function toMinor(input: string): number {
  const [whole, frac = ''] = input.split(',')
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0').slice(0, 2) || '0')
}

export function Add({ currency, onSaved }: { currency: string; onSaved: () => void }) {
  const [kind, setKind] = useState<Kind>('expense')
  const [input, setInput] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.categories(kind).then(setCategories).catch((err: Error) => setError(err.message))
    setCategoryId(null)
  }, [kind])

  const amount = useMemo(() => toMinor(input), [input])
  const canSave = amount > 0 && !saving

  function press(key: string): void {
    haptic.tap()
    setInput((current) => {
      if (key === '⌫') return current.slice(0, -1)
      if (key === ',') return current.includes(',') || !current ? current : `${current},`
      const [, frac] = current.split(',')
      if (frac !== undefined && frac.length >= 2) return current
      if (current === '0') return key
      if (current.replace(',', '').length >= 9) return current
      return current + key
    })
  }

  async function save(): Promise<void> {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await api.addTransaction({ kind, amount, category_id: categoryId, note: note.trim(), occurred_at: date })
      haptic.success()
      setInput('')
      setNote('')
      setCategoryId(null)
      onSaved()
    } catch (err) {
      haptic.error()
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Нативна кнопка Telegram унизу екрана — найзвичніший спосіб підтвердити дію
  useEffect(() => {
    const button = tg?.MainButton
    if (!button) return
    button.setText(saving ? 'Зберігаю…' : `Зберегти ${amount ? money(amount, currency) : ''}`.trim())
    if (canSave) button.enable()
    else button.disable()
    button.show()
    button.onClick(save)
    return () => {
      button.offClick(save)
      button.hide()
    }
  })

  return (
    <div className="screen">
      <div className="kind-switch">
        <button data-active={kind === 'expense'} onClick={() => { haptic.select(); setKind('expense') }}>➖ Витрата</button>
        <button data-active={kind === 'income'} onClick={() => { haptic.select(); setKind('income') }}>➕ Дохід</button>
      </div>

      <div className={`amount-display ${kind}`}>
        {input ? `${input} ${currency === 'UAH' ? '₴' : currency}` : <span className="placeholder">0 ₴</span>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="keypad">
        {KEYS.map((key) => (
          <button key={key} className="key" onClick={() => press(key)}>{key}</button>
        ))}
      </div>

      <h2 className="card-title" style={{ marginTop: 20 }}>Категорія</h2>
      <div className="cat-grid">
        {categories.map((category) => (
          <button
            key={category.id}
            className="cat-btn"
            data-active={categoryId === category.id}
            onClick={() => {
              haptic.select()
              setCategoryId((current) => (current === category.id ? null : category.id))
            }}
          >
            <span className="emoji">{category.emoji}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      <h2 className="card-title" style={{ marginTop: 20 }}>Коли</h2>
      <div className="chips">
        <button className="chip" data-active={date === todayISO()} onClick={() => { haptic.select(); setDate(todayISO()) }}>
          Сьогодні
        </button>
        <button className="chip" data-active={date === yesterdayISO()} onClick={() => { haptic.select(); setDate(yesterdayISO()) }}>
          Вчора
        </button>
        <input
          className="chip"
          type="date"
          value={date}
          max={todayISO()}
          onChange={(event) => setDate(event.target.value)}
          style={{ border: 'none' }}
        />
      </div>

      <input
        className="field"
        style={{ marginTop: 16 }}
        placeholder="Нотатка (необовʼязково)"
        value={note}
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
      />

      {/* Запасна кнопка: у браузері поза Telegram MainButton недоступна */}
      {!tg?.MainButton && (
        <button className="btn" style={{ marginTop: 16 }} disabled={!canSave} onClick={save}>
          {saving ? 'Зберігаю…' : 'Зберегти'}
        </button>
      )}
    </div>
  )
}
