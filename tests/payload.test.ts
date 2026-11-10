import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extractAnswerSummary,
  fillMissingSummary,
  filterActionsForWorkspace,
  filterReviewAvailability,
  normalizeAction,
  parseSuggestPayload,
  resolvePayload,
  stripPayloadMarkers,
} from '../src/shared/payload.ts'
import { COMMIT_INSTRUCTION } from '../src/shared/types.ts'

const sample = {
  summary: 'Updated the button styles and verified typecheck.',
  question: 'Commit these workspace changes?',
  actions: [
    { type: 'commit', label: 'Commit' },
    { type: 'review', label: 'Review the diff first' },
  ],
}

test('parses an HTML comment payload (path A)', () => {
  const text = `All tests passed.\n\n<!-- dsh-suggest-card\n${JSON.stringify(sample, null, 2)}\n-->`
  const payload = parseSuggestPayload(text)
  assert.ok(payload)
  assert.equal(payload.source, 'structured')
  assert.equal(payload.summary, sample.summary)
  assert.equal(payload.question, sample.question)
  assert.equal(payload.actions.length, 2)
  assert.equal(payload.actions[0]?.type, 'commit')
  assert.equal(payload.actions[1]?.type, 'review')
})

test('parses a fenced payload as a fallback', () => {
  const text = `Done.\n\n\`\`\`dsh-suggest-card\n${JSON.stringify(sample)}\n\`\`\``
  const payload = parseSuggestPayload(text)
  assert.ok(payload)
  assert.equal(payload.actions[0]?.label, 'Commit')
})

test('rejects a vague followup label and missing message', () => {
  assert.equal(normalizeAction({ type: 'followup', label: 'Follow up', message: 'Run tests' }), undefined)
  assert.equal(normalizeAction({ type: 'followup', label: '跟进', message: '继续' }), undefined)
  assert.equal(normalizeAction({ type: 'followup', label: 'Run the tests' }), undefined)
  const action = normalizeAction({ type: 'followup', label: 'Run the tests', message: 'Please run the tests.' })
  assert.deepEqual(action, { type: 'followup', label: 'Run the tests', message: 'Please run the tests.' })
})

test('truncates to at most three actions in listed order', () => {
  const payload = parseSuggestPayload(`<!-- dsh-suggest-card ${JSON.stringify({
    summary: 'Worked on tests.',
    question: 'Run the new tests now?',
    actions: [
      { type: 'followup', label: 'Run the tests', message: 'Run the tests.' },
      { type: 'review', label: 'Review the diff first' },
      { type: 'commit', label: 'Commit' },
      { type: 'followup', label: 'Add more tests', message: 'Please add more tests.' },
    ],
  })} -->`)
  assert.equal(payload?.actions.length, 3)
  assert.equal(payload?.actions[0]?.type, 'followup')
  assert.equal(payload?.actions[2]?.type, 'commit')
})

test('does not invent commit or review when no legal actions exist', () => {
  const text = 'Hello! How can I help you today?'
  assert.equal(parseSuggestPayload(text), undefined)
  assert.equal(resolvePayload(text), undefined)
})

test('path B can fill a missing summary but still requires a question and actions', () => {
  const body = 'Refactored the parser and left the working tree dirty.\n\n<!-- dsh-suggest-card\n{"question":"Review the diff first?","actions":[{"type":"review","label":"Review the diff first"}]}\n-->'
  const payload = resolvePayload(body)
  assert.ok(payload)
  assert.equal(payload.source, 'extracted')
  assert.match(payload.summary, /Refactored the parser/)
  assert.equal(payload.actions[0]?.type, 'review')
  assert.equal(fillMissingSummary({ question: 'Go?' }, 'Summary only'), undefined)
})

test('strips payload markers from visible summary text', () => {
  const text = `Visible prose.\n<!-- dsh-suggest-card ${JSON.stringify(sample)} -->`
  assert.equal(stripPayloadMarkers(text), 'Visible prose.')
  assert.equal(extractAnswerSummary(text), 'Visible prose.')
})

test('hides commit and review when the tree is known clean', () => {
  const actions = [
    { type: 'commit' as const, label: 'Commit' },
    { type: 'followup' as const, label: 'Run the tests', message: 'Run the tests.' },
  ]
  const filtered = filterActionsForWorkspace(actions, 'clean')
  assert.deepEqual(filtered, [actions[1]])
  assert.deepEqual(filterActionsForWorkspace(actions, 'unknown'), actions)
})

test('omits review when the official page coordinates are unavailable', () => {
  const actions = [
    { type: 'review' as const, label: 'Review the diff first' },
    { type: 'followup' as const, label: 'Run the tests', message: 'Run the tests.' },
  ]
  assert.deepEqual(filterReviewAvailability(actions, false), [actions[1]])
})

test('commit request text stays the session-rail fixed instruction', () => {
  assert.equal(COMMIT_INSTRUCTION, 'Commit the working tree changes with a sensible message.')
})
