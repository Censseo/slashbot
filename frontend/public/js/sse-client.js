/**
 * SSE stream consumer utility for the Slashbot chat UI.
 *
 * Usage:
 *   const controller = streamChat(url, token, body, callbacks);
 *   // controller.abort() to cancel (future support)
 *
 * @param {string} url - The endpoint URL to POST to
 * @param {string} token - Bearer token for Authorization header
 * @param {object} body - JSON body to POST
 * @param {object} callbacks - Event callbacks
 * @param {function} [callbacks.onTextDelta] - Called with text string on text-delta events
 * @param {function} [callbacks.onToolCallStart] - Called with payload on tool-call-start events
 * @param {function} [callbacks.onToolCallResult] - Called with payload on tool-call-result events
 * @param {function} [callbacks.onDone] - Called with sessionId string on done events
 * @param {function} [callbacks.onError] - Called with error message string
 * @param {function} [callbacks.on401] - Called (no args) on HTTP 401, in addition to onError
 * @returns {AbortController}
 */
function streamChat(url, token, body, callbacks) {
  const {
    onTextDelta,
    onToolCallStart,
    onToolCallResult,
    onDone,
    onError,
    on401,
  } = callbacks || {};

  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (onError) onError('Network error: ' + (err && err.message || String(err)));
      return;
    }

    if (!response.ok) {
      if (response.status === 401) {
        if (on401) on401();
        if (onError) onError('Unauthorized: invalid or missing token');
      } else {
        if (onError) onError('Server error: HTTP ' + response.status);
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = lineBuffer.indexOf('\n')) !== -1) {
          const line = lineBuffer.slice(0, newlineIdx).replace(/\r$/, '');
          lineBuffer = lineBuffer.slice(newlineIdx + 1);
          _processLine(line, { onTextDelta, onToolCallStart, onToolCallResult, onDone, onError });
        }
      }

      // Process any remaining content in the buffer
      if (lineBuffer.length > 0) {
        _processLine(lineBuffer, { onTextDelta, onToolCallStart, onToolCallResult, onDone, onError });
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (onError) onError('Stream error: ' + (err && err.message || String(err)));
    }
  })();

  return controller;
}

/**
 * Process a single SSE line.
 * @param {string} line
 * @param {object} callbacks
 */
function _processLine(line, callbacks) {
  // Ignore empty lines and SSE comment lines (keepalive `: ping`, etc.)
  if (line === '' || line.startsWith(':')) return;

  // Only handle data: lines
  if (!line.startsWith('data:')) return;

  const raw = line.slice(5).trimStart();

  // Validate JSON before parsing — discard malformed lines silently
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }

  const { onTextDelta, onToolCallStart, onToolCallResult, onDone, onError } = callbacks;

  const p = event.payload ?? {};

  switch (event.type) {
    case 'text-delta':
      if (onTextDelta) onTextDelta(p.text ?? event.delta ?? '');
      break;
    case 'tool-call-start':
      if (onToolCallStart) onToolCallStart({
        toolCallId: p.toolId ?? event.toolCallId,
        toolName: p.toolName ?? event.toolName,
        args: p.args ?? event.args,
      });
      break;
    case 'tool-call-result':
      if (onToolCallResult) onToolCallResult({
        toolCallId: p.toolId ?? event.toolCallId,
        result: p.result ?? event.result,
        isError: p.success === false || event.isError === true,
      });
      break;
    case 'done':
      if (onDone) onDone(p.sessionId ?? event.sessionId);
      break;
    case 'error':
      if (onError) onError(p.message ?? event.message ?? 'Server stream error');
      break;
    default:
      // Unknown event type — ignore silently
      break;
  }
}

// CommonJS export for testability in Bun/Node environments
if (typeof module !== 'undefined') {
  module.exports = { streamChat, _processLine };
}
