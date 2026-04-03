---
status: resolved
severity: medium
type: scenario_failure
user_story: US5
created: 2026-03-17
resolved_date: 2026-03-17
fix_applied: "Re-added loadStats() call in switchTab() per FR-043"
---

# BUG-003: Stats not refreshed on tab switch

## Summary
FR-043 requires "Stats MUST refresh when the operator switches tabs or after a polling interval." Task T042 removed `loadStats()` from `switchTab()` as "redundant" with 30s polling. However, the spec explicitly requires immediate refresh on tab switch.

## Reproduction Steps
1. Open Memory Dashboard, observe stats
2. Add a note (changes file count)
3. Switch between Graph/Explorer/Timeline tabs
4. **Actual**: Stats remain stale until the next 30s poll
5. **Expected**: Stats refresh immediately on tab switch

## Expected vs Actual
- **Expected**: Stats refresh when switching between tabs
- **Actual**: Stats only refresh every 30 seconds via polling interval

## Technical Analysis
- **Probable Cause**: T042 removed `loadStats()` from `switchTab()` to avoid perceived redundancy, but this broke FR-043
- **Affected Files**: `frontend/public/js/memory.js` — `switchTab()` method (line ~119)
- **Suggested Fix**: Re-add `this.loadStats()` call within `switchTab()`:
  ```javascript
  switchTab(tab) {
    this._saveTabState();
    this.activeTab = tab;
    this._loadTabData();
    this.loadStats();  // FR-043: refresh stats on tab switch
    this.$nextTick(() => this._restoreTabState());
  },
  ```
