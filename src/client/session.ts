import { isRecord } from '../shared/payload.ts'
import { DISMISS_STORAGE_PREFIX } from '../shared/types.ts'

/** Best-effort main-session check. Unrecognized shapes are treated as unknown, not as main. */
export type SessionKind = 'main' | 'sub' | 'unknown'

export function classifySession(snapshot: unknown, sessionId?: string): SessionKind {
  if (!isRecord(snapshot) && !sessionId) return 'unknown'
  const record = isRecord(snapshot) ? snapshot : {}
  const parent = firstString(record, [
    'parentSessionId', 'parentId', 'parent', 'parent_session_id',
  ])
  if (parent && parent !== sessionId) return 'sub'
  const kind = firstString(record, ['kind', 'type', 'mode', 'sessionKind', 'sessionType'])
  if (kind && /sub-?agent|child|forked-child/i.test(kind)) return 'sub'
  if (record.isSubagent === true || record.subagent === true || record.child === true) return 'sub'
  if (isRecord(record.header)) {
    const nested = classifySession(record.header, sessionId)
    if (nested === 'sub') return 'sub'
  }
  if (isRecord(snapshot) && (firstString(record, ['id', 'sessionId']) || sessionId)) {
    // A snapshot with identity but no parent/sub markers is treated as main.
    if (!parent && !kind) return 'main'
    if (kind && /main|primary|root|default/i.test(kind)) return 'main'
  }
  return isRecord(snapshot) ? 'main' : 'unknown'
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

export function composerDraftText(input: unknown): string | undefined {
  if (input == null) return undefined
  if (typeof input === 'string') return input
  if (!isRecord(input)) return undefined
  for (const key of ['text', 'value', 'content', 'draftText']) {
    if (typeof input[key] === 'string') return input[key]
  }
  if (isRecord(input.draft)) return composerDraftText(input.draft)
  if (isRecord(input.editor)) return composerDraftText(input.editor)
  if (isRecord(input.state)) return composerDraftText(input.state)
  return undefined
}

export function isComposerEmpty(input: unknown): boolean | undefined {
  const text = composerDraftText(input)
  if (text === undefined) return undefined
  return text.trim().length === 0
}

export function dismissKey(sessionId: string, turn: number): string {
  return `${DISMISS_STORAGE_PREFIX}${sessionId}:${turn}`
}

export function isDismissed(sessionId: string, turn: number): boolean {
  try { return sessionStorage.getItem(dismissKey(sessionId, turn)) === '1' } catch { return false }
}

export function rememberDismissed(sessionId: string, turn: number): void {
  try { sessionStorage.setItem(dismissKey(sessionId, turn), '1') } catch { /* ignore */ }
}
