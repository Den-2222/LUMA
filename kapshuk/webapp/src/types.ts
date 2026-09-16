export type Kind = 'income' | 'expense'

export interface User {
  id: number
  first_name: string
  currency: string
}

export interface Category {
  id: number
  kind: Kind
  name: string
  emoji: string
  sort: number
}

export interface Transaction {
  id: number
  kind: Kind
  amount: number // копійки
  currency: string
  note: string
  occurred_at: string
  category_id: number | null
  category_name: string | null
  category_emoji: string | null
}

export interface CategoryTotal {
  kind: Kind
  category_id: number | null
  name: string
  emoji: string
  total: number
  count: number
}

export interface Summary {
  month: string
  currency: string
  income: number
  expense: number
  balance: number
  income_count: number
  expense_count: number
  by_category: CategoryTotal[]
  by_day: { day: string; kind: Kind; total: number }[]
}

export interface Budget {
  category_id: number
  amount: number
  spent: number
  name: string
  emoji: string
}
