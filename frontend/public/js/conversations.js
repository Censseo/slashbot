/**
 * Sidebar conversation list component.
 * Fetches and displays past conversations, dispatches selection events.
 */
function conversations() {
  return {
    items: [],
    activeId: null,
    isLoading: false,
    error: null,
    token: '',

    init() {
      this.token = localStorage.getItem('slashbot_token') || '';
      this.load();
      // Refresh on conversation updates
      window.addEventListener('conversation-updated', () => this.load());
    },

    async load(isRetry = false) {
      if (!this.token) return;
      this.isLoading = true;
      this.error = null;
      try {
        const resp = await fetch('/api/conversations', {
          headers: { 'Authorization': `Bearer ${this.token}` },
        });
        if (resp.status === 401) {
          window.dispatchEvent(new CustomEvent('show-token-prompt'));
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        this.items = data.conversations || [];
      } catch (e) {
        if (!isRetry) {
          setTimeout(() => this.load(true), 2000);
        } else {
          this.error = 'Failed to load conversations';
        }
      } finally {
        this.isLoading = false;
      }
    },

    selectConversation(id) {
      this.activeId = id;
      window.dispatchEvent(new CustomEvent('load-conversation', { detail: id }));
    },

    newConversation() {
      this.activeId = null;
      window.dispatchEvent(new CustomEvent('new-conversation'));
    },

    async deleteConversation(id) {
      if (!confirm('Delete this conversation?')) return;
      try {
        const resp = await fetch(`/api/conversations/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${this.token}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        this.items = this.items.filter(item => item.id !== id);
        if (this.activeId === id) {
          this.activeId = null;
          window.dispatchEvent(new CustomEvent('new-conversation'));
        }
      } catch (e) {
        this.error = 'Failed to delete conversation';
      }
    },

    formatDate(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    handleKeydown(event) {
      if (!this.items.length) return;
      // Only handle when sidebar or its children have focus
      if (!document.activeElement?.closest('aside')) return;
      const currentIdx = this.items.findIndex(i => i.id === this.activeId);

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIdx = currentIdx < this.items.length - 1 ? currentIdx + 1 : 0;
        this.selectConversation(this.items[nextIdx].id);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : this.items.length - 1;
        this.selectConversation(this.items[prevIdx].id);
      } else if (event.key === 'Enter' && this.activeId) {
        event.preventDefault();
        this.selectConversation(this.activeId);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.activeId = null;
      }
    },

    getTitle(item) {
      return item.title || 'New conversation';
    },
  };
}
