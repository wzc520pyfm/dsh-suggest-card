import { collectText, turnFromUnknown } from '../shared/text.ts'
import { isRecord } from '../shared/payload.ts'

export const TURN_VIEW_TARGET = 'dshSuggestCardTurn'
const TURN_KIND = 'dsh-suggest-card-turn'

export interface TurnRecord {
  readonly turn: number
  readonly answerText: string
  readonly changesSeq?: number
  readonly ended?: boolean
}

export interface TurnViewSnapshot {
  readonly turns: readonly TurnRecord[]
}

interface SessionEventLike {
  type: string
  seq: number
  data: unknown
}

interface MatchResult {
  readonly id: string
  readonly role: 'start' | 'update'
}

interface ConversationContext {
  readonly key: string
  readonly state?: TurnRecord
}

interface ViewNode {
  readonly key: string
  readonly kind: string
  readonly id: string
  readonly target: string
  readonly data: TurnRecord
}

export interface ObservableSnapshotLike<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

export interface UiConversationLike {
  events: { register(definition: unknown): () => void }
  views: { register(definition: unknown): () => void }
  binding(sessionId: string): { target(name: string): ObservableSnapshotLike<TurnViewSnapshot | undefined> }
}

export function isAssistantEvent(type: string): boolean {
  return type === 'assistant/message' || type === 'assistant/attempt' || type === 'assistant/live-chunk'
}

export function isChangesEvent(type: string, data: unknown): data is { turn: number } {
  return type === 'workspace/changes' && turnFromUnknown(data) !== undefined
}

export function applyEvent(state: TurnRecord, event: SessionEventLike): TurnRecord {
  const turn = turnFromUnknown(event.data) ?? state.turn
  if (isChangesEvent(event.type, event.data)) {
    return { ...state, turn, changesSeq: event.seq }
  }
  if (event.type === 'turn/end') {
    return { ...state, turn, ended: true }
  }
  if (isAssistantEvent(event.type)) {
    const text = collectText(event.data)
    if (!text) return { ...state, turn }
    // Live chunks append; durable settlements replace when they look complete.
    const answerText = event.type === 'assistant/live-chunk' && state.answerText
      ? `${state.answerText}${text}`
      : text.length >= state.answerText.length ? text : state.answerText
    return { ...state, turn, answerText }
  }
  return { ...state, turn }
}

function eventTurn(event: SessionEventLike): number | undefined {
  return turnFromUnknown(event.data)
}

export const suggestTurnDefinition = {
  kind: TURN_KIND,
  target: TURN_VIEW_TARGET,
  match(event: SessionEventLike): MatchResult | null {
    const turn = eventTurn(event)
    if (turn === undefined) return null
    if (event.type === 'turn/start' || isChangesEvent(event.type, event.data)) {
      return { id: String(turn), role: 'start' }
    }
    if (event.type === 'turn/end' || isAssistantEvent(event.type)) {
      return { id: String(turn), role: 'update' }
    }
    return null
  },
  start(_context: ConversationContext, match: { event: SessionEventLike }): TurnRecord {
    const turn = eventTurn(match.event) ?? 0
    return applyEvent({ turn, answerText: '' }, match.event)
  },
  update(context: ConversationContext & { state: TurnRecord }, match: { event: SessionEventLike }): TurnRecord {
    return applyEvent(context.state, match.event)
  },
  buildViewNode(context: ConversationContext): ViewNode | null {
    const state = context.state
    if (!state || state.turn < 1) return null
    return {
      key: context.key,
      kind: TURN_KIND,
      id: String(state.turn),
      target: TURN_VIEW_TARGET,
      data: state,
    }
  },
}

function snapshotFromNodes(nodes: readonly { data: TurnRecord }[]): TurnViewSnapshot {
  const byTurn = new Map<number, TurnRecord>()
  for (const node of nodes) byTurn.set(node.data.turn, node.data)
  return { turns: [...byTurn.values()].sort((a, b) => b.turn - a.turn) }
}

export const suggestTurnView = {
  target: TURN_VIEW_TARGET,
  create() {
    let nodes: Array<{ id: string; data: TurnRecord }> = []
    return {
      empty: { turns: [] } satisfies TurnViewSnapshot,
      replace(input: { nodes: ReadonlyArray<{ id: string; data: TurnRecord }> }) {
        nodes = [...input.nodes]
        return snapshotFromNodes(nodes)
      },
      upsert(input: { node: { id: string; data: TurnRecord } }) {
        const index = nodes.findIndex((item) => item.id === input.node.id)
        if (index >= 0) nodes[index] = input.node
        else nodes.push(input.node)
        return snapshotFromNodes(nodes)
      },
      remove(input: { id: string }) {
        nodes = nodes.filter((item) => item.id !== input.id)
        return snapshotFromNodes(nodes)
      },
    }
  },
}

export function recordForTurn(snapshot: TurnViewSnapshot | undefined, turn: number): TurnRecord | undefined {
  return snapshot?.turns.find((item) => item.turn === turn)
}

/** Conservative walk of a Chat / Conversation snapshot for one turn's assistant text. */
export function answerTextFromSnapshot(snapshot: unknown, turn: number): string {
  if (!snapshot) return ''
  const found: string[] = []
  walk(snapshot, turn, found, 0)
  return found.sort((a, b) => b.length - a.length)[0] ?? ''
}

function walk(value: unknown, turn: number, found: string[], depth: number): void {
  if (depth > 8 || value == null) return
  if (Array.isArray(value)) {
    for (const item of value) walk(item, turn, found, depth + 1)
    return
  }
  if (!isRecord(value)) return
  const valueTurn = turnFromUnknown(value)
  if (valueTurn === turn || valueTurn === undefined) {
    const kind = typeof value.kind === 'string' ? value.kind : typeof value.type === 'string' ? value.type : ''
    const role = typeof value.role === 'string' ? value.role : ''
    if (/assistant/i.test(kind) || role === 'assistant' || kind === 'assistant-step') {
      const text = collectText(value)
      if (text) found.push(text)
    }
  }
  for (const key of ['nodes', 'entries', 'messages', 'turns', 'items', 'children', 'data']) {
    if (key in value) walk(value[key], turn, found, depth + 1)
  }
}
