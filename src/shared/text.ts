import { isRecord } from './payload.ts'

/** Best-effort extraction of visible assistant text from an unknown event or snapshot. */
export function collectText(value: unknown, depth = 0): string {
  if (depth > 8 || value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => collectText(item, depth + 1)).filter(Boolean).join('\n')
  if (!isRecord(value)) return ''
  if (value.type === 'text' && typeof value.text === 'string') return value.text
  const directKeys = ['text', 'content', 'rawText', 'message', 'output', 'body']
  const parts: string[] = []
  for (const key of directKeys) {
    if (key in value) {
      const piece = collectText(value[key], depth + 1)
      if (piece) parts.push(piece)
    }
  }
  if (parts.length > 0) return parts.join('\n')
  if (Array.isArray(value.blocks)) return collectText(value.blocks, depth + 1)
  if (Array.isArray(value.parts)) return collectText(value.parts, depth + 1)
  return ''
}

export function turnFromUnknown(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) return value
  if (!isRecord(value)) return undefined
  for (const key of ['turn', 'index', 'number', 'id', 'location', 'header']) {
    const inner = value[key]
    if (typeof inner === 'number' && Number.isSafeInteger(inner) && inner >= 1) return inner
    if (isRecord(inner)) {
      const nested = turnFromUnknown(inner)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}
