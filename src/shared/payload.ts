import {
  MAX_ACTIONS,
  type PayloadSource,
  type SuggestAction,
  type SuggestCardPayload,
} from './types.ts'

const GENERIC_FOLLOWUP_LABEL = /^(follow[\s-]?up|next step|下一步|跟进|继续)$/i
const HTML_COMMENT = /<!--\s*dsh-suggest-card\b([\s\S]*?)-->/i
const FENCED_BLOCK = /```(?:dsh-suggest-card|suggest-card)\s*\r?\n([\s\S]*?)```/i
const MAX_SUMMARY = 800
const MAX_QUESTION = 240
const MAX_LABEL = 80
const MAX_MESSAGE = 8000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stripPayloadMarkers(text: string): string {
  return text.replace(HTML_COMMENT, '').replace(FENCED_BLOCK, '').trim()
}

export function extractAnswerSummary(text: string, limit = 400): string | undefined {
  const cleaned = collapseWhitespace(stripPayloadMarkers(text))
  if (!cleaned) return undefined
  if (cleaned.length <= limit) return cleaned
  const slice = cleaned.slice(0, limit - 1)
  const boundary = slice.lastIndexOf(' ')
  return `${(boundary > 80 ? slice.slice(0, boundary) : slice).trimEnd()}…`
}

export function parseSuggestPayload(raw: string, source: PayloadSource = 'structured'): SuggestCardPayload | undefined {
  const extracted = extractRawPayload(raw)
  if (!extracted) return undefined
  return normalizePayload(extracted.value, extracted.source === 'structured' ? source : extracted.source)
}

function extractRawPayload(raw: string): { value: unknown; source: PayloadSource } | undefined {
  const comment = raw.match(HTML_COMMENT)
  if (comment?.[1]) {
    const value = parseJsonish(comment[1])
    if (value !== undefined) return { value, source: 'structured' }
  }
  const fenced = raw.match(FENCED_BLOCK)
  if (fenced?.[1]) {
    const value = parseJsonish(fenced[1])
    if (value !== undefined) return { value, source: 'structured' }
  }
  return undefined
}

export function parseJsonish(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try { return JSON.parse(trimmed) } catch { /* try to recover a JSON object */ }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try { return JSON.parse(trimmed.slice(start, end + 1)) } catch { return undefined }
}

export function normalizePayload(value: unknown, source: PayloadSource): SuggestCardPayload | undefined {
  if (!isRecord(value)) return undefined
  const summary = optionalText(value.summary, MAX_SUMMARY)
  const question = optionalText(value.question ?? value.prompt ?? value.guidingQuestion, MAX_QUESTION)
  const actions = normalizeActions(value.actions ?? value.nextSteps)
  if (!summary || !question || actions.length === 0) return undefined
  return { summary, question, actions, source }
}

export function fillMissingSummary(
  partial: unknown,
  summary: string | undefined,
  source: PayloadSource = 'extracted',
): SuggestCardPayload | undefined {
  if (!summary) return undefined
  if (isRecord(partial)) {
    return normalizePayload({ ...partial, summary: optionalText(partial.summary, MAX_SUMMARY) ?? summary }, source)
  }
  return undefined
}

export function normalizeActions(value: unknown): SuggestAction[] {
  if (!Array.isArray(value)) return []
  const actions: SuggestAction[] = []
  for (const item of value) {
    if (actions.length >= MAX_ACTIONS) break
    const action = normalizeAction(item)
    if (action) actions.push(action)
  }
  return actions
}

export function normalizeAction(value: unknown): SuggestAction | undefined {
  if (!isRecord(value)) return undefined
  const type = normalizeType(value.type ?? value.kind ?? value.action)
  const label = optionalText(value.label ?? value.title ?? value.text, MAX_LABEL)
  if (!type || !label) return undefined
  if (type === 'followup') {
    if (GENERIC_FOLLOWUP_LABEL.test(label)) return undefined
    const message = optionalText(value.message ?? value.text ?? value.prompt, MAX_MESSAGE)
    if (!message) return undefined
    return { type, label, message }
  }
  if (type === 'commit') return { type, label }
  if (type === 'review') return { type, label }
  return undefined
}

function normalizeType(value: unknown): SuggestAction['type'] | undefined {
  if (typeof value !== 'string') return undefined
  const type = value.trim().toLowerCase()
  if (type === 'followup' || type === 'follow-up' || type === 'message' || type === 'send') return 'followup'
  if (type === 'commit' || type === 'commit-request' || type === 'commit_request') return 'commit'
  if (type === 'review' || type === 'changes-review' || type === 'changes_review' || type === 'diff') return 'review'
  return undefined
}

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = collapseWhitespace(value)
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function filterActionsForWorkspace(
  actions: readonly SuggestAction[],
  dirty: WorkspaceFilter,
): SuggestAction[] {
  if (dirty !== 'clean') return [...actions]
  return actions.filter((action) => action.type !== 'commit' && action.type !== 'review')
}

export type WorkspaceFilter = 'clean' | 'dirty' | 'unknown'

export function filterReviewAvailability(
  actions: readonly SuggestAction[],
  reviewAvailable: boolean,
): SuggestAction[] {
  if (reviewAvailable) return [...actions]
  return actions.filter((action) => action.type !== 'review')
}


/** Path A when the payload is complete; path B may fill a missing summary from visible prose. */
export function resolvePayload(rawAnswer: string): SuggestCardPayload | undefined {
  if (!rawAnswer) return undefined
  const structured = parseSuggestPayload(rawAnswer, 'structured')
  if (structured) return structured
  const match = rawAnswer.match(HTML_COMMENT) ?? rawAnswer.match(FENCED_BLOCK)
  if (!match?.[1]) return undefined
  return fillMissingSummary(parseJsonish(match[1]), extractAnswerSummary(rawAnswer), 'extracted')
}
