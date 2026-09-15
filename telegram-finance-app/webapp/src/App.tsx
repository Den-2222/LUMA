import { useCallback, useEffect, useState } from 'react'
import { Add } from './screens/Add'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { More } from './screens/More'
import { api } from './lib/api'
import { haptic } from './lib/telegram'
import type { User } from './types'

type Tab = 'home' | 'add' | 'history' | 'more'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home', icon: '📊', label: 'Огляд' },
  { key: 'add', icon: '➕', label: 'Додати' },
  { key: 'history', icon: '📜', label: 'Історія' },
  { key: 'more', icon: '⚙️', label: 'Ще' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((value) => value + 1), [])

  useEffect(() => {
    api.me().then(setUser).catch((err: Error) => setError(err.message))
  }, [version])

  if (error) {
    return (
      <div className="screen">
        <div className="error">Немає доступу: {error}</div>
        <p className="muted">
          Відкрий застосунок через кнопку в боті — так Telegram передає підпис, за яким сервер тебе впізнає.
        </p>
      </div>
    )
  }

  if (!user) {
    return <div className="screen"><div className="skeleton" /><div className="skeleton" /></div>
  }

  return (
    <div className="app">
      {tab === 'home' && <Home key={version} onOpenHistory={() => setTab('history')} />}
      {tab === 'add' && (
        <Add
          currency={user.currency}
          onSaved={() => {
            refresh()
            setTab('home')
          }}
        />
      )}
      {tab === 'history' && <History refreshKey={version} />}
      {tab === 'more' && <More user={user} onChanged={refresh} />}

      <nav className="tabbar">
        {TABS.map((item) => (
          <button
            key={item.key}
            className="tab"
            data-active={tab === item.key}
            onClick={() => {
              haptic.tap()
              setTab(item.key)
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
