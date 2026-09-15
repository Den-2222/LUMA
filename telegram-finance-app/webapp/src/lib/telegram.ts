/** Обгортка над Telegram WebApp SDK — щоб застосунок працював і у звичайному браузері. */

interface TelegramWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  onEvent(event: string, handler: () => void): void
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  MainButton: {
    text: string
    isVisible: boolean
    show(): void
    hide(): void
    setText(text: string): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    onClick(cb: () => void): void
    offClick(cb: () => void): void
  }
  showConfirm?(message: string, cb: (ok: boolean) => void): void
}

export const tg: TelegramWebApp | undefined = (window as any).Telegram?.WebApp

export function initTelegram(): void {
  if (!tg) return
  tg.ready()
  tg.expand()
  tg.disableVerticalSwipes?.()
  applyScheme()
  tg.onEvent('themeChanged', applyScheme)
}

function applyScheme(): void {
  document.documentElement.dataset.theme = tg?.colorScheme ?? 'light'
}

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred('light'),
  press: () => tg?.HapticFeedback?.impactOccurred('medium'),
  success: () => tg?.HapticFeedback?.notificationOccurred('success'),
  error: () => tg?.HapticFeedback?.notificationOccurred('error'),
  select: () => tg?.HapticFeedback?.selectionChanged(),
}

export function confirmAction(message: string): Promise<boolean> {
  if (tg?.showConfirm) {
    return new Promise((resolve) => tg.showConfirm!(message, resolve))
  }
  return Promise.resolve(window.confirm(message))
}
