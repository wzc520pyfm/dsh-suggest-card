# dsh-suggest-card

English | [中文](#中文)

A DeepSeek Harness (DSH) **Web** plugin. After a main-session turn ends with a substantial wrap-up, it shows a dismissible card under that turn’s answer: a short summary, one guiding question, and one to three model-chosen next steps.

This is an **independent** plugin. It does **not** register as a kind of official `@deepseek-ai/dsh-action-cards`, and it does not implement a hybrid division of labor with that package.

Status: **not published to npm**. Install from this GitHub repository or from a pull-request branch (see below). Do not treat `0.1.0` in `package.json` as a formal release.

## Install and try

Requires a DSH Web profile and [pnpm](https://pnpm.io/) on `PATH`. Official plugin install is `dsh plugin --profile <name> add <package>` ([CLI reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)).

From a local checkout of this branch:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-suggest-card
```

From GitHub (not on npm yet). pnpm 10+ may refuse the package `prepare` script until you allow it for this package in that profile’s `pnpm-workspace.yaml` (`allowBuilds.dsh-suggest-card: true`) and re-run `add`. Prefer a pinned commit:

```bash
dsh plugin --profile web add github:wzc520pyfm/dsh-suggest-card#<commit-sha>
```

Then start or restart `dsh web`. Confirm the bundle layer with `dsh --profile web --dump-config` if needed.

Uninstall:

```bash
dsh plugin --profile web remove dsh-suggest-card
```

## When the card appears

The card is shown only when **all** of these hold:

- v0.1 is **main session** only. Sub-sessions are not promised the same behavior. The plugin tries to hide the card when the Session snapshot looks like a child / sub-agent; that detection is best-effort (see limitations).
- The turn has a structured payload (path A) or a recoverable payload whose missing summary can be filled from the visible answer (path B), **and** at least one legal, executable whitelist action remains after validation.
- The user has not closed the card for this turn.

The card is **not** shown for greetings, pure dispatch, mere clarification, pure Q&A, low-confidence or unparsable actions, actions outside the whitelist, missing required fields, or when every proposed action is unavailable. The plugin never pads with Commit or Review.

Closing (the × button) hides the card for **this turn only** (remembered in `sessionStorage` for the current tab). v0.1 has no “don’t show again in this session” or global toggle.

## How the summary is obtained

- **Path A (default):** a packaged Skill (`dsh-suggest-card`) plus a short system-prompt convention ask the model to append a structured payload at the end of this turn. The plugin parses it and renders the card. It does **not** start another model turn.
- **Path B (fallback):** if the payload is present but the summary is missing, the plugin builds a short summary from the visible answer (payload markers stripped). If there is no legal action, there is no card. Path B does not invent Commit / Review.
- **Path C** (a follow-up generation turn after the original turn) is **off** and is not implemented as a v0.1 default.

Preferred payload shape — an HTML comment, so it is less likely to appear in the visible answer:

```html
<!-- dsh-suggest-card
{
  "summary": "Short factual summary of this turn's work.",
  "question": "One guiding question about the recommended next step?",
  "actions": [
    { "type": "followup", "label": "Run the tests", "message": "Please run the tests and report the results." }
  ]
}
-->
```

A closed `dsh-suggest-card` fence is also accepted, but it may leak into the visible answer (see limitations). `summary`, `question`, and labels must be generated in the current conversation / UI language.

The Skill file lives at `skills/dsh-suggest-card/SKILL.md` and is also registered at runtime with `ctx.skills.register` when that Host service is available.

## Action whitelist

These are types the model may choose. They are **not** default buttons for every turn.

| Type | Click | Notes |
| --- | --- | --- |
| `followup` | Sends the model-provided `message` as the user into this session via the Host `Agent.followup` path (same message shape as session-rail). The plugin does not run other commands. | `label` must clearly say what will be sent (e.g. “Run the tests”). Vague labels such as “Follow up” are rejected. |
| `commit` | Sends only this fixed text to the Session’s live Agent: `Commit the working tree changes with a sensible message.` | Reuses session-rail’s request-message strategy. This plugin does **not** stage, commit, push, or edit files, and does not execute model-written Git commands. session-rail is **not** a hard dependency. |
| `review` | Opens the official `changes-review` page with `sidebarRight.openResource` and `dsh-resource://changes-review/session/<sessionId>/<seq>/<turn>`, where `seq` is that turn’s `workspace/changes` event sequence ([ui-deliverables](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-deliverables/README.md), also used by session-rail). | No custom raw diff. If the official page or its coordinates are unavailable, the action is omitted and a short hint may be shown. |

No other types in v0.1. “Run the tests” and similar requests go through `followup`.

Count: 1 primary (solid) + optional secondary (outlined), at most 3 actions. Extras are truncated in listed order. Click executes immediately; the card’s summary + question is the confirmation surface (no second dialog).

If the Host can read Git working-tree dirtiness (`git status --porcelain` in the Session cwd) and the tree is **clean**, commit and review actions are hidden. If dirtiness cannot be read, the plugin does **not** guess that changes exist; the model may still propose those actions. “The workspace has changes” is not a verified fact in that case.

## Shortcuts, language, and accessibility

- The shortcut runs **the current card’s primary action** (not a Commit-only binding).
- Visible hint on the primary button: `⌘↩` on macOS, `Ctrl+Enter` otherwise.
- v0.1 does **not** steal the composer send key. The shortcut is active only while the card itself is focused **and** the composer draft is known to be empty. If the draft cannot be read, the shortcut does not run.
- Plugin chrome (close label, unavailable hints, language control, Skill docs) ships English-first with a Chinese toggle. Card summary / question / labels come from the model in the current language.

Close and action buttons are keyboard-reachable and have textual accessible names.

## Insertion point

The card registers as a list entry on the official `conversation.chat.turnTail` slot ([Web Client Slots](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/slots), declared in `@deepseek-ai/dsh-client-ui-chat`). That list sits on the completed-turn tail, under the answer and before the assistant action row. Official deliverables, plan cards, and `@deepseek-ai/dsh-client-ui-action-cards` also contribute to the same list, so another card may appear in the same area. v0.1 does not force mutual exclusion.

This plugin is a DSH Web plugin only. It is not shipped inside [session-rail](https://github.com/wzc520pyfm/session-rail) or `dsh-new-workspace`.

## Overlap with official action-cards

If `@deepseek-ai/dsh-action-cards` (and its browser half) is enabled, a turn may show both that official card and this wrap-up card. They are different products: official kinds today lean toward personalized / plugin recommendations, while this card is a per-turn work summary plus model-chosen next steps. You can leave both installed; uninstall one if the overlap is noisy.

## Known limitations (not verified in a live DSH profile by this change)

These items were checked against official public docs and existing public practice. Where something could not be confirmed end-to-end, the plugin degrades and this section tells you so. None of the following is claimed as a verified runtime fact:

- **Assistant text association.** Path A/B parse text folded from `assistant/message` (and similar) events that carry a turn number, with a conservative walk of the Chat snapshot as backup. If a given DSH version’s events omit the turn, or the text shape differs, the card may not appear even when the model appended a payload.
- **Payload leaking into the visible answer.** HTML comments are preferred because many Markdown renderers strip them. A `dsh-suggest-card` fence, or a renderer that displays HTML comments, may still show the JSON in the answer body. This plugin does not replace the official assistant Markdown renderer to guarantee hiding.
- **Structured-payload stability.** Whether models reliably emit the convention (and load the Skill) is unverified. Path C is not used to compensate.
- **`workspace/changes` sequence.** Review opens only when this plugin has folded a `workspace/changes` sequence for that turn. The completed-turn tail’s own `seq` is **not** used as a substitute, because official practice treats the changes-event sequence as the review address. No announcement means no review action.
- **Dirty-tree reads.** Dirtiness is a Host `git status --porcelain` of the Session `header.cwd` (or `cwd`). Failures (no cwd, missing git, not a repo) are treated as unreadable — not as “clean” or “dirty”.
- **Main vs sub-session.** Suppression of sub-sessions is a best-effort read of common parent / sub-agent fields on the Session snapshot. Unrecognized shapes are not silently documented as “main-session only works everywhere”.
- **Composer send-key conflict.** Official send may also be `⌘↩` / `Ctrl+Enter`. The shortcut is intentionally narrow (card focus + known-empty draft). If `useInput` does not expose a recognizable draft field, the shortcut never fires.
- **Skill / system-prompt registration.** The Host plugin registers a runtime skill and a short `ctx.systemPrompt.section` when those services exist. If a profile does not provide them, only a checkout-level `SKILL.md` remains; the model may not see the convention.
- **Follow-up delivery** uses `agents.get(sessionId).followup(userMessage)` on the Host, following session-rail. If no live Agent is present, the card shows an error and does not claim the message was sent.

## License

MIT

---

## 中文

DSH **Web** 插件：主会话在有实质收尾的回合结束后，于该轮回答下方显示一张可关闭的收尾卡——上方是本轮摘要，中间是引导问句，下方是模型按本轮内容选择的可点击下一步。

这是**独立插件**，不会注册为官方 `@deepseek-ai/dsh-action-cards` 的一种 kind，也不与它做混合分工。

当前**尚未发布到 npm**。请从本 GitHub 仓库或 PR 分支安装。`package.json` 中的 `0.1.0` 不是正式发版。

### 安装与试用

```bash
dsh plugin --profile web add /absolute/path/to/dsh-suggest-card
# 或（需允许该包的 prepare 构建脚本，并建议钉死 commit）
dsh plugin --profile web add github:wzc520pyfm/dsh-suggest-card#<commit-sha>
```

然后启动或重启 `dsh web`。卸载：`dsh plugin --profile web remove dsh-suggest-card`。

### 出卡策略

仅在「有实质收尾」且解析到至少一个合法、可执行的白名单动作时出卡；没有合适下一步就不出卡，不会硬推 Commit / Review。v0.1 先只做主会话；关闭后本轮不再出现（只记本轮关闭，不跨会话禁用整个产品）。

摘要默认走路径 A（本轮末尾的结构化负荷，Skill + 系统提示约定；不再另发起一轮）。失败时路径 B 可用可见回答补摘要，但仍然必须已有合法动作。路径 C（回合后再调一轮生成卡片）默认关闭，且未作为 v0.1 默认实现。

### 动作白名单

- **发跟进消息**（`followup`）：把模型给定的消息作为用户转发到本会话。标签必须清楚说出会发什么。
- **提交请求消息**（`commit`）：只把固定文案 `Commit the working tree changes with a sensible message.` 发给该 Session 的直播 Agent。插件本身不直接改 git，也不把 session-rail 做成硬依赖。
- **打开官方 changes-review**（`review`）：通过 `openResource` 打开官方审查页；不自绘 raw diff。页面或坐标不可用时省略该动作或给出提示。

主按钮 1 个（实心）+ 次按钮（描边），最多 3 个；点击即执行，卡上的摘要 + 引导问句视为确认面。若能读到工作区干净，则尽量不展示提交 / 审查类动作；读不到时不猜测「已有变更」。

### 快捷键与语言

快捷键绑定「当前卡的主动作」，仅在卡获焦且能确认输入框为空时生效，默认不抢输入框发送键。插件后退文案提供 EN / 中文切换；卡上摘要、问句与按钮标签由模型按当前语言生成。

### 已知限制

插入点是官方已文档化的 `conversation.chat.turnTail` 列表，位于已完成回合的回答下方。与官方 action-cards、交付卡片等可能视觉重叠，v0.1 不强制互斥。助理文本与 `workspace/changes` 序号的折叠、负荷是否漏进可见正文、脏工作区能否读到、子会话识别、发送键冲突、Skill / 系统提示是否被目标版本加载，均需在目标 DSH 版本上再核验；做不到时会降级，不要把这些写成已验证事实。
