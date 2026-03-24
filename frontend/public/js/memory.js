/**
 * Alpine.js memory dashboard component for Slashbot.
 *
 * Manages sub-tabs (Graph, Explorer, Timeline), unified search,
 * stats bar, and Cytoscape.js graph visualization.
 */

function memory() {
  return {
    // --- State ---
    _active: false,
    activeTab: 'graph',

    // Stats
    stats: null,
    statsLoading: false,
    _statsInterval: null,

    // Search
    searchQuery: '',
    searchResults: null,
    isSearching: false,

    // Graph
    graphData: null,
    graphError: false,
    graphErrorMessage: '',
    _cy: null,
    selectedNode: null,
    selectedNodeEdges: [],
    graphNodeTypes: [],
    graphRelTypes: [],
    graphNodeTypeFilters: [],
    graphRelTypeFilters: [],
    _reducedMotion: false,

    // Explorer
    fileTree: [],
    selectedFile: null,
    fileContent: '',
    renderedFileContent: '',
    isEditing: false,
    editContent: '',
    showNoteForm: false,
    noteText: '',

    // Timeline
    timelineDays: [],
    timelineLoading: false,
    timelineHasMore: true,
    _timelineOffset: 0,

    // Toast
    toast: null,
    toastType: 'success',
    _toastTimer: null,

    // --- Lifecycle ---

    init() {
      this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    onShow() {
      if (this._active) return;
      this._active = true;
      this.loadStats();
      this._statsInterval = setInterval(() => this.loadStats(), 30000);
      this._loadTabData();
    },

    onHide() {
      if (!this._active) return;
      this._active = false;
      if (this._statsInterval) {
        clearInterval(this._statsInterval);
        this._statsInterval = null;
      }
    },

    // --- Auth ---

    _getToken() {
      return localStorage.getItem('slashbot_token') || '';
    },

    _handleUnauthorized() {
      this.onHide();
      window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'chat' }));
      window.dispatchEvent(new CustomEvent('show-token-prompt'));
    },

    async _fetch(url, options = {}) {
      const token = this._getToken();
      const res = await fetch(url, {
        ...options,
        headers: { 'Authorization': `Bearer ${token}`, ...options.headers },
      });
      if (res.status === 401) {
        this._handleUnauthorized();
        return null;
      }
      return res;
    },

    // --- Toast ---

    showToast(message, type = 'success') {
      this.toast = message;
      this.toastType = type;
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast = null; }, 3000);
    },

    // --- Tab Management ---

    _savedGraphViewport: null,

    switchTab(tab) {
      // Save current tab state
      this._saveTabState();
      this.activeTab = tab;
      this._loadTabData();
      this.loadStats(); // FR-043: stats MUST refresh on tab switch
      // Restore new tab state
      this.$nextTick(() => this._restoreTabState());
    },

    _saveTabState() {
      if (this.activeTab === 'graph' && this._cy) {
        this._savedGraphViewport = { zoom: this._cy.zoom(), pan: { ...this._cy.pan() } };
      }
    },

    _restoreTabState() {
      if (this.activeTab === 'graph' && this._cy && this._savedGraphViewport) {
        this._cy.viewport(this._savedGraphViewport);
      }
    },

    _loadTabData() {
      if (this.activeTab === 'graph' && !this.graphData && !this.graphError) {
        this.loadGraphData();
      } else if (this.activeTab === 'explorer' && this.fileTree.length === 0) {
        this.loadFileTree();
      } else if (this.activeTab === 'timeline' && this.timelineDays.length === 0) {
        this.loadTimeline();
      }
    },

    // --- US5: Stats ---

    async loadStats() {
      this.statsLoading = true;
      try {
        const res = await this._fetch('/api/memory/stats');
        if (!res) return;
        if (res.ok) {
          this.stats = await res.json();
        }
      } catch { /* silently fail */ }
      this.statsLoading = false;
    },

    // --- US2: Search ---

    async performSearch() {
      const q = this.searchQuery.trim();
      if (!q) {
        this.searchResults = null;
        return;
      }
      this.isSearching = true;
      try {
        const res = await this._fetch(`/api/memory/search?q=${encodeURIComponent(q)}&limit=20`);
        if (!res) return;
        if (res.ok) {
          this.searchResults = await res.json();
        }
      } catch {
        this.searchResults = null;
      }
      this.isSearching = false;
    },

    navigateToMemoryResult(path) {
      this.searchQuery = '';
      this.searchResults = null;
      this.activeTab = 'explorer';
      this.$nextTick(() => this.loadFileContent(path));
      if (this.fileTree.length === 0) this.loadFileTree();
    },

    navigateToGraphResult(nodeId) {
      this.searchQuery = '';
      this.searchResults = null;
      this.activeTab = 'graph';
      this.$nextTick(() => {
        if (!this.graphData) {
          this.loadGraphData().then(() => this._focusGraphNode(nodeId));
        } else {
          this._focusGraphNode(nodeId);
        }
      });
    },

    _focusGraphNode(nodeId) {
      if (!this._cy) return;
      const node = this._cy.getElementById(nodeId);
      if (node.length === 0) return;
      this._cy.animate({ center: { eles: node }, zoom: 1.5 }, { duration: this._reducedMotion ? 0 : 400 });
      node.select();
      this._onNodeClick(node);
    },

    // --- US1: Graph ---

    async loadGraphData() {
      this.graphError = false;
      this.graphErrorMessage = '';
      try {
        const res = await this._fetch('/api/memory/graph');
        if (!res) return;
        if (res.status === 503) {
          this.graphError = true;
          this.graphErrorMessage = 'Association graph service is not running.';
          return;
        }
        if (!res.ok) {
          this.graphError = true;
          this.graphErrorMessage = 'Failed to load graph: HTTP ' + res.status;
          return;
        }
        this.graphData = await res.json();
        // Extract unique types
        this.graphNodeTypes = [...new Set(this.graphData.nodes.map(n => n.type).filter(Boolean))];
        this.graphRelTypes = [...new Set(this.graphData.edges.map(e => e.rel).filter(Boolean))];
        this.graphNodeTypeFilters = [...this.graphNodeTypes];
        this.graphRelTypeFilters = [...this.graphRelTypes];
        this.$nextTick(() => this.initGraph());
      } catch (err) {
        this.graphError = true;
        this.graphErrorMessage = 'Network error: ' + (err.message || String(err));
      }
    },

    initGraph() {
      const container = this.$refs.graphContainer;
      if (!container || !this.graphData || typeof cytoscape === 'undefined') return;

      // Destroy existing
      if (this._cy) {
        this._cy.destroy();
        this._cy = null;
      }

      const nodeColorMap = {
        concept: { bg: '#3b82f6', border: '#2563eb', shape: 'ellipse' },
        tool: { bg: '#22c55e', border: '#16a34a', shape: 'diamond' },
        decision: { bg: '#f97316', border: '#ea580c', shape: 'triangle' },
        person: { bg: '#a855f7', border: '#9333ea', shape: 'pentagon' },
        project: { bg: '#14b8a6', border: '#0d9488', shape: 'rectangle' },
        domain: { bg: '#ef4444', border: '#dc2626', shape: 'hexagon' },
      };
      const defaultStyle = { bg: '#6b7280', border: '#4b5563', shape: 'ellipse' };

      const elements = {
        nodes: this.graphData.nodes.map(n => ({
          data: { id: n.id, label: n.label, type: n.type || 'concept', ...n },
          classes: [n.type || 'concept'],
        })),
        edges: this.graphData.edges.map(e => ({
          data: { id: e.from + '|' + e.to + '|' + e.rel, source: e.from, target: e.to, rel: e.rel, weight: e.weight },
        })),
      };

      const styleEntries = Object.entries(nodeColorMap);
      const nodeStyles = styleEntries.map(([type, s]) => ({
        selector: `node.${type}`,
        style: {
          'background-color': s.bg,
          'border-color': s.border,
          shape: s.shape,
        },
      }));

      this._cy = cytoscape({
        container,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'font-size': '10px',
              color: '#e5e7eb',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'background-color': defaultStyle.bg,
              'border-color': defaultStyle.border,
              'border-width': 2,
              width: 24,
              height: 24,
            },
          },
          ...nodeStyles,
          {
            selector: 'edge',
            style: {
              width: 'mapData(weight, 0, 1, 1, 4)',
              'line-color': '#374151',
              'target-arrow-color': '#374151',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 'mapData(weight, 0, 1, 0.3, 0.8)',
              label: 'data(rel)',
              'font-size': '8px',
              color: '#6b7280',
              'text-rotation': 'autorotate',
            },
          },
          {
            selector: 'node.highlighted',
            style: { 'border-width': 4, 'border-color': '#facc15' },
          },
          {
            selector: 'node.dimmed',
            style: { opacity: 0.2 },
          },
          {
            selector: 'edge.dimmed',
            style: { opacity: 0.05 },
          },
          {
            selector: ':selected',
            style: { 'border-width': 4, 'border-color': '#3b82f6' },
          },
        ],
        layout: {
          name: 'cose',
          animate: !this._reducedMotion,
          animationDuration: this._reducedMotion ? 0 : 800,
          nodeRepulsion: () => 8000,
          idealEdgeLength: () => 80,
          gravity: 0.3,
        },
        wheelSensitivity: 0.3,
        minZoom: 0.1,
        maxZoom: 5,
      });

      // Event handlers
      this._cy.on('mouseover', 'node', (e) => this._onNodeHover(e.target, true));
      this._cy.on('mouseout', 'node', () => this._onNodeHover(null, false));
      this._cy.on('tap', 'node', (e) => this._onNodeClick(e.target));
      this._cy.on('tap', (e) => {
        if (e.target === this._cy) {
          this.selectedNode = null;
          this.selectedNodeEdges = [];
          this._cy.elements().removeClass('highlighted dimmed');
        }
      });

      // Keyboard navigation
      let currentNodeIdx = -1;
      const sortedNodes = () => this._cy.nodes(':visible').sort((a, b) => a.data('label').localeCompare(b.data('label')));
      container.setAttribute('tabindex', '0');
      container.addEventListener('keydown', (e) => {
        if (!this._cy) return;
        const nodes = sortedNodes();
        if (nodes.length === 0) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          currentNodeIdx = (currentNodeIdx + 1) % nodes.length;
          this._focusGraphNode(nodes[currentNodeIdx].id());
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          currentNodeIdx = (currentNodeIdx - 1 + nodes.length) % nodes.length;
          this._focusGraphNode(nodes[currentNodeIdx].id());
        } else if (e.key === 'Enter') {
          if (currentNodeIdx >= 0 && currentNodeIdx < nodes.length) {
            this._onNodeClick(nodes[currentNodeIdx]);
          }
        } else if (e.key === 'Escape') {
          this.selectedNode = null;
          this.selectedNodeEdges = [];
          this._cy.elements().removeClass('highlighted dimmed');
        }
      });
    },

    _onNodeHover(node, entering) {
      if (!this._cy) return;
      if (!entering) {
        this._cy.elements().removeClass('highlighted dimmed');
        return;
      }
      const neighborhood = node.neighborhood().add(node);
      this._cy.elements().addClass('dimmed');
      neighborhood.removeClass('dimmed');
      node.addClass('highlighted');
    },

    _onNodeClick(node) {
      if (!this._cy || !node || !node.data) return;
      const data = node.data();
      this.selectedNode = {
        id: data.id,
        label: data.label,
        type: data.type,
        created: data.created,
        meta: data.meta,
      };
      this.selectedNodeEdges = this._cy.edges().filter(e =>
        e.data('source') === data.id || e.data('target') === data.id
      ).map(e => e.data());
    },

    clearGraphSelection() {
      if (this._cy) {
        this._cy.elements().unselect();
        this._cy.elements().removeClass('highlighted dimmed');
      }
    },

    toggleNodeTypeFilter(type) {
      const idx = this.graphNodeTypeFilters.indexOf(type);
      if (idx >= 0) {
        this.graphNodeTypeFilters.splice(idx, 1);
      } else {
        this.graphNodeTypeFilters.push(type);
      }
      this._applyGraphFilters();
    },

    toggleRelTypeFilter(rel) {
      const idx = this.graphRelTypeFilters.indexOf(rel);
      if (idx >= 0) {
        this.graphRelTypeFilters.splice(idx, 1);
      } else {
        this.graphRelTypeFilters.push(rel);
      }
      this._applyGraphFilters();
    },

    _applyGraphFilters() {
      if (!this._cy) return;
      this._cy.nodes().forEach(node => {
        const type = node.data('type') || 'concept';
        if (this.graphNodeTypeFilters.includes(type)) {
          node.style('display', 'element');
        } else {
          node.style('display', 'none');
        }
      });
      this._cy.edges().forEach(edge => {
        const rel = edge.data('rel');
        const srcVisible = edge.source().style('display') !== 'none';
        const tgtVisible = edge.target().style('display') !== 'none';
        if (this.graphRelTypeFilters.includes(rel) && srcVisible && tgtVisible) {
          edge.style('display', 'element');
        } else {
          edge.style('display', 'none');
        }
      });
    },

    // --- US3: Explorer ---

    async loadFileTree() {
      try {
        const res = await this._fetch('/api/memory/files');
        if (!res) return;
        if (res.ok) {
          this.fileTree = await res.json();
        }
      } catch { /* silently fail */ }
    },

    async loadFileContent(path) {
      this.selectedFile = path;
      this.isEditing = false;
      try {
        const res = await this._fetch(`/api/memory/files/${encodeURIComponent(path)}`);
        if (!res) return;
        if (res.ok) {
          const data = await res.json();
          this.fileContent = data.content;
          this.renderedFileContent = this.renderMarkdown(data.content);
        } else {
          this.fileContent = '';
          this.renderedFileContent = '<p class="text-red-400">Failed to load file</p>';
        }
      } catch {
        this.fileContent = '';
        this.renderedFileContent = '<p class="text-red-400">Network error loading file</p>';
      }
    },

    startEdit() {
      this.editContent = this.fileContent;
      this.isEditing = true;
    },

    cancelEdit() {
      this.isEditing = false;
    },

    async saveEdit() {
      try {
        const res = await this._fetch(`/api/memory/files/${encodeURIComponent(this.selectedFile)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: this.editContent }),
        });
        if (!res) return;
        if (res.ok) {
          this.fileContent = this.editContent;
          this.renderedFileContent = this.renderMarkdown(this.editContent);
          this.isEditing = false;
          this.showToast('File saved');
        } else {
          const err = await res.json().catch(() => ({}));
          this.showToast(err.error || 'Failed to save', 'error');
        }
      } catch {
        this.showToast('Network error saving file', 'error');
      }
    },

    async deleteFile(path) {
      if (!confirm(`Delete "${path}"?`)) return;
      try {
        const res = await this._fetch(`/api/memory/files/${encodeURIComponent(path)}`, { method: 'DELETE' });
        if (!res) return;
        if (res.ok) {
          this.selectedFile = null;
          this.fileContent = '';
          this.renderedFileContent = '';
          this.showToast('File deleted');
          this.loadFileTree();
        } else {
          const err = await res.json().catch(() => ({}));
          this.showToast(err.error || 'Failed to delete', 'error');
        }
      } catch {
        this.showToast('Network error deleting file', 'error');
      }
    },

    async addNote(text) {
      if (!text || !text.trim()) return;
      try {
        const res = await this._fetch('/api/memory/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        });
        if (!res) return;
        if (res.ok) {
          this.showToast('Note added');
          this.showNoteForm = false;
          this.loadFileTree();
        } else {
          const err = await res.json().catch(() => ({}));
          this.showToast(err.error || 'Failed to add note', 'error');
        }
      } catch {
        this.showToast('Network error adding note', 'error');
      }
    },

    // --- US4: Timeline ---

    async loadTimeline(days = 7, offset = 0) {
      this.timelineLoading = true;
      this._timelineOffset = offset;
      try {
        const res = await this._fetch(`/api/memory/timeline?days=${days}&offset=${offset}`);
        if (!res) return;
        if (res.ok) {
          const data = await res.json();
          if (offset === 0) {
            this.timelineDays = data;
          } else {
            this.timelineDays = [...this.timelineDays, ...data];
          }
          this.timelineHasMore = data.length >= days;
        }
      } catch { /* silently fail */ }
      this.timelineLoading = false;
    },

    loadMoreTimeline() {
      this._timelineOffset += 7;
      this.loadTimeline(7, this._timelineOffset);
    },

    // --- Helpers ---

    renderMarkdown(content) {
      if (!content) return '';
      try {
        const html = marked.parse(content);
        return DOMPurify.sanitize(html);
      } catch {
        return DOMPurify.sanitize(content);
      }
    },

    nodeTypeBadgeClass(type) {
      const map = {
        concept: 'bg-blue-500/20 text-blue-400',
        tool: 'bg-green-500/20 text-green-400',
        decision: 'bg-orange-500/20 text-orange-400',
        person: 'bg-purple-500/20 text-purple-400',
        project: 'bg-teal-500/20 text-teal-400',
        domain: 'bg-red-500/20 text-red-400',
      };
      return map[type] || 'bg-gray-500/20 text-gray-400';
    },
  };
}
