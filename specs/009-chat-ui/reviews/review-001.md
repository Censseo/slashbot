# Code Review: Chat UI (009-chat-ui)

**Reviewer**: Claude Code (implementer agent)
**Date**: 2026-03-09
**Branch**: `009-chat-ui`
**Files reviewed**:
- `frontend/public/index.html`
- `frontend/public/js/chat.js`
- `frontend/public/js/sse-client.js`
- `frontend/public/css/app.css`
- `tests/frontend/sse-client.test.ts`

---

## Health Score: 71 / 100

The implementation is functionally complete for all 8 phases and covers the happy path well. The primary deductions are: a medium-severity XSS gap in Markdown rendering, a missing SSE `error` event type, an ID collision risk in message creation, and several lower-priority accessibility and CSS inconsistencies.

---

## Issues

### CRITICAL

None.

---

### HIGH

#### H-001 — XSS: `marked.parse()` output injected via `x-html` without sanitization

**File**: `frontend/public/js/chat.js:153-154`, `frontend/public/index.html:155-156`

**Description**: `renderMarkdown()` calls `marked.parse(text)` and stores the raw HTML in `part.html`, which is then injected via Alpine's `x-html="part.html"`. The `marked` library by default does **not** sanitize HTML — it passes raw HTML tags through. If the LLM response or a tool result text contains `<script>` tags or malicious `<img onerror=...>` payloads, they will execute in the user's browser.

The spec (T009) explicitly calls for "HTML escaping enabled (XSS mitigation per spec §Security)" but no sanitizer (`DOMPurify` or equivalent) is wired in. The `marked.setOptions({ sanitize: true })` API was removed in marked v5; the only correct mitigation is a post-parse sanitizer.

**Impact**: Remote code execution in the chat UI from a malicious model response or compromised backend.

**Fix**: Run `marked.parse()` output through `DOMPurify.sanitize()` before storing it in `part.html`. Add `DOMPurify` from CDN alongside `marked`.

---

#### H-002 — Missing `error` SSE event handler in `sse-client.js`

**File**: `frontend/public/js/sse-client.js:116-132`

**Description**: The API contract (`contracts/api.md`) lists five consumed SSE events:

> `text-delta`, `tool-call-start`, `tool-call-result`, `done`, **`error`**

The `_processLine` switch statement handles the first four but has no `case 'error':` branch. An `error` event from the server (e.g. `{"type":"error","message":"LLM quota exceeded"}`) falls through to the `default:` case and is silently discarded. The user sees no error and the stream simply stops — the spinner keeps running until a network timeout.

**Fix**: Add a `case 'error':` branch that calls `onError(event.message || 'Server error')`. Add a corresponding test.

---

### MEDIUM

#### M-001 — Message ID collision: `Date.now()` and `Date.now() + 1`

**File**: `frontend/public/js/chat.js:29,37`

```javascript
const userMsg   = { id: Date.now(), ... };
const assistantMsgId = Date.now() + 1;
```

`Date.now()` has millisecond resolution. If `sendMessage()` is called in rapid succession (e.g. programmatic replay, automated test), or if the JS engine calls both lines within the same millisecond, the IDs may collide, causing `messages.find(m => m.id === this.currentAssistantMsgId)` to match the wrong message. Additionally, `currentAssistantMsgId` is a module-level state — if two messages are sent (before the `isStreaming` guard fires in the async path), callbacks could update the wrong message.

**Fix**: Use a monotonic counter (`let _nextId = 0; function nextId() { return ++_nextId; }`) instead of `Date.now()`.

---

#### M-002 — `marked.use()` called inside `renderMarkdown()` on every invocation

**File**: `frontend/public/js/chat.js:136-149`

`marked.use({ renderer: { code(...) {...} } })` is called every time `renderMarkdown()` is invoked. `marked.use()` is additive — it stacks renderers. After many messages, the renderer chain grows unboundedly. This is a performance issue and may cause unexpected behavior if the renderer logic is not idempotent across stacked invocations.

**Fix**: Call `marked.use(...)` and `marked.setOptions(...)` once during `init()`, not on every render.

---

#### M-003 — `isUserScrolledUp` is never reset to `false` when the user scrolls back to bottom

**File**: `frontend/public/index.html:86-87`, `frontend/public/js/chat.js:157-163`

The scroll handler only sets `isUserScrolledUp = true` when the user is more than 50px from the bottom. There is no logic to set it back to `false` when the user scrolls back down. The spec (T017) explicitly requires: "Reset `isUserScrolledUp` when user scrolls back to bottom (within 50px threshold)."

Once a user scrolls up during streaming, auto-scroll is permanently disabled for the remainder of the session, even after the user scrolls back to the bottom.

**Fix**: Change the `@scroll` handler to:
```javascript
@scroll="isUserScrolledUp = ($el.scrollHeight - $el.scrollTop - $el.clientHeight) > 50"
```
This is actually what the current code already does, re-reading... The current expression does set it to `false` when within 50px, since the expression evaluates to `false` in that case. **This issue is NOT present** — disregard M-003. The expression is a boolean assignment, not an `if` block.

*Retraction: M-003 is not a real issue. The scroll handler correctly sets the flag to false when scrolled near the bottom.*

---

#### M-004 — Token saved to localStorage even when empty string

**File**: `frontend/public/js/chat.js:166-169`

