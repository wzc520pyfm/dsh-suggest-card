import { API_PREFIX, COMMIT_INSTRUCTION, PLUGIN_ID, SKILL_NAME } from '../shared/types.ts'
import { SKILL_DESCRIPTION, SKILL_WHEN_TO_USE, skillContent, systemPromptSectionText } from './guidance.ts'
import { workspaceDirtiness, type SessionLike } from './git-status.ts'
import { header, HttpError, isSameOrigin, readJsonBody, sendError, sendJson, type RequestLike, type ResponseLike } from './http.ts'

export const name = PLUGIN_ID
export const inject = ['webServer', 'sessions', 'agents', 'skills', 'systemPrompt']

interface UserMessage {
  id: string
  role: 'user'
  content: readonly [{ type: 'text'; text: string }]
  source: { kind: 'user' }
}

interface HostContext {
  effect?(callback: () => void | (() => void), label?: string): void
  webServer?: { register(route: { kind: string; path: string; handler: (req: RequestLike, res: ResponseLike) => Promise<void> | void }): () => void }
  sessions?: { get(id: string): SessionLike | undefined | null }
  agents?: { get(id: string): { followup?: (message: UserMessage) => void } | undefined | null }
  skills?: {
    register?(skill: {
      name: string
      description: string
      whenToUse?: string
      content: string
      source?: string
      invocation?: { modelInvocable: boolean; userInvocable: boolean }
    }): () => void
  }
  systemPrompt?: {
    section?(section: { name: string; order: number; text: string; interpolate?: boolean }): () => void
  }
}

export function apply(ctx: HostContext): void {
  const registerRoutes = () => {
    if (!ctx.webServer?.register) return () => undefined
    return ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: (req, res) => route(ctx, req, res),
    })
  }
  const registerSkill = () => {
    if (!ctx.skills?.register) return () => undefined
    return ctx.skills.register({
      name: SKILL_NAME,
      description: SKILL_DESCRIPTION,
      whenToUse: SKILL_WHEN_TO_USE,
      content: skillContent(),
      source: 'runtime',
      invocation: { modelInvocable: true, userInvocable: true },
    })
  }
  const registerPrompt = () => {
    if (!ctx.systemPrompt?.section) return () => undefined
    return ctx.systemPrompt.section({
      name: 'dsh-suggest-card:convention',
      order: 8600,
      interpolate: false,
      text: systemPromptSectionText(),
    })
  }
  if (ctx.effect) {
    ctx.effect(registerRoutes, 'dsh-suggest-card: routes')
    ctx.effect(registerSkill, 'dsh-suggest-card: skill')
    ctx.effect(registerPrompt, 'dsh-suggest-card: system-prompt')
  } else {
    registerRoutes()
    registerSkill()
    registerPrompt()
  }
}

async function route(ctx: HostContext, req: RequestLike, res: ResponseLike): Promise<void> {
  if (!isSameOrigin(req.headers)) { sendError(res, 403, 'cross_origin', 'Cross-origin requests are refused'); return }
  if (String(req.method ?? '').toUpperCase() !== 'POST') { sendError(res, 405, 'method_not_allowed', 'Only POST is supported'); return }
  if (!/^application\/json(?:\s*;|$)/i.test(header(req.headers, 'content-type'))) {
    sendError(res, 415, 'json_required', 'Content-Type must be application/json')
    return
  }
  try {
    const url = new URL(req.url ?? '/', 'http://dsh.local')
    const body = await readJsonBody(req as unknown as NodeJS.ReadableStream)
    const sessionId = readSessionId(body.sessionId)
    const session = ctx.sessions?.get(sessionId)
    if (!session) throw new HttpError(404, 'session_not_found', 'Session was not found')
    if (url.pathname === `${API_PREFIX}/workspace-status`) {
      const status = await workspaceDirtiness(session)
      sendJson(res, 200, { ok: true, data: { status } })
      return
    }
    if (url.pathname === `${API_PREFIX}/followup`) {
      const text = readFollowupText(body.text)
      await sendFollowup(ctx, sessionId, text)
      sendJson(res, 200, { ok: true, data: { accepted: true } })
      return
    }
    if (url.pathname === `${API_PREFIX}/commit-request`) {
      await sendFollowup(ctx, sessionId, COMMIT_INSTRUCTION)
      sendJson(res, 200, { ok: true, data: { accepted: true } })
      return
    }
    sendError(res, 404, 'route_not_found', 'Route was not found')
  } catch (error) {
    if (error instanceof HttpError) { sendError(res, error.status, error.code, error.message); return }
    sendError(res, 500, 'request_failed', 'The request failed')
  }
}

function readSessionId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 512) {
    throw new HttpError(400, 'invalid_session_id', 'A valid sessionId is required')
  }
  return value.trim()
}

function readFollowupText(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_text', 'A message is required')
  const text = value.trim()
  if (!text) throw new HttpError(400, 'invalid_text', 'A message is required')
  if (text.length > 8000) throw new HttpError(400, 'invalid_text', 'The message is too long')
  return text
}

async function sendFollowup(ctx: HostContext, sessionId: string, text: string): Promise<void> {
  const agent = ctx.agents?.get(sessionId)
  if (typeof agent?.followup !== 'function') {
    throw new HttpError(409, 'agent_unavailable', 'No active agent is available for this session')
  }
  const message: UserMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
  try { agent.followup(message) }
  catch { throw new HttpError(503, 'agent_followup_failed', 'Agent could not accept the message') }
}
