# Feature: Slashbot Runner Module

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Rendre slashbot embeddable dans agent-service comme module TypeScript. Agent-service invoque slashbot via une interface `executeStep(payload)` au lieu de spawner `claude cli` directement. C'est le point d'entrée de toute l'intégration — rien d'autre ne peut être construit sans cette fondation.

## User Value

**Who benefits**: Atelier (Spring Boot orchestrator)
**What they gain**: Le protocole runner existant est préservé — Atelier ne voit aucun changement. Mais derrière, slashbot remplace l'exécuteur aveugle par un orchestrateur avec plugins.
**Success metric**: Un workflow Atelier existant s'exécute via slashbot sans modification de l'API agent-service ↔ Spring Boot.

## Scope

### This Feature Includes

- Interface d'invocation slashbot dans agent-service : `executeStep(payload): AsyncIterator<RunnerEvent>`
- Résolution du runtime compatibility (Bun vs Node.js — décision et mise en œuvre)
- Plugin registry minimal : lookup du plugin approprié selon le type de step
- Shim de compatibilité entre le format d'entrée agent-service et slashbot

### This Feature Does NOT Include

- L'implémentation des plugins (claude-code, etc.) — feature 02
- Le streaming vers Redis/WebSocket — feature 03
- La gestion des callbacks — feature 04

## Key Use Cases

### Use Case 1: Invocation d'un step

**Actor**: agent-service
**Goal**: Déléguer l'exécution d'un step à slashbot
**Flow**:
1. agent-service reçoit `POST /sessions/start` avec payload step
2. agent-service appelle `slashbot.executeStep(payload)`
3. Slashbot lookup le plugin approprié dans son registry
4. Slashbot retourne un `AsyncIterator<RunnerEvent>` que agent-service consomme
5. agent-service forward les events vers l'infrastructure existante (feature 03)

## Dependencies

### Requires

- Aucune feature slashbot préalable

### Enables

- Feature 02 (claude-code plugin)
- Feature 03 (streaming bridge)
- Feature 06 (workflow executor)

## Technical Hints

### Required Tools & Versions

- **TypeScript strict**: interface `RunnerEvent` typée, compatible avec `UnifiedEvent` d'agent-service
- **node-pty**: dépendance native — doit compiler dans le runtime cible

### Implementation Notes

- L'interface cible : `executeStep(payload: StepPayload): AsyncIterator<RunnerEvent>`
- `StepPayload` = ce qu'agent-service passe aujourd'hui à `orchestratorExecutor.ts` (prompt, model, credentials env, workspace path)
- `RunnerEvent` = union type couvrant : `output_chunk`, `ask_user`, `step_complete`, `error`
- Le shim doit être un fichier unique dans agent-service (`src/slashbot/runner.ts`) — pas de restructuration majeure
- **Décision runtime** : évaluer si slashbot peut être buildé en CommonJS/ESM compatible Node.js 20. Si non, évaluer Bun dans le container agent-service (image multi-runtime). Blocker à résoudre en premier.

## Open Questions

- Bun vs Node.js : peut-on builder slashbot (`bun build --target=node`) et l'importer dans Node.js 20 ?
- Format `RunnerEvent` : doit-il être identique au format NDJSON que `orchestratorOutputParser.ts` attend, ou agent-service fait la conversion ?
- Slashbot a-t-il besoin d'un contexte d'initialisation (DI container InversifyJS) au démarrage du module, ou peut-il être invoqué stateless ?
