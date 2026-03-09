# Feature: Admin Dashboard

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

A web dashboard for monitoring and managing slashbot's internal state. Shows plugin status, live logs, and system health at a glance. Built with PenguinUI components for a clean, functional admin experience.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: Centralized visibility into slashbot's state without reading config files or logs manually
**Success metric**: Can see all loaded plugins and their status; can view live streaming logs

## Scope

### This Feature Includes
- Plugin list with status indicators (active, error, disabled)
- Live log viewer (streaming, auto-scroll, filterable by level)
- System health overview (uptime, memory, connected services)
- Navigation between dashboard and chat

### This Feature Does NOT Include
- Node-RED flow management (feature 05)
- Association graph visualization (feature 06)
- Configuration editing (future)
- Plugin enable/disable actions (future — read-only for MVP)

## Key Use Cases

### Use Case 1: Check System Health
**Actor**: Self-hosted operator
**Goal**: Quickly verify everything is running
**Flow**:
1. Open the dashboard page
2. See a health summary: uptime, memory usage, number of active plugins
3. See connection status for Node-RED, any connectors

### Use Case 2: Debug an Issue
**Actor**: Self-hosted operator
**Goal**: Find out why something isn't working
**Flow**:
1. Navigate to the logs section
2. See real-time log stream
3. Filter by log level (error, warn, info, debug)
4. Spot the error and understand the issue

## Dependencies

### Requires
- Feature 01 (gateway-api): provides admin API endpoints

### Enables
- Feature 05 (nodered-management): extends the dashboard with Node-RED panel
- Feature 06 (graph-visualization): extends the dashboard with graph panel

## Technical Hints

### Required Tools & Versions

- **PenguinUI**: latest - table, card, badge components for dashboard layout

### Implementation Notes

- Use PenguinUI table components for plugin list
- Log viewer: SSE stream from `/api/logs`, rendered in a scrollable container with auto-scroll
- Status badges: green (active), red (error), gray (disabled)
- Dashboard and chat should share a common layout/navigation (tabs or sidebar)

## Open Questions

- Should logs be persisted or only show real-time stream?
- How much system info to expose (memory, CPU, etc.)?

## Notes

Keep it simple for MVP — read-only dashboard. Actions (restart plugin, change config) can come later. The main value is visibility.
