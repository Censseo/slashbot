# Feature: MCP Bridge

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P1/MVP
**Status**: Specified

## Summary

Bridge automatique entre les flows Node-RED et le système MCP de slashbot. Quand un flow est déployé avec un endpoint HTTP ou un trigger identifiable, il est automatiquement exposé comme un outil MCP que le bot peut découvrir et utiliser. Ce bridge rend les flows immédiatement opérationnels pour l'IA sans configuration manuelle.

## User Value

**Who benefits**: Bot (IA)
**What they gain**: Chaque flow créé devient automatiquement un outil que le bot peut invoquer, sans étape manuelle de configuration
**Success metric**: Un flow déployé est disponible comme outil MCP en < 10 secondes, le bot peut l'invoquer correctement dès la première tentative

## Scope

### This Feature Includes
- Détection automatique des flows "exposables" (convention ou annotation)
- Génération de tool definitions MCP à partir des flows (nom, description, paramètres)
- Registration dynamique des tools dans le ToolRegistry de slashbot
- Invocation des flows via HTTP (appel au endpoint Node-RED)
- Parsing des réponses et conversion en ActionResult
- Mise à jour dynamique quand des flows sont ajoutés/modifiés/supprimés
- Metadata MCP : description lisible, paramètres typés, exemples

### This Feature Does NOT Include
- Création des flows eux-mêmes (features 02 et 04)
- Gestion du processus Node-RED (feature 01)
- Serveur MCP standard (on utilise le système de tools natif, pas un serveur MCP séparé)

## Key Use Cases

### Use Case 1: Auto-discovery d'un nouveau flow
**Actor**: System (MCP Bridge)
**Goal**: Exposer automatiquement un flow comme outil MCP
**Flow**:
1. Le FlowManager émet `flow:created` avec les détails du flow
2. Le MCP Bridge analyse le flow pour identifier les endpoints HTTP
3. Le Bridge extrait : URL de l'endpoint, méthode HTTP, paramètres attendus
4. Le Bridge génère une tool definition (nom, description, schema Zod des params)
5. Le Bridge enregistre le tool dans le ToolRegistry
6. Le Bridge émet `prompt:redraw` pour mettre à jour le prompt système
7. Le bot voit le nouvel outil disponible dans sa prochaine interaction

### Use Case 2: Le bot invoque un flow
**Actor**: Bot (IA)
**Goal**: Utiliser un flow Node-RED comme outil
**Flow**:
1. Le bot décide d'utiliser l'outil `nodered:check-sol-price` (flow créé précédemment)
2. Le ToolRegistry route vers le handler du MCP Bridge
3. Le Bridge construit la requête HTTP vers l'endpoint Node-RED correspondant
4. Le Bridge envoie la requête et attend la réponse
5. Le Bridge parse la réponse et retourne un ActionResult structuré
6. Le bot reçoit le résultat et peut le traiter

### Use Case 3: Flow supprimé - retrait de l'outil
**Actor**: System (MCP Bridge)
**Goal**: Retirer un outil MCP quand son flow est supprimé
**Flow**:
1. Le FlowManager émet `flow:deleted`
2. Le MCP Bridge déssenregistre l'outil correspondant du ToolRegistry
3. Le Bridge émet `prompt:redraw`
4. Le bot ne voit plus l'outil dans ses interactions suivantes

## Dependencies

### Requires
- [Feature 02: flow-management]: Fournit les événements flow:created/deleted et l'accès aux flows
- ToolRegistry de slashbot (core): Pour enregistrer/désenregistrer les tools

### Enables
- [Feature 04: ai-flow-authoring]: Les flows créés par l'IA sont immédiatement utilisables grâce au bridge

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | Écoute événements `flow:created`, `flow:updated`, `flow:deleted` | Réagir aux changements de flows |
| 2 | `GET http://localhost:1880/flow/:id` | Analyser le flow pour extraire les endpoints |
| 3 | `POST/GET http://localhost:1880/<endpoint>` | Invoquer le flow via son endpoint HTTP |

### Required Tools & Versions

- **ToolRegistry** (slashbot core): Pour enregistrer les tools dynamiquement
- **EventBus** (slashbot core): Pour écouter les événements de flow

### Implementation Notes

- **Convention d'exposition** : Un flow est exposable comme MCP si :
  - Il contient un node `http in` (endpoint HTTP) → tool avec paramètres = query/body params
  - Il a une annotation/metadata `mcp: true` dans sa description
  - Il suit la convention de nommage `mcp-<tool-name>` dans le label du flow
- **Mapping flow → tool** :
  - Nom du tool : dérivé du label du flow (slugifié, préfixé `nodered:`)
  - Description : description du flow ou auto-générée
  - Paramètres : extraits des nodes `http in` (query params) ou `function` (documented inputs)
  - Handler : HTTP call vers l'endpoint Node-RED local
- **Schema Zod** : Pour le MVP, les paramètres sont `z.object({ input: z.string().optional() })` sauf si le flow documente ses params
- **Cycle de vie** : Le bridge doit scanner les flows existants au démarrage (après `nodered:ready`) pour reconstruire les tools
- **Performance** : Les appels sont locaux (localhost), donc latence minimale
- S'inspirer du pattern `MCPPlugin.registerToolParsers()` qui fait exactement ce mapping dynamique

## Open Questions

- Comment extraire automatiquement les paramètres attendus d'un flow ? Analyser les nodes `http in` + `function` ?
- Faut-il supporter des flows sans endpoint HTTP (par ex. flows déclenchés par inject) comme tools MCP ?
- Comment gérer les flows qui retournent des streams ou des réponses asynchrones ?

## Notes

- Le MCPPlugin existant fait déjà du mapping dynamique de tools externes → tools slashbot. Ce bridge fait la même chose mais pour les flows Node-RED locaux.
- À terme, on pourrait aussi implémenter un vrai serveur MCP qui wrape Node-RED, mais pour le MVP, le mapping direct vers le ToolRegistry est plus simple et performant.
