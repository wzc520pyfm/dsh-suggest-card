---
name: dsh-suggest-card
description: Emit a wrap-up suggest-card payload at the end of a substantial turn when at least one legal next step is available.
when-to-use: Use when a main-session turn has a substantial wrap-up (code changes, finished checks, or a concrete follow-up) and you can propose at least one legal, executable action. Do not use for greetings, pure Q&A, dispatch, or clarification-only turns.
---

# dsh-suggest-card

When this main-session turn has a substantial wrap-up and you can propose at least one legal next step, append a structured payload after the visible answer. The plugin renders a card from that payload. Do not start another turn for the card.

本轮若有实质收尾，且你能提出至少一个合法、可执行的下一步，请在可见回答之后追加结构化卡片负荷，由插件渲染。不要为了出卡再另开一轮。

## Language / 语言

Write `summary`, `question`, and action `label` values in the current conversation / UI language. Do not default to English examples such as "Commit these changes?" unless the user is already working in English.

`summary`、`question` 与按钮 `label` 须跟随当前会话 / 界面语言生成，不要固定英文示例。

## When to emit / 何时输出

Emit only when all of these are true:

- The turn has a substantial wrap-up (you changed code, finished checks, or left a concrete follow-up).
- You can propose at least one legal, executable action from the whitelist below.
- You are reasonably confident the action is relevant.

Do **not** emit for greetings, pure dispatch/handoff, mere clarification, pure Q&A, turns with no workspace change and no follow-up task, or when no whitelist action fits. Never pad with Commit or Review just to show a card.

仅在「有实质收尾」且能提出至少一个白名单动作时输出。问候、纯派队、单纯澄清、纯问答、无工作区变更且无待跟进任务，或没有合适下一步时，不要出负荷，也不要硬推 Commit / Review。

## Format (required) / 格式

Prefer an HTML comment so the payload is less likely to appear in the visible answer. Put it at the very end of your reply, after the visible prose, with no extra commentary about the comment itself:

优先使用 HTML 注释，以降低负荷出现在可见正文中的可能。放在可见回答之后：

<!-- dsh-suggest-card
{
  "summary": "Short factual summary of this turn's work.",
  "question": "One guiding question about the recommended next step?",
  "actions": [
    { "type": "followup", "label": "Run the tests", "message": "Please run the tests and report the results." }
  ]
}
-->

If you cannot emit an HTML comment, use a closed fenced block tagged `dsh-suggest-card` containing the same JSON. HTML comments are preferred because a visible fence may leak into the answer body.

若无法使用 HTML 注释，可改用语言标记为 `dsh-suggest-card` 的代码围栏。围栏可能会出现在可见正文中，因此只作退路。

Do not print the JSON as ordinary prose. Do not invent fields.

不要把 JSON 当作普通正文打印，也不要编造字段。

## Action whitelist / 动作白名单

These are types you may choose from. They are not default buttons. Every turn may use a different subset, or none.

以下是可选类型，不是每轮默认按钮。

1. `followup` — required `label` and `message`. Clicking sends `message` as the user into this session. The label must clearly say what will be sent (for example "Run the tests"), never a vague "Follow up" / "跟进". Use this for running tests or any other request that is not a first-class type.
2. `commit` — required `label` only (for example "Commit"). The plugin sends this fixed request to the live Agent and does not run Git itself: `Commit the working tree changes with a sensible message.` Do not write Git commands for the plugin to execute. Omit this type when you have not changed the workspace, or when a commit would be inappropriate.
3. `review` — required `label` only (for example "Review the diff first"). The plugin opens the official changes-review page. Do not ask it to render a raw diff. Omit this type when there is nothing to review.

No other types exist in v0.1. Do not invent "open a file", "run tests", or "push" as first-class types.

v0.1 没有其他类型。不要把「打开某文件 / 跑测试 / 推远程」写成一等动作；跑测试请走 `followup`。

## Count and fields / 数量与字段

Provide 1 primary action, optionally 1 secondary, and at most 3 actions total, in priority order (primary first).

- `summary`: short factual wrap-up of this turn.
- `question`: one guiding question generated for this turn, not a fixed template.
- `actions[]`: whitelist objects as above.

主按钮 1 个，次按钮可选 1 个，最多 3 个，按优先级排列。
