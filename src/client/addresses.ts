/** Resource-address prefix of a turn's official `changes-review` tab. */
export const CHANGES_REVIEW_ADDRESS = 'dsh-resource://changes-review/session/'

export interface ChangesReviewCoordinates {
  sessionId: string
  seq: number
  turn: number
}

/**
 * Official review-tab address used by `@deepseek-ai/dsh-client-ui-deliverables`
 * and by session-rail: `dsh-resource://changes-review/session/<sessionId>/<seq>/<turn>`.
 * `seq` must be the turn's `workspace/changes` event sequence, not an arbitrary closing seq.
 */
export function changesReviewAddress(coordinates: ChangesReviewCoordinates): string {
  const { sessionId, seq, turn } = coordinates
  return `${CHANGES_REVIEW_ADDRESS}${encodeURIComponent(sessionId)}/${seq}/${turn}`
}
