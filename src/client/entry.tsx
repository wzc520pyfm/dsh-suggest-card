import React, { useEffect, useState } from 'react'
import { PLUGIN_ID } from '../shared/types.ts'
import { SuggestCard, type OpenResourceOptions, type SuggestCardProps } from './card.tsx'
import { ensureStyles } from './styles.ts'
import {
  suggestTurnDefinition,
  suggestTurnView,
  type TurnViewSnapshot,
  type UiConversationLike,
} from './turn-model.ts'

export const inject = ['slots', 'sidebarRight', 'uiConversation']
export const name = PLUGIN_ID

interface SlotProps extends SuggestCardProps {
  sessionId?: string
  turn?: unknown
  seq?: number
  useSession?: SuggestCardProps['useSession']
  useInput?: SuggestCardProps['useInput']
  useChat?: SuggestCardProps['useChat']
}

interface ClientContext {
  slots: {
    inject(name: string, register: () => () => void): () => void
    register(def: Record<string, unknown>, component: (props: SlotProps) => React.ReactElement | null): () => void
  }
  sidebarRight?: { openResource?(address: string, options?: OpenResourceOptions): unknown }
  uiConversation?: UiConversationLike
  effect?(callback: () => void | (() => void), label?: string): void
  inject?(names: string[], fn: (ctx: ClientContext) => void): void
}

let pluginContext: ClientContext | null = null

export function apply(ctx: ClientContext): void {
  pluginContext = ctx
  ensureStyles()
  const register = () => {
    const disposers: Array<() => void> = []
    if (ctx.uiConversation?.events.register) {
      disposers.push(ctx.uiConversation.events.register(suggestTurnDefinition))
    }
    if (ctx.uiConversation?.views.register) {
      disposers.push(ctx.uiConversation.views.register(suggestTurnView))
    }
    disposers.push(ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
      name: 'conversation.chat.turnTail',
      id: PLUGIN_ID,
      locale: undefined,
    }, TurnTailCard)))
    return () => { for (const dispose of disposers) dispose() }
  }
  if (ctx.effect) ctx.effect(register, 'dsh-suggest-card: turnTail')
  else if (ctx.inject) ctx.inject(['slots', 'sidebarRight', 'uiConversation'], (inner) => {
    pluginContext = inner
    register()
  })
  else register()
}

function TurnTailCard(props: SlotProps): React.ReactElement | null {
  const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
  const turnSnapshot = useTurnSnapshot(sessionId, pluginContext?.uiConversation)
  const openResource = pluginContext?.sidebarRight?.openResource
  return (
    <SuggestCard
      sessionId={sessionId}
      turn={props.turn}
      seq={props.seq}
      useSession={props.useSession}
      useInput={props.useInput}
      useChat={props.useChat}
      turnSnapshot={turnSnapshot}
      openResource={openResource ? (address, options) => openResource.call(pluginContext?.sidebarRight, address, options) : undefined}
    />
  )
}

function useTurnSnapshot(sessionId: string, uiConversation?: UiConversationLike): TurnViewSnapshot | undefined {
  const [snapshot, setSnapshot] = useState<TurnViewSnapshot | undefined>()
  useEffect(() => {
    if (!sessionId || !uiConversation?.binding) {
      setSnapshot(undefined)
      return
    }
    let source: { getSnapshot(): TurnViewSnapshot | undefined; subscribe(fn: () => void): () => void } | undefined
    try { source = uiConversation.binding(sessionId).target('dshSuggestCardTurn') } catch { source = undefined }
    if (!source) {
      setSnapshot(undefined)
      return
    }
    const sync = () => {
      try { setSnapshot(source!.getSnapshot()) } catch { setSnapshot(undefined) }
    }
    sync()
    return source.subscribe(sync)
  }, [sessionId, uiConversation])
  return snapshot
}
