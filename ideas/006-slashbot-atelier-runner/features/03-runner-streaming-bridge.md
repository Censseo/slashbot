# Feature: Runner Streaming Bridge

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Bridge entre les `RunnerEvent` émis par slashbot et l'infrastructure Redis/WebSocket existante d'agent-service. Slashbot n'écrit pas lui-même dans Redis — il délègue à ce bridge qui traduit ses events dans le format attendu par `sessionStreamer.ts`. L'UI Atelier voit les outputs sans modification.

## User Value

**Who benefits**: Atelier user
**What they gain**: Le streaming de l'exécution apparaît dans l'UI Atelier exactement comme avant — aucune régression visible.
**Success metric**: Les events slashbot s'affichent dans l'UI Atelier en temps réel, format identique à l'existant.

## Scope

### This Feature Includes

- Consommation du `AsyncIterator<RunnerEvent>` retourné par slashbot
- Traduction `RunnerEvent` → format `sessionStreamer.ts` (`OutputChunk`, `ContentBlock`, etc.)
- Publication vers Redis Stream (`agent:stream:{sessionId}`) et Redis pub/sub lifecycle
- Gestion du ring buffer catch-up (`agent:buffer:{sessionId}`) pour les clients qui se reconnectent
- Propagation des events de fin de session (`step_complete`, `error`, `cancelled`)

### This Feature Does NOT Include

- La logique de production des events (feature 02)
- Le WebSocket server côté client (déjà dans agent-service)
- La gestion des `ask_user` events — feature 04 (ce bridge les laisse passer ou les intercepte selon config)

## Key Use Cases

### Use Case 1: Streaming output temps réel

**Actor**: agent-service (bridge)
**Goal**: Publier l'output slashbot vers l'UI Atelier
**Flow**:
1. Bridge consomme chaque event du `AsyncIterator`
2. Pour chaque `output_chunk` : `xadd agent:stream:{sessionId} data <json>`
3. Pour chaque `content_block_*` : format ContentBlock si `contentBlockEnabled`
4. Pour `step_complete` : publish lifecycle event `COMPLETED`
5. UI Atelier reçoit via WebSocket existant

### Use Case 2: Client reconnexion (catch-up)

**Actor**: Atelier frontend (reconnect)
**Goal**: Récupérer les events manqués
**Flow**:
1. Client se reconnecte avec `lastEventId`
2. Bridge (via `buffer.ts` existant) rejoue depuis le ring buffer
3. Client rattrape le stream sans perte

## Dependencies

### Requires

- Feature 01 (slashbot runner module — produit l'AsyncIterator)

### Enables

- Feature 04 (callback handler — co-consomme le même stream)

## Technical Hints

### Implementation Notes

- Ce bridge vit dans agent-service, pas dans slashbot — il consomme l'interface slashbot
- Réutiliser `sessionStreamer.ts` tel quel — le bridge est juste une couche de traduction en amont
- Format de traduction minimal : `output_chunk` → `OutputChunk { type: 'text', content: string }`; `content_block_*` → passer tel quel si slashbot les émet déjà dans le bon format
- Le bridge doit gérer le backpressure : si Redis est lent, il doit bufferiser ou dropper gracefully

## Open Questions

- Slashbot émet-il déjà des `ContentBlock` structurés (format feature 072/074 Atelier), ou émet-il du texte brut ?
- Le bridge doit-il filtrer les `ask_user` events avant de les publier sur Redis, ou les publier aussi (pour log dans l'UI) ?
