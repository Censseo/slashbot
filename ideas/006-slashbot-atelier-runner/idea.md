# Idea: Slashbot as Atelier Runner

**Created**: 2026-04-03
**Status**: Exploration
**Short Name**: slashbot-atelier-runner

## Vision

Slashbot devient un module embarqué dans l'agent-service d'Atelier, remplaçant l'invocation directe de `claude cli`. Là où Atelier spawne aujourd'hui un processus Claude Code CLI (boîte noire), il invoque demain slashbot — un orchestrateur intelligent avec son système de plugins. Claude Code CLI redevient un outil parmi d'autres, enregistré via un plugin, que slashbot peut spawner comme sous-agent si le workflow l'exige.

## Problem Statement

### The Problem

Atelier's current runner architecture is rigid: every "agentic node" in a workflow spawns Claude Code CLI directly. L'orchestrateur Spring Boot prend les décisions, l'agent-service exécute aveuglément. Il n'y a pas de couche d'intelligence entre la décision d'orchestration et l'exécution — impossible d'adapter dynamiquement le comportement, de chaîner des outils différents, ou de gérer finement les callbacks.

### Current Situation

- Spring Boot orchestrator décide → agent-service spawne `claude` → output PTY → Redis/WebSocket
- Les nœuds agentiques ne peuvent invoquer que Claude Code CLI
- Les callbacks (`ask_user`) remontent toujours à l'UI Atelier — pas d'auto-réponse native dans le runner
- Les décisions de branchement sont évaluées côté Spring Boot, sans contexte d'exécution runtime

### Why Now?

Slashbot a déjà un système de plugins, de sessions, et un SDK d'outils. L'agent-service a déjà l'infrastructure de streaming (PTY, Redis, WebSocket). Les deux sont mûrs pour être combinés. L'architecture "module embarqué" évite de créer une nouvelle surface d'API et capitalise sur l'existant.

## Target Users

### Primary Users

- **Atelier Workflow Author**: Définit des workflows YAML avec des nœuds agentiques. Gagne la capacité de brancher différents outils/agents selon le contexte.
- **Atelier User**: Déclenche un workflow depuis l'UI Atelier. Voit le streaming de l'exécution, répond aux questions si nécessaire.

### Secondary Stakeholders

- **Atelier Backend (Spring Boot)**: Consomme le même protocole runner qu'aujourd'hui — aucun changement requis côté orchestrateur.

## Goals & Success Metrics

### Primary Goals

1. Slashbot s'intègre dans agent-service comme module TypeScript — agent-service peut l'invoquer sans spawner un processus externe.
2. Claude Code CLI devient un plugin slashbot enregistrable — activé uniquement si le workflow en a besoin.
3. Slashbot peut répondre automatiquement aux callbacks de sous-agents sans remonter à l'utilisateur.

### Success Indicators

- Un workflow Atelier existant s'exécute via slashbot sans modifier le protocole agent-service ↔ Spring Boot
- Slashbot peut spawner Claude Code CLI comme sous-agent et streamer son output vers Atelier
- Les callbacks auto-répondus ne bloquent plus le workflow

### MVP Definition

Slashbot embarqué dans agent-service, capable de spawner Claude Code CLI en sous-agent, avec streaming output vers Atelier via l'infrastructure Redis/WebSocket existante.

## Scope

### In Scope (MVP)

