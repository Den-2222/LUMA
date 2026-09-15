import { tg } from './telegram'
import type { Budget, Category, Kind, Summary, Transaction, User } from '../types'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Підпис Telegram — бекенд перевіряє його на кожен запит
      'X-Telegram-Init-Data': tg?.initData ?? '',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${response.status}: ${detail || response.statusText}`)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const api = {
  me: () => request<User>('/me'),
  setCurrency: (currency: string) =>
    request<{ ok: boolean }>('/me', { method: 'PATCH', body: JSON.stringify({ currency }) }),

  categories: (kind?: Kind) => request<Category[]>(`/categories${kind ? `?kind=${kind}` : ''}`),
  addCategory: (kind: Kind, name: string, emoji: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ kind, name, emoji }) }),
  deleteCategory: (id: number) => request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),

  summary: (month: string) => request<Summary>(`/summary?month=${month}`),
  transactions: (params: { month?: string; kind?: Kind; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined).map(([k, v]) => [k, String(v)]),
    )
    return request<Transaction[]>(`/transactions?${query}`)
  },
  addTransaction: (payload: {
    kind: Kind
    amount: number
    category_id: number | null
    note: string
    occurred_at: string
  }) => request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  deleteTransaction: (id: number) => request<{ ok: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),

  budgets: (month: string) => request<Budget[]>(`/budgets?month=${month}`),
  setBudget: (categoryId: number, amount: number) =>
    request<{ ok: boolean }>(`/budgets/${categoryId}`, { method: 'PUT', body: JSON.stringify({ amount }) }),
}
