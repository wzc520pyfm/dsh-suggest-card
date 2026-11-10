import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyEvent, isAssistantEvent, suggestTurnDefinition, type TurnRecord } from '../src/client/turn-model.ts'
import { changesReviewAddress } from '../src/client/addresses.ts'
import { classifySession, composerDraftText, isComposerEmpty } from '../src/client/session.ts'
import { collectText, turnFromUnknown } from '../src/shared/text.ts'

test('classifies sub-sessions conservatively', () => {
  assert.equal(classifySession({ id: 'a', parentSessionId: 'root' }, 'a'), 'sub')
  assert.equal(classifySession({ sessionId: 'child', kind: 'subagent' }, 'child'), 'sub')
  assert.equal(classifySession({ id: 'main' }, 'main'), 'main')
  assert.equal(classifySession(undefined, 'main'), 'unknown')
})

test('reads composer draft emptiness without guessing a missing shape', () => {
  assert.equal(isComposerEmpty({ text: '  ' }), true)
  assert.equal(isComposerEmpty({ draft: { text: 'hello' } }), false)
  assert.equal(composerDraftText({ editor: { value: 'x' } }), 'x')
  assert.equal(isComposerEmpty({ unknown: true }), undefined)
})

test('builds the official changes-review resource address', () => {
  assert.equal(
    changesReviewAddress({ sessionId: 'sess/1', seq: 42, turn: 3 }),
    'dsh-resource://changes-review/session/sess%2F1/42/3',
  )
})

test('folds assistant text and workspace/changes onto a turn record', () => {
  let state: TurnRecord = { turn: 2, answerText: '' }
  state = applyEvent(state, {
    type: 'assistant/message',
    seq: 10,
    data: { turn: 2, content: [{ type: 'text', text: 'Visible answer.' }] },
  })
  state = applyEvent(state, { type: 'workspace/changes', seq: 11, data: { turn: 2 } })
  state = applyEvent(state, { type: 'turn/end', seq: 12, data: { turn: 2 } })
  assert.equal(state.answerText, 'Visible answer.')
  assert.equal(state.changesSeq, 11)
  assert.equal(state.ended, true)
})

test('turn definition only matches events that carry a turn number', () => {
  assert.equal(suggestTurnDefinition.match({ type: 'assistant/message', seq: 1, data: { text: 'hi' } }), null)
  assert.deepEqual(
    suggestTurnDefinition.match({ type: 'turn/start', seq: 1, data: { turn: 4 } }),
    { id: '4', role: 'start' },
  )
  assert.equal(isAssistantEvent('assistant/message'), true)
  assert.equal(turnFromUnknown({ location: { turn: 7 } }), 7)
  assert.equal(collectText({ content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] }), 'A\nB')
})
