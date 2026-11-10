import { API_PREFIX } from '../shared/types.ts'
import type { ApiEnvelope, ApiErrorEnvelope, FollowupResult, WorkspaceStatusResult } from '../shared/types.ts'

export class SuggestApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'SuggestApiError'
  }
}

async function post<T>(path: string, payload: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_PREFIX}/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let value: ApiEnvelope<T> | ApiErrorEnvelope
  try { value = await response.json() as ApiEnvelope<T> | ApiErrorEnvelope }
  catch { throw new SuggestApiError('invalid_response', `Request failed (${response.status})`) }
  if (!response.ok || !value.ok) {
    const error = value.ok ? undefined : value.error
    throw new SuggestApiError(error?.code ?? 'request_failed', error?.message ?? `Request failed (${response.status})`)
  }
  return value.data
}

export const getWorkspaceStatus = (sessionId: string, signal?: AbortSignal) =>
  post<WorkspaceStatusResult>('workspace-status', { sessionId }, signal)

export const sendFollowup = (sessionId: string, text: string, signal?: AbortSignal) =>
  post<FollowupResult>('followup', { sessionId, text }, signal)

export const requestCommit = (sessionId: string, signal?: AbortSignal) =>
  post<FollowupResult>('commit-request', { sessionId }, signal)
