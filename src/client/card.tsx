import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { changesReviewAddress } from './addresses.ts'
import { getWorkspaceStatus, requestCommit, sendFollowup, SuggestApiError } from './api.ts'
import { detectLocale, persistLocale, shortcutHint, translate, type MessageKey } from './i18n.ts'
import { classifySession, isComposerEmpty, isDismissed, rememberDismissed } from './session.ts'
import { answerTextFromSnapshot, recordForTurn, type TurnViewSnapshot } from './turn-model.ts'
import {
  filterActionsForWorkspace,
  filterReviewAvailability,
  resolvePayload,
} from '../shared/payload.ts'
import { turnFromUnknown } from '../shared/text.ts'
import type { SuggestAction, UiLocale, WorkspaceDirtiness } from '../shared/types.ts'

export interface OpenResourceOptions {
  params?: { index?: number }
}

export interface SuggestCardProps {
  sessionId?: string
  turn?: unknown
  seq?: number
  useSession?: (select: (snapshot: unknown) => unknown) => unknown
  useInput?: (select: (snapshot: unknown) => unknown) => unknown
  useChat?: (select: (snapshot: unknown) => unknown) => unknown
  turnSnapshot?: TurnViewSnapshot
  openResource?: (address: string, options?: OpenResourceOptions) => unknown
}

export function SuggestCard(props: SuggestCardProps): React.ReactElement | null {
  const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
  const turn = turnFromUnknown(props.turn)
  const sessionSnapshot = safeSelect(props.useSession)
  const inputSnapshot = safeSelect(props.useInput)
  const chatSnapshot = safeSelect(props.useChat)
  const kind = classifySession(sessionSnapshot, sessionId)
  const [locale, setLocale] = useState<UiLocale>(detectLocale)
  const [dismissed, setDismissed] = useState(() => !!(sessionId && turn && isDismissed(sessionId, turn)))
  const [dirtiness, setDirtiness] = useState<WorkspaceDirtiness | undefined>()
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<MessageKey | undefined>()
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    getWorkspaceStatus(sessionId, controller.signal)
      .then((result) => setDirtiness(result.status))
      .catch(() => setDirtiness({ readable: false, reason: 'error' }))
    return () => controller.abort()
  }, [sessionId, turn])

  const record = turn !== undefined ? recordForTurn(props.turnSnapshot, turn) : undefined
  const rawAnswer = record?.answerText || (turn !== undefined ? answerTextFromSnapshot(chatSnapshot, turn) : '')
  const changesSeq = record?.changesSeq
  const reviewAvailable = typeof changesSeq === 'number' && Number.isSafeInteger(changesSeq) && changesSeq >= 0
    && !!sessionId && turn !== undefined

  const payload = useMemo(() => resolvePayload(rawAnswer), [rawAnswer])
  const dirtyFilter = dirtiness?.readable === true ? (dirtiness.dirty ? 'dirty' : 'clean') : 'unknown'
  const actions = useMemo(() => {
    if (!payload) return []
    return filterReviewAvailability(filterActionsForWorkspace(payload.actions, dirtyFilter), reviewAvailable)
  }, [payload, dirtyFilter, reviewAvailable])

  const t = (key: MessageKey) => translate(locale, key)
  const hint = shortcutHint()

  const runAction = useCallback(async (action: SuggestAction) => {
    if (!sessionId || busy) return
    setErrorKey(undefined)
    setBusy(true)
    try {
      if (action.type === 'followup') {
        await sendFollowup(sessionId, action.message)
        return
      }
      if (action.type === 'commit') {
        await requestCommit(sessionId)
        return
      }
      if (!reviewAvailable || turn === undefined || changesSeq === undefined || !props.openResource) {
        setErrorKey('reviewUnavailable')
        return
      }
      try {
        props.openResource(changesReviewAddress({ sessionId, seq: changesSeq, turn }))
      } catch {
        setErrorKey('reviewOpenFailed')
      }
    } catch (error) {
      if (error instanceof SuggestApiError && error.code === 'agent_unavailable') setErrorKey('noAgent')
      else setErrorKey('sendFailed')
    } finally {
      setBusy(false)
    }
  }, [sessionId, busy, reviewAvailable, turn, changesSeq, props])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.altKey || event.shiftKey) return
      if (!(event.metaKey || event.ctrlKey)) return
      if (!cardRef.current?.contains(document.activeElement)) return
      // Only fire when the composer draft is known to be empty. If we cannot
      // read the draft, do nothing so we never steal the official send key.
      if (isComposerEmpty(inputSnapshot) !== true) return
      if (actions.length === 0) return
      event.preventDefault()
      event.stopPropagation()
      void runAction(actions[0])
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [actions, inputSnapshot, runAction])

  if (!sessionId || turn === undefined) return null
  if (kind === 'sub') return null
  if (dismissed) return null
  if (!payload || actions.length === 0) return null

  const primary = actions[0]
  const rest = actions.slice(1)
  const omittedReview = payload.actions.some((action) => action.type === 'review')
    && !actions.some((action) => action.type === 'review')
    && !reviewAvailable

  return (
    <section
      ref={cardRef}
      className="dsh-sc"
      tabIndex={0}
      role="region"
      aria-label={t('region')}
      data-dsh-suggest-card="true"
      data-turn={String(turn)}
    >
      <div className="dsh-sc-meta" role="group" aria-label={t('language')}>
        <button type="button" className="dsh-sc-lang" aria-pressed={locale === 'en'} onClick={() => { persistLocale('en'); setLocale('en') }}>{t('english')}</button>
        <button type="button" className="dsh-sc-lang" aria-pressed={locale === 'zh'} onClick={() => { persistLocale('zh'); setLocale('zh') }}>{t('chinese')}</button>
      </div>
      <button type="button" className="dsh-sc-close" aria-label={t('close')} title={t('close')} onClick={() => { rememberDismissed(sessionId, turn); setDismissed(true) }}>×</button>
      <p className="dsh-sc-summary">{payload.summary}</p>
      <p className="dsh-sc-question">{payload.question}</p>
      <div className="dsh-sc-actions">
        <button type="button" className="dsh-sc-primary" disabled={busy} onClick={() => void runAction(primary)}>
          <span>{primary.label}</span>
          <ShortcutHint hint={hint} />
        </button>
        {rest.map((action, index) => (
          <button
            key={`${action.type}-${index}`}
            type="button"
            className="dsh-sc-secondary"
            disabled={busy}
            onClick={() => void runAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      {errorKey ? <p className="dsh-sc-error" role="status">{t(errorKey)}</p> : null}
      {omittedReview ? <p className="dsh-sc-hint">{t('reviewUnavailable')}</p> : null}
    </section>
  )
}

function ShortcutHint({ hint }: { hint: string }): React.ReactElement {
  const parts = hint === '⌘↩' ? ['⌘', '↩'] : hint.split('+')
  return (
    <span className="dsh-sc-keys" aria-hidden="true">
      {parts.map((part, index) => <span key={`${part}-${index}`} className="dsh-sc-key">{part}</span>)}
    </span>
  )
}

function safeSelect(hook?: (select: (snapshot: unknown) => unknown) => unknown): unknown {
  if (!hook) return undefined
  try { return hook((snapshot) => snapshot) } catch { return undefined }
}
