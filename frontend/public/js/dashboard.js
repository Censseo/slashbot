/**
 * Alpine.js dashboard component for Slashbot Admin Dashboard.
 *
 * Defines a global `dashboard()` function used as the x-data source.
 * Relies on `connectLogStream` from sse-client.js being available globally.
 */

function dashboard() {
  return {
    // State
    plugins: [],
    health: null,
    indicators: [],
    logs: [],
    logFilter: 'all',
    isLogConnected: false,
    isUserScrolledUp: false,
    error: null,
    _logStream: null,
    _healthInterval: null,

    _active: false,

    init() {
      // loadPlugins() deferred to onShow() to avoid duplicate fetch
    },

    // --- Plugin Status (US1) ---

    async loadPlugins() {
      const token = localStorage.getItem('slashbot_token') || '';
      try {
        const res = await fetch('/api/plugins', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.status === 401) {
          this._handleUnauthorized();
          return;
        }
        if (!res.ok) {
          this.error = 'Failed to load plugins: HTTP ' + res.status;
          return;
        }
        this.plugins = await res.json();
        this.error = null;
      } catch (err) {
        this.error = 'Network error loading plugins: ' + (err.message || String(err));
      }
    },

    get pluginSummary() {
      const total = this.plugins.length;
      const loaded = this.plugins.filter(p => p.status === 'loaded').length;
      const failed = this.plugins.filter(p => p.status === 'failed').length;
      return { total, loaded, failed };
    },

    statusLabel(status) {
      const map = { loaded: 'Active', failed: 'Error', disabled: 'Disabled', skipped: 'Skipped' };
      return map[status] || status;
    },

    statusColor(status) {
      const map = {
        loaded: 'bg-green-500/20 text-green-400 border-green-500/30',
        failed: 'bg-red-500/20 text-red-400 border-red-500/30',
        disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        skipped: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      };
      return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    },

    // --- Log Viewer (US2) ---

    connectLogs() {
      if (this._logStream) return;
      const token = localStorage.getItem('slashbot_token') || '';
      this._logStream = connectLogStream('/api/logs', token, {
        onLogEntry: (entry) => {
          this.logs.push(entry);
          if (this.logs.length > 1000) {
            this.logs.splice(0, this.logs.length - 1000);
          }
          this.scrollLogsToBottom();
        },
        onError: () => {
          this.isLogConnected = false;
        },
        onOpen: () => {
          this.isLogConnected = true;
        },
        on401: () => {
          this.isLogConnected = false;
          this._handleUnauthorized();
        },
      });
      this.isLogConnected = true;
    },

    disconnectLogs() {
      if (this._logStream) {
        this._logStream.close();
        this._logStream = null;
      }
      this.isLogConnected = false;
    },

    get filteredLogs() {
      if (this.logFilter === 'all') return this.logs;
      return this.logs.filter(l => l.level === this.logFilter);
    },

    scrollLogsToBottom() {
      if (this.isUserScrolledUp) return;
      this.$nextTick(() => {
        const el = this.$refs.logArea;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    onLogScroll(el) {
      this.isUserScrolledUp = (el.scrollHeight - el.scrollTop - el.clientHeight) > 50;
    },

    scrollToLogBottom() {
      this.isUserScrolledUp = false;
      const el = this.$refs.logArea;
      if (el) el.scrollTop = el.scrollHeight;
    },

    logLevelColor(level) {
      const map = {
        error: 'text-red-400',
        warn: 'text-orange-400',
        info: 'text-blue-400',
        debug: 'text-gray-500',
      };
      return map[level] || 'text-gray-400';
    },

    formatTimestamp(ts) {
      try {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        return ts || '';
      }
    },

    formatFields(fields) {
      if (!fields || typeof fields !== 'object') return '';
      const entries = Object.entries(fields);
      if (entries.length <= 3) {
        return entries.map(([k, v]) => `${k}=${v}`).join(' ');
      }
      const visible = entries.slice(0, 3).map(([k, v]) => `${k}=${v}`).join(' ');
      return `${visible} (+${entries.length - 3} more)`;
    },

    // --- Health (US3) ---

    async loadHealth() {
      const token = localStorage.getItem('slashbot_token') || '';
      try {
        const res = await fetch('/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ method: 'webui.systemInfo', params: null, requestId: crypto.randomUUID() }),
        });
        if (res.ok) {
          const data = await res.json();
          this.health = data.result || data;
        }
      } catch { /* silently fail, show stale data */ }

      try {
        const res2 = await fetch('/api/status-indicators', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res2.ok) {
          this.indicators = await res2.json();
        }
      } catch { /* silently fail */ }
    },

    startHealthRefresh() {
      this.loadHealth();
      this._healthInterval = setInterval(() => this.loadHealth(), 30000);
    },

    stopHealthRefresh() {
      if (this._healthInterval) {
        clearInterval(this._healthInterval);
        this._healthInterval = null;
      }
    },

    formatUptime(seconds) {
      if (!seconds && seconds !== 0) return '-';
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const parts = [];
      if (d > 0) parts.push(d + 'd');
      if (h > 0 || d > 0) parts.push(h + 'h');
      parts.push(m + 'm');
      return parts.join(' ');
    },

    formatBytes(bytes) {
      if (!bytes && bytes !== 0) return '-';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    indicatorStatusColor(status) {
      const map = {
        connected: 'bg-green-500',
        running: 'bg-green-500',
        busy: 'bg-yellow-500',
        idle: 'bg-gray-400',
        disconnected: 'bg-red-500',
        error: 'bg-red-500',
        off: 'bg-gray-600',
      };
      return map[status] || 'bg-gray-600';
    },

    _handleUnauthorized() {
      this.error = null;
      this.onHide();
      window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'chat' }));
      window.dispatchEvent(new CustomEvent('show-token-prompt'));
    },

    // --- Navigation (US4) ---

    onShow() {
      if (this._active) return;
      this._active = true;
      this.loadPlugins();
      this.connectLogs();
      this.startHealthRefresh();
    },

    onHide() {
      if (!this._active) return;
      this._active = false;
      this.disconnectLogs();
      this.stopHealthRefresh();
    },

    destroy() {
      this.disconnectLogs();
      this.stopHealthRefresh();
    },
  };
}
