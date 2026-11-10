import { COMMIT_INSTRUCTION, SKILL_NAME } from '../shared/types.ts'

export const SKILL_DESCRIPTION = 'Emit a wrap-up suggest-card payload at the end of a substantial turn when at least one legal next step is available.'

export const SKILL_WHEN_TO_USE = 'Use when a main-session turn has a substantial wrap-up (code changes, finished checks, or a concrete follow-up) and you can propose at least one legal, executable action. Do not use for greetings, pure Q&A, dispatch, or clarification-only turns.'

export function skillContent(): string {
  return `# dsh-suggest-card

When this main-session turn has a substantial wrap-up and you can propose at least one legal next step, append a structured payload after the visible answer. The plugin renders a card from that payload. Do not start another turn for the card.

## Language

Write \`summary\`, \`question\`, and action \`label\` values in the current conversation / UI language. Do not default to English examples such as "Commit these changes?" unless the user is already working in English.

## When to emit

Emit only when all of these are true:

- The turn has a substantial wrap-up (you changed code, finished checks, or left a concrete follow-up).
- You can propose at least one legal, executable action from the whitelist below.
- You are reasonably confident the action is relevant.

Do **not** emit for greetings, pure dispatch/handoff, mere clarification, pure Q&A, turns with no workspace change and no follow-up task, or when no whitelist action fits. Never pad with Commit or Review just to show a card.

## Format (required)

Prefer an HTML comment so the payload is less likely to appear in the visible answer. Put it at the very end of your reply, after the visible prose, with no extra commentary about the comment itself:

<!-- dsh-suggest-card
{
  "summary": "Short factual summary of this turn's work.",
  "question": "One guiding question about the recommended next step?",
  "actions": [
    { "type": "followup", "label": "Run the tests", "message": "Please run the tests and report the results." }
  ]
}
-->

If you cannot emit an HTML comment, use a closed fenced block tagged \`dsh-suggest-card\` containing the same JSON. HTML comments are preferred because a visible fence may leak into the answer body.

Do not print the JSON as ordinary prose. Do not invent fields.

## Action whitelist (choose, do not default)

These are types you may choose from. They are not default buttons. Every turn may use a different subset, or none.

1. \`followup\` — required \`label\` and \`message\`. Clicking sends \`message\` as the user into this session. The label must clearly say what will be sent (for example "Run the tests"), never a vague "Follow up" / "跟进". Use this for running tests or any other request that is not a first-class type.
2. \`commit\` — required \`label\` only (for example "Commit"). The plugin sends this fixed request to the live Agent and does not run Git itself: \`${COMMIT_INSTRUCTION}\` Do not write Git commands for the plugin to execute. Omit this type when you have not changed the workspace, or when a commit would be inappropriate.
3. \`review\` — required \`label\` only (for example "Review the diff first"). The plugin opens the official changes-review page. Do not ask it to render a raw diff. Omit this type when there is nothing to review.

No other types exist in v0.1. Do not invent "open a file", "run tests", or "push" as first-class types.

## Count and priority

Provide 1 primary action, optionally 1 secondary, and at most 3 actions total. List them in priority order (primary first). The plugin truncates extras.

## Fields

- \`summary\`: short factual wrap-up of this turn (what changed, what was checked, what is still open).
- \`question\`: one guiding question, generated for this turn, not a fixed template.
- \`actions[]\`: whitelist objects as above.
`
}

/** Short system-prompt convention. Kept brief to limit tokens; details live in the skill. */
export function systemPromptSectionText(): string {
  return [
    `When a main-session turn has a substantial wrap-up and you can propose at least one legal next step, append a ${SKILL_NAME} payload after the visible answer (prefer an HTML comment \`<!-- dsh-suggest-card ... -->\` containing JSON with summary, question, and actions).`,
    'Write summary, question, and labels in the current conversation language.',
    'Allowed action types only: followup (label + message that will be sent as the user; the label must say what will be sent), commit (label only; the plugin sends a fixed commit-request message and never runs Git itself), review (label only; opens official changes-review).',
    'Do not emit a payload for greetings, pure Q&A, dispatch, or clarification-only turns, and do not pad with commit or review. At most 3 actions, primary first.',
    `Load the ${SKILL_NAME} skill for the exact JSON shape. Do not print the payload as ordinary prose, and do not start another turn to generate the card.`,
  ].join(' ')
}
