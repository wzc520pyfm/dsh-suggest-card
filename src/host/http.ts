export const MAX_BODY_BYTES = 32 * 1024

export interface RequestLike {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}

export interface ResponseLike {
  writeHead(status: number, headers: Record<string, string>): void
  end(body?: string): void
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function isSameOrigin(headers: Record<string, string | string[] | undefined>): boolean {
  const site = header(headers, 'sec-fetch-site').toLowerCase()
  const origin = header(headers, 'origin')
  const host = header(headers, 'host')
  if (!host || /[\r\n]/.test(host)) return false
  // Desktop bridges may strip browser origin headers after authenticating the renderer.
  if (!origin && !site) return true
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') return false
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.host.toLowerCase() === host.toLowerCase()
      && parsed.origin === origin.replace(/\/$/, '')
  } catch {
    return false
  }
}

export async function readJsonBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large', 'Request body is too large')
    chunks.push(bytes)
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object')
  }
  return value as Record<string, unknown>
}

export function sendJson(res: ResponseLike, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function sendError(res: ResponseLike, status: number, code: string, message: string): void {
  sendJson(res, status, { ok: false, error: { code, message } })
}