- Module slashbot embeddable dans agent-service (interface d'invocation compatible)
- Plugin `claude-code` : spawne `claude cli` en subprocess, capture PTY, parse NDJSON
- Streaming output slashbot → infrastructure Redis existante d'agent-service
- Callback handler : reçoit `ask_user` du sous-agent, route vers Atelier WebSocket UI

### In Scope (Future)

- Auto-répondeur : slashbot répond aux callbacks avec le contexte des artefacts
- Orchestration de workflows : slashbot lit et exécute les YAML de workflow Atelier
- Decision engine : slashbot évalue les conditions de branchement en runtime
- Plugins additionnels (non-Claude Code) : MCP tools, HTTP calls, scripts custom

### Explicitly Out of Scope

- Remplacement de l'orchestrateur Spring Boot (il continue de piloter le flux haut niveau)
- Migration de l'UI Atelier
- Protocole de communication slashbot ↔ Atelier différent de celui d'agent-service actuel
- Multi-tenant / isolation entre users (géré par Docker, hors scope slashbot)

## Key Use Cases

### Use Case 1: Workflow agentic node via slashbot

**Actor**: Atelier (Spring Boot orchestrator)
**Goal**: Exécuter un nœud agentique d'un workflow
**Flow**:
1. Atelier POST `/sessions/start` sur agent-service avec payload workflow step
2. agent-service invoque slashbot (module embarqué) avec le prompt du step
3. Slashbot détermine qu'un sous-agent Claude Code est requis (plugin enregistré)
4. Slashbot spawne `claude cli` avec le prompt, capture PTY output
5. Output streamé → Redis → WebSocket Atelier → UI user
6. Session terminée, résultat retourné à Spring Boot

### Use Case 2: Auto-réponse callback

**Actor**: Claude Code CLI (sous-agent)
**Goal**: Poser une question sans bloquer le workflow
**Flow**:
1. Sous-agent émet un `ask_user` dans son output NDJSON
2. Slashbot intercepte l'event avant qu'il remonte à l'UI
3. Slashbot génère une réponse contextuelle (artefacts disponibles, règles du workflow)
4. Slashbot injecte la réponse dans le subprocess → exécution continue
5. L'UI Atelier voit l'échange (question + réponse auto) loggé

### Use Case 3: Plugin claude-code non enregistré

**Actor**: Slashbot (exécutant un step)
**Goal**: Exécuter un step sans Claude Code (outil différent)
**Flow**:
1. agent-service invoque slashbot avec un step de type `http-call`
2. Slashbot route vers le plugin HTTP (enregistré)
3. Résultat streamé directement, sans spawner Claude Code
4. Spring Boot reçoit le résultat dans le même format

## Constraints & Assumptions

### Known Constraints

- **Runtime**: agent-service est Node.js, slashbot est Bun — l'intégration doit être résolue (module commun, ou slashbot porté en Node.js compatible, ou IPC léger)
- **Protocol**: Le protocole agent-service ↔ Spring Boot ne doit pas changer (rétrocompatibilité)
- **PTY**: Le spawn Claude Code CLI nécessite node-pty (déjà disponible dans agent-service)
- **Auth**: Les credentials Claude (OAuth token / API key) sont injectés via les env vars Docker existantes

### Assumptions

- Slashbot peut être packagé comme module Node.js/TypeScript compatible avec agent-service (ou que Bun est accepté dans le container agent-service)
- Le protocole de sortie de slashbot vers agent-service est NDJSON compatible avec `orchestratorOutputParser.ts` existant, ou un shim minimal suffit
- Les artefacts de workflow (spec, plan, tasks) sont accessibles à slashbot via les APIs Atelier existantes pour l'auto-répondeur

## Features Overview

**Complexity Score**: 20/10 — Very Complex

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | slashbot-runner-module | Embeddable slashbot module dans agent-service, interface d'invocation compatible protocole existant | P1/MVP | None | 🔲 Not specified |
| 02 | claude-code-subagent-plugin | Plugin slashbot qui spawne Claude Code CLI en subprocess PTY, parse NDJSON, stream output | P1/MVP | 01 | 🔲 Not specified |
| 03 | runner-streaming-bridge | Bridge output slashbot → infrastructure Redis/WebSocket d'agent-service | P1/MVP | 01 | 🔲 Not specified |
| 04 | callback-handler | Interception et routing des `ask_user` du sous-agent (vers UI Atelier ou auto-réponse) | P2 | 02, 03 | 🔲 Not specified |
| 05 | auto-responder | Génération de réponses contextuelles aux callbacks sans intervention utilisateur | P2 | 04 | 🔲 Not specified |
| 06 | workflow-executor | Lecture et exécution des YAML workflow Atelier dans slashbot (steps, transitions, state) | P3 | 01, 02, 04 | 🔲 Not specified |
| 07 | decision-engine | Évaluation des conditions de branchement en runtime dans slashbot | P3 | 06 | 🔲 Not specified |

**Status Legend**: 🔲 Not specified → 📝 Specified → ✅ Implemented

### Feature Dependencies Graph

```text
[01-slashbot-runner-module]
    ├── [02-claude-code-subagent-plugin]
    │       └── [04-callback-handler]
    │               └── [05-auto-responder]
    ├── [03-runner-streaming-bridge]
    └── [06-workflow-executor]
            └── [07-decision-engine]
```

### Implementation Order

1. **Phase 1 (MVP)**: 01 → 03 → 02 (runner embarqué + streaming + spawn Claude Code)
2. **Phase 2**: 04 → 05 (callbacks + auto-réponse)
3. **Phase 3**: 06 → 07 (orchestration complète + décisions)

## Open Questions & Risks

### Questions to Resolve

- **Runtime compatibility**: Bun vs Node.js — peut-on builder slashbot en module Node.js compatible ? Ou doit-on embarquer Bun dans le container agent-service ?
- **Output protocol**: Slashbot doit-il émettre du NDJSON compatible `orchestratorOutputParser.ts`, ou agent-service s'adapte à un nouveau format ?
- **Workflow ownership**: Qui lit les YAML de workflow — Spring Boot reste owner en Phase 1-2, slashbot prend en Phase 3 ?
- **Credentials**: Slashbot accède aux credentials Claude via les env vars Docker injectées par agent-service — suffisant ou faut-il un mécanisme de credential forwarding dédié ?

### Identified Risks

- **Runtime mismatch** (High): Bun ≠ Node.js — certains modules natifs (node-pty) pourraient ne pas fonctionner sous Bun. Mitigation : évaluer portage slashbot vers Node.js ou accepter Bun dans le container.
- **Protocol drift** (Medium): Si slashbot change son format de sortie, `orchestratorOutputParser.ts` casse. Mitigation : définir un contrat d'interface stable dès la feature 01.
- **Scope creep** (Medium): Le workflow executor (F06) est tentant à faire tôt mais risque de bloquer le MVP. Mitigation : Phase 3 strictement après validation MVP.

## Discovery Notes

### Session 2026-04-03

- Q: Cas d'usage principal → A: A + B (orchestrer les workflows Atelier, exécuter les nœuds agentiques)
- Q: Isolation → A: Pas critique MVP, Docker géré par agent-service
- Q: Modèle intégration → A: B — slashbot remplace l'orchestrateur, pas pilote externe
- Q: Invocation Claude Code → A: Slashbot spawne directement (Bun spawn + PTY)
- Q: Interface slashbot ↔ Atelier → A: C — slashbot s'enregistre comme runner dans agent-service
- **Pivot**: Slashbot vit dans agent-service comme module, remplace `claude cli` dans la chaîne. Claude Code devient un plugin.

## Technical Hints

### Required Tools & Versions

- **node-pty**: déjà dans agent-service — réutiliser pour spawn Claude Code CLI
- **Bun 1.0+** ou **Node.js 20 LTS**: selon décision runtime compatibility
- **ioredis**: déjà dans agent-service — streaming vers Redis
- **Zod v4**: validation schemas plugins slashbot

### Integration Sequences

```
agent-service (Node.js)
  └── invokes slashbot module
        ├── plugin registry (lookup tool for step type)
        └── claude-code plugin
              ├── spawn `claude --output-format stream-json ...` via node-pty
              ├── parse NDJSON line by line
              ├── intercept ask_user events → callback-handler
              └── forward other events → runner-streaming-bridge → Redis → WS
```

### Implementation Notes

- L'interface d'invocation slashbot dans agent-service doit être un shim minimal — idéalement 1 fichier qui expose `executeStep(payload): AsyncIterator<Event>`
- Le plugin `claude-code` réutilise la logique de `orchestratorExecutor.ts` existant dans agent-service (parsing NDJSON, gestion PTY) — ne pas réécrire from scratch
- Phase 1 : slashbot est un module stateless (pas de persistance propre) — agent-service garde la main sur Redis/session state