`saveToken('')` (user submits empty input) stores an empty string in `localStorage` and sets `showTokenPrompt = false`, effectively hiding the overlay. On the next `init()`, `localStorage.getItem('slashbot_token')` returns `''` which is falsy, so `showTokenPrompt` is correctly set to `true` again. However, the empty token is sent in the `Authorization: Bearer ` header on any request made before `init()` re-checks, and the overlay immediately closes giving the user false confirmation.

**Fix**: In `saveToken()`, treat an empty/whitespace-only value as "no token" — either keep the prompt open or not store/clear the key.

---

### LOW

#### L-001 — CSS `.message-area`, `.message`, `.message--user`, `.message--assistant`, `.message__bubble`, `.input-area` classes defined but never used in HTML

**File**: `frontend/public/css/app.css:35-129`

The HTML uses Tailwind utility classes exclusively. The BEM-style classes defined in `app.css` (`message`, `message--user`, `message__bubble`, `input-area`, etc.) are dead code. The `[x-data="chat()"]` selector in `app.css` is applied correctly, but everything else is unreachable. This is not a bug but increases maintenance burden and confuses future readers.

---

#### L-002 — `aria-live="polite"` duplicated: both the message log and the thinking indicator carry the attribute

**File**: `frontend/public/index.html:87` (message area) and `frontend/public/index.html:123` (thinking indicator)

The message log (`role="log"`) already has `aria-live="polite"`. The thinking indicator `<div>` inside it also declares `aria-live="polite"`. Nested `aria-live` regions can cause double-announcements on some screen readers (NVDA, JAWS). The `role="log"` on the container is itself an implicit `aria-live="polite"`, making the explicit attribute on the container redundant too.

**Fix**: Remove `aria-live="polite"` from the thinking indicator `<div>` (line 123) and from the message area `<div>` (line 87, since `role="log"` implies it). Keep `aria-live="polite"` only on the global error banner (line 76), which is correct.

---

#### L-003 — Token dialog missing focus management

**File**: `frontend/public/index.html:38-68`

The token overlay is shown/hidden via `x-show` but keyboard focus is not moved to the dialog when it opens, and is not trapped inside it. A keyboard user interacting with the header "Token" button will have focus remain behind the backdrop overlay, allowing Tab to reach elements beneath it. WCAG 2.1 §2.1.2 (No Keyboard Trap in reverse: focus must be moved into the dialog).

**Fix**: Use Alpine's `x-init` + `$nextTick` to focus the `#token-input` field when `showTokenPrompt` becomes `true`, e.g. `x-effect="if (showTokenPrompt) $nextTick(() => $refs.tokenInput.focus())"`.

---

#### L-004 — No test coverage for `chat.js` logic (Markdown rendering, tool call state, error paths)

**File**: `tests/frontend/sse-client.test.ts`

Tests exist for `sse-client.js` only. `chat.js` contains non-trivial logic: `renderMarkdown()`, `truncateText()`, `formatJson()`, `escapeHtml()`, and the stateful `sendMessage()` / callback wiring. None of these are tested. A unit test file for the pure utility functions (`truncateText`, `formatJson`, `escapeHtml`) would be straightforward to add without a DOM environment.

---

#### L-005 — `app.css` input area background hardcoded to `#ffffff` (white), conflicts with dark theme

**File**: `frontend/public/css/app.css:127`

```css
.input-area {
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb; /* gray-200 */
}
```

The app uses a dark theme (`bg-gray-950`). The `.input-area` class uses a white background. Even though this class is not applied in the HTML (see L-001), it is misleading and would break the dark theme if someone applies it.

---

## Summary Table

| ID | Severity | File | Line(s) | Description |
|----|----------|------|---------|-------------|
| H-001 | HIGH | `chat.js` | 153-154 | XSS: `marked.parse()` output not sanitized before `x-html` injection |
| H-002 | HIGH | `sse-client.js` | 116-132 | Missing `error` SSE event type handler — server errors silently dropped |
| M-001 | MEDIUM | `chat.js` | 29, 37 | Message ID collision risk with `Date.now()` / `Date.now() + 1` |
| M-002 | MEDIUM | `chat.js` | 136-149 | `marked.use()` called on every render — stacking renderer chain |
| M-004 | MEDIUM | `chat.js` | 166-169 | Empty token accepted, overlay dismissed, empty Bearer header sent |
| L-001 | LOW | `app.css` | 35-129 | BEM classes defined but never used in HTML (dead CSS) |
| L-002 | LOW | `index.html` | 87, 123 | Nested `aria-live` regions cause double-announcement risk |
| L-003 | LOW | `index.html` | 38-68 | Token dialog missing focus trap / auto-focus on open |
| L-004 | LOW | `tests/` | — | No unit tests for `chat.js` utility functions |
| L-005 | LOW | `app.css` | 127 | `.input-area` hardcoded white background conflicts with dark theme |

---

## Positive Observations

- SSE line buffering (partial chunk handling) is correctly implemented and well tested.
- `_processLine` gracefully discards malformed JSON without propagating errors.
- The `prefers-reduced-motion` handling for the thinking indicator is correct and complete.
- Tool call panel keyboard accessibility (Tab, Enter, Space, `aria-expanded`, `aria-label`) is well implemented.
- The `on401` → clear token → show overlay flow is correct.
- `escapeHtml()` is present and covers all five dangerous characters — it is just not applied to the Markdown path.
- Abort controller is returned from `streamChat()` for future cancellation support.
- Test file correctly uses `createRequire` to load the CommonJS export from the browser JS file.
