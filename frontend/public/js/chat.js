/**
 * Alpine.js chat component for Slashbot Chat UI.
 *
 * Defines a global `chat()` function used as the x-data source.
 * Relies on `streamChat` from sse-client.js being available globally.
 */

// Monotonic counter for collision-free message IDs (T024)
let _msgIdCounter = 0;

function chat() {
  return {
    messages: [],
    sessionId: null,
    isStreaming: false,
    inputText: '',
    token: '',
    showTokenPrompt: false,
    error: null,
    isUserScrolledUp: false,
    currentAssistantMsgId: null,

    init() {
      this.token = localStorage.getItem('slashbot_token') || '';
      this.showTokenPrompt = !this.token;

      // Configure marked once on init (T025)
      if (typeof marked !== 'undefined') {
        marked.use({
          renderer: {
            code(token) {
              const lang = (typeof token === 'object' ? token.lang : token) || '';
              const code = typeof token === 'object' ? token.text : arguments[0];
              const language = (typeof hljs !== 'undefined') && hljs.getLanguage(lang) ? lang : 'plaintext';
              const highlighted = (typeof hljs !== 'undefined')
                ? hljs.highlight(code, { language }).value
                : code;
              return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
            },
          },
        });
        marked.setOptions({ breaks: true, gfm: true });
      }
    },

    sendMessage() {
      if (!this.inputText.trim() || this.isStreaming) return;

      const userMsg = {
        id: ++_msgIdCounter,
        role: 'user',
        parts: [{ type: 'text', text: this.inputText.trim() }],
        isStreaming: false,
        error: null,
      };
      this.messages.push(userMsg);

      const assistantMsgId = ++_msgIdCounter;
      const assistantMsg = {
        id: assistantMsgId,
        role: 'assistant',
        parts: [],
        isStreaming: true,
        error: null,
      };
      this.messages.push(assistantMsg);
      this.currentAssistantMsgId = assistantMsgId;

      const userText = this.inputText.trim();
      this.inputText = '';
      this.isStreaming = true;
      this.error = null;

      const body = { message: userText };
      if (this.sessionId) body.sessionId = this.sessionId;

      streamChat('/api/chat', this.token, body, {
        onTextDelta: (text) => {
          const msg = this.messages.find(m => m.id === this.currentAssistantMsgId);
          if (!msg) return;
          const lastPart = msg.parts[msg.parts.length - 1];
          if (lastPart && lastPart.type === 'text') {
            lastPart.rawText = (lastPart.rawText || '') + text;
            lastPart.text = lastPart.rawText;
          } else {
            msg.parts.push({ type: 'text', rawText: text, text: text, html: null });
          }
          this.scrollToBottom();
        },

        onToolCallStart: (payload) => {
          const msg = this.messages.find(m => m.id === this.currentAssistantMsgId);
          if (!msg) return;
          msg.parts.push({
            type: 'tool-call',
            toolId: payload.toolCallId,
            toolName: payload.toolName,
            args: payload.args,
            status: 'running',
            result: null,
            success: null,
            expanded: true,
          });
          this.scrollToBottom();
        },

        onToolCallResult: (payload) => {
          const msg = this.messages.find(m => m.id === this.currentAssistantMsgId);
          if (!msg) return;
          const part = msg.parts.find(p => p.type === 'tool-call' && p.toolId === payload.toolCallId);
          if (part) {
            part.status = payload.isError ? 'error' : 'done';
            part.result = payload.result;
            part.success = !payload.isError;
          }
        },

        onDone: (sessionId) => {
          const msg = this.messages.find(m => m.id === this.currentAssistantMsgId);
          if (msg) {
            msg.isStreaming = false;
            msg.parts.forEach(part => {
              if (part.type === 'text' && part.rawText) {
                part.html = this.renderMarkdown(part.rawText);
              }
              if (part.type === 'tool-call') {
                part.expanded = false;
              }
            });
          }
          this.sessionId = sessionId;
          this.isStreaming = false;
          this.scrollToBottom();
        },

        onError: (message) => {
          const msg = this.messages.find(m => m.id === this.currentAssistantMsgId);
          if (msg) {
            msg.error = message;
            msg.isStreaming = false;
          }
          this.isStreaming = false;
          this.error = message;
        },

        on401: () => {
          this.showTokenPrompt = true;
          localStorage.removeItem('slashbot_token');
          this.token = '';
        },
      });
    },

    renderMarkdown(text) {
      if (typeof marked === 'undefined') return this.escapeHtml(text);

      const rawHtml = marked.parse(text);
      // Sanitise to prevent XSS (T022)
      return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : this.escapeHtml(text);
    },

    scrollToBottom() {
      if (this.isUserScrolledUp) return;
      this.$nextTick(() => {
        const el = this.$refs.messageArea;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    saveToken(newToken) {
      if (!newToken || !newToken.trim()) return;
      this.token = newToken.trim();
      localStorage.setItem('slashbot_token', this.token);
      this.showTokenPrompt = false;
    },

    formatJson(obj) {
      try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
    },

    truncateText(text, maxLen) {
      if (!text || text.length <= maxLen) return { text: text || '', isTruncated: false };
      return { text: text.slice(0, maxLen) + '...', isTruncated: true };
    },

    escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
  };
}
