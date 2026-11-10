export const PLUGIN_ID = 'dsh-suggest-card'
export const API_PREFIX = '/api/dsh-suggest-card'
export const COMMIT_INSTRUCTION = 'Commit the working tree changes with a sensible message.'
export const MAX_ACTIONS = 3
export const SKILL_NAME = 'dsh-suggest-card'
export const LOCALE_STORAGE_KEY = 'dsh-suggest-card.locale'
export const DISMISS_STORAGE_PREFIX = 'dsh-suggest-card.dismissed:'

export type UiLocale = 'en' | 'zh'
export type ActionType = 'followup' | 'commit' | 'review'
export type PayloadSource = 'structured' | 'extracted'

export interface FollowupAction {
  readonly type: 'followup'
  readonly label: string
  readonly message: string
}

export interface CommitAction {
  readonly type: 'commit'
  readonly label: string
}

export interface ReviewAction {
  readonly type: 'review'
  readonly label: string
}

export type SuggestAction = FollowupAction | CommitAction | ReviewAction

export interface SuggestCardPayload {
  readonly summary: string
  readonly question: string
  readonly actions: readonly SuggestAction[]
  readonly source: PayloadSource
}

export interface ApiEnvelope<T> {
  readonly ok: true
  readonly data: T
}

export interface ApiErrorEnvelope {
  readonly ok: false
  readonly error: { readonly code: string; readonly message: string }
}

export interface FollowupResult {
  readonly accepted: true
}

export type WorkspaceDirtiness =
  | { readonly readable: true; readonly dirty: boolean }
  | {
    readonly readable: false
    readonly reason: 'no-cwd' | 'directory-missing' | 'not-repository' | 'git-unavailable' | 'error'
  }

export interface WorkspaceStatusResult {
  readonly status: WorkspaceDirtiness
}
