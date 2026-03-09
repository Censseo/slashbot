# Feature: Node-RED Management

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 05
**Priority**: P2
**Status**: Not Specified

## Summary

Dashboard panel for viewing and managing Node-RED flows directly from the slashbot web UI, leveraging the existing Node-RED gateway plugin.

## User Value

**Who benefits**: Self-hosted operator
**What they gain**: Manage Node-RED flows without switching to the Node-RED editor
**Success metric**: Can view flow list, enable/disable flows, and see flow status

## Scope

### This Feature Includes
- Flow list with status (enabled/disabled, last triggered)
- Quick actions: enable/disable flow, trigger manual run
- Link to open full Node-RED editor

### This Feature Does NOT Include
- Visual flow editor (use Node-RED's own editor)
- Flow creation from scratch

## Dependencies

### Requires
- Feature 01 (gateway-api): API endpoints proxying to Node-RED Admin API
- Feature 03 (admin-dashboard): dashboard layout to embed into

### Enables
- Nothing directly

## Open Questions

- How much Node-RED management to expose vs. just linking to the editor?
