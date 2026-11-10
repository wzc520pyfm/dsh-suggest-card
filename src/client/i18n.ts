import { LOCALE_STORAGE_KEY, type UiLocale } from '../shared/types.ts'

const en = {
  region: 'Suggested next steps',
  close: 'Close',
  language: 'Language',
  english: 'English',
  chinese: '中文',
  shortcutMac: '⌘↩',
  shortcutWin: 'Ctrl+Enter',
  reviewUnavailable: 'The official changes-review page is unavailable.',
  reviewOpenFailed: 'Could not open the official changes-review page.',
  sendFailed: 'The message could not be sent. Try again later.',
  noAgent: 'No live Agent is available in this session.',
  sending: 'Sending…',
  opening: 'Opening…',
}

const zh: Record<keyof typeof en, string> = {
  region: '建议的下一步',
  close: '关闭',
  language: '语言',
  english: 'English',
  chinese: '中文',
  shortcutMac: '⌘↩',
  shortcutWin: 'Ctrl+Enter',
  reviewUnavailable: '官方 changes-review 页面不可用。',
  reviewOpenFailed: '无法打开官方 changes-review 页面。',
  sendFailed: '消息未能发出，请稍后重试。',
  noAgent: '当前会话没有可用的实时 Agent。',
  sending: '正在发送…',
  opening: '正在打开…',
}

const dict = { en, zh }

export type MessageKey = keyof typeof en

export function translate(locale: UiLocale, key: MessageKey): string {
  return dict[locale][key] ?? dict.en[key]
}

export function detectLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch { /* ignore */ }
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : ''
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function persistLocale(locale: UiLocale): void {
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale) } catch { /* ignore */ }
}

export function shortcutHint(): string {
  if (typeof navigator === 'undefined') return en.shortcutWin
  const platform = navigator.platform || ''
  const ua = navigator.userAgent || ''
  if (/Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua)) return en.shortcutMac
  return en.shortcutWin
}
