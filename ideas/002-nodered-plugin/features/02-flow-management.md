# Feature: Flow Management API

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P1/MVP
**Status**: Specified

## Summary

Couche d'abstraction pour le CRUD de flows Node-RED via l'API Admin REST. Permet au bot et aux autres features de créer, lire, modifier et supprimer des flows programmatiquement. Gère la validation des flows, le déploiement, et le suivi des flows actifs.

## User Value

**Who benefits**: Bot (IA), Feature 03 (MCP Bridge), Feature 04 (AI Authoring)
**What they gain**: Une API propre et fiable pour manipuler les flows Node-RED sans connaître les détails de l'API Admin
**Success metric**: CRUD complet fonctionnel, déploiement d'un flow en < 5 secondes, validation qui rejette les flows invalides

## Scope

### This Feature Includes
- Service `FlowManager` injectable via DI
- Opérations CRUD : create, read, update, delete flows
- Listing des flows actifs avec metadata
- Validation basique des flows avant déploiement (structure JSON valide, nodes requis présents)
- Déploiement de flows (POST /flows) avec gestion des erreurs
- Metadata custom sur les flows (créateur: bot/humain, date, description, tags)
- Persistance automatique par Node-RED (flows.json)
- Actions XML et tools pour le bot : `<nodered-flow-create>`, `<nodered-flow-list>`, `<nodered-flow-delete>`

### This Feature Does NOT Include
- Génération intelligente de flows par l'IA (feature 04)
- Exposition comme MCP (feature 03)
- Gestion du processus Node-RED (feature 01)
- Éditeur visuel (feature 05)

## Key Use Cases

### Use Case 1: Créer un flow programmatiquement
**Actor**: Bot ou Feature 04
**Goal**: Déployer un nouveau flow dans Node-RED
**Flow**:
1. Le caller fournit un JSON de flow Node-RED valide + metadata
2. FlowManager valide la structure du flow
3. FlowManager envoie POST /flow à l'API Admin
4. Node-RED déploie le flow
5. FlowManager stocke la metadata additionnelle
6. FlowManager émet `flow:created` avec l'ID du flow
7. Retour : ID du flow + URL des endpoints (si HTTP nodes)

### Use Case 2: Lister les flows actifs
**Actor**: Bot
**Goal**: Voir quels flows sont déployés
**Flow**:
1. Le bot utilise l'action `<nodered-flow-list />`
2. FlowManager appelle GET /flows sur l'API Admin
3. FlowManager enrichit avec les metadata custom (créateur, description)
4. Retour : liste des flows avec ID, nom, type, statut, metadata

### Use Case 3: Supprimer un flow
**Actor**: Bot ou Administrateur
**Goal**: Retirer un flow qui n'est plus nécessaire
**Flow**:
1. Le caller demande la suppression par ID ou nom
2. FlowManager vérifie que le flow existe
3. FlowManager envoie DELETE /flow/:id à l'API Admin
4. FlowManager nettoie la metadata
5. FlowManager émet `flow:deleted`
6. Le MCP Bridge (feature 03) est notifié pour retirer l'outil MCP correspondant

## Dependencies

### Requires
- [Feature 01: nodered-lifecycle]: Instance Node-RED running + API accessible

### Enables
- [Feature 03: mcp-bridge]: Fournit les flows à exposer comme MCP tools
- [Feature 04: ai-flow-authoring]: Fournit l'API de déploiement pour les flows générés

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `GET http://localhost:1880/flows` | Lister tous les flows |
| 2 | `POST http://localhost:1880/flow` | Créer un flow |
| 3 | `GET http://localhost:1880/flow/:id` | Lire un flow |
| 4 | `PUT http://localhost:1880/flow/:id` | Modifier un flow |
| 5 | `DELETE http://localhost:1880/flow/:id` | Supprimer un flow |

### Required Tools & Versions

- **Node-RED Admin API**: v3.x - REST API pour la gestion des flows
- **Bun fetch**: natif - Pour les appels HTTP à l'API Admin

### Implementation Notes

- L'API Admin Node-RED utilise le header `Node-RED-Deployment-Type: flows` pour le type de déploiement
- Les flows sont des objets JSON avec `id`, `type: "tab"`, `label`, et des arrays de nodes
- Chaque node a un `id`, `type`, `x`, `y`, `wires` (connexions)
- La metadata custom (créateur, tags) peut être stockée dans un fichier séparé `~/.slashbot/nodered/flow-metadata.json`
- Le service `FlowManager` doit être enregistré comme `TYPES.FlowManager` dans le DI container
- Écouter l'événement `nodered:ready` avant de permettre les opérations
- Les événements émis (`flow:created`, `flow:updated`, `flow:deleted`) permettent au MCP Bridge de réagir

## Open Questions

- Comment identifier de manière fiable les flows "exposables" comme MCP ? Annotation dans le flow ? Convention de nommage ?
- Faut-il un système de versioning des flows (historique des modifications) ?
- Comment gérer les flows qui dépendent de nodes non installés ?

## Notes

- L'API Admin Node-RED est bien documentée : https://nodered.org/docs/api/admin/
- Le format JSON des flows est le format standard d'export/import de Node-RED
- Les coordonnées x/y des nodes ne sont pas critiques pour l'exécution, seulement pour l'affichage dans l'éditeur
