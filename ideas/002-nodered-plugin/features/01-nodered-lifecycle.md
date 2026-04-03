# Feature: Node-RED Lifecycle Management

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Specified

## Summary

Plugin slashbot qui gère le cycle de vie complet d'une instance Node-RED en tant que processus enfant. Inclut le démarrage, l'arrêt, le redémarrage, le health check, et la configuration. C'est la fondation sur laquelle toutes les autres features reposent.

## User Value

**Who benefits**: Administrateur slashbot, Bot (IA)
**What they gain**: Une instance Node-RED automatiquement gérée, sans configuration manuelle ni gestion de processus externe
**Success metric**: Node-RED démarre automatiquement avec slashbot et reste stable (uptime > 99%), redémarrage automatique en cas de crash

## Scope

### This Feature Includes
- Spawn de Node-RED comme processus enfant Node.js
- Configuration dynamique (port, userDir, credentials)
- Health check périodique (ping API)
- Auto-restart en cas de crash
- Graceful shutdown lors de l'arrêt de slashbot
- Commandes slash : `/nodered start`, `/nodered stop`, `/nodered status`, `/nodered restart`
- Sidebar TUI : indicateur d'état Node-RED (running/stopped/error)
- Stockage de la config dans `~/.slashbot/config/nodered.json`
- Création du userDir Node-RED dans `~/.slashbot/nodered/`

### This Feature Does NOT Include
- CRUD de flows (feature 02)
- Bridge MCP (feature 03)
- Génération de flows par l'IA (feature 04)
- Configuration de l'éditeur UI (feature 05)

## Key Use Cases

### Use Case 1: Démarrage automatique
**Actor**: slashbot (system)
**Goal**: Node-RED démarre avec slashbot
**Flow**:
1. slashbot s'initialise et charge le NodeRedPlugin
2. Le plugin génère un `settings.js` à partir de la config
3. Le plugin spawn `node node-red -s settings.js`
4. Le plugin attend le ready (poll sur `/` ou stdout "Started flows")
5. Le plugin émet un événement `nodered:ready`
6. Le sidebar TUI affiche "Node-RED: Running"

### Use Case 2: Auto-restart après crash
**Actor**: NodeRedPlugin (monitoring)
**Goal**: Redémarrer Node-RED si le processus crash
**Flow**:
1. Le health check détecte que Node-RED ne répond plus
2. Le plugin log l'erreur et émet `nodered:error`
3. Le plugin tente un restart (max 3 tentatives avec backoff)
4. Si succès : émet `nodered:ready`, met à jour le sidebar
5. Si échec après 3 tentatives : émet `nodered:failed`, alerte l'utilisateur

### Use Case 3: Arrêt manuel
**Actor**: Administrateur
**Goal**: Arrêter Node-RED temporairement
**Flow**:
1. L'admin tape `/nodered stop`
2. Le plugin envoie SIGTERM au processus Node-RED
3. Attend le graceful shutdown (timeout 10s, puis SIGKILL)
4. Met à jour le sidebar : "Node-RED: Stopped"

## Dependencies

### Requires
- Aucune feature slashbot (c'est la fondation)
- Node.js installé sur la machine hôte

### Enables
- [Feature 02: flow-management]: Fournit l'instance Node-RED sur laquelle opérer
- [Feature 03: mcp-bridge]: Fournit le runtime pour exécuter les flows
- [Feature 05: nodered-ui-access]: Fournit le serveur web de l'éditeur

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `which node` | Vérifier que Node.js est disponible |
| 2 | `node -e "require('node-red')"` ou `npx node-red --help` | Vérifier que Node-RED est installable/disponible |
| 3 | `node node_modules/node-red/red.js -s settings.js` | Lancer Node-RED avec config custom |

### Required Tools & Versions

- **Node.js**: >= 18.x - Runtime pour Node-RED
- **node-red**: >= 3.x - Installé localement dans `~/.slashbot/nodered/node_modules/`

### Implementation Notes

- Utiliser `child_process.spawn` (via Bun) pour lancer Node-RED
- Le `settings.js` doit configurer : `httpAdminRoot`, `httpNodeRoot`, `userDir`, `flowFile`, `functionGlobalContext`
- Le port doit être configurable (défaut: 1880) et stocké dans `~/.slashbot/config/nodered.json`
- Le health check doit utiliser `fetch('http://localhost:{port}/')` avec un intervalle configurable (défaut: 30s)
- Penser à `NODE_PATH` pour que Node-RED trouve ses modules
- Le plugin doit s'enregistrer dans le DI container comme `TYPES.NodeRedManager`
- Émettre des événements : `nodered:ready`, `nodered:stopped`, `nodered:error`, `nodered:failed`

## Open Questions

- Faut-il installer Node-RED automatiquement si absent, ou demander à l'utilisateur de l'installer ?
- Le plugin doit-il démarrer Node-RED automatiquement au boot, ou attendre une commande explicite ?
- Quel mécanisme de log pour les stdout/stderr de Node-RED ? Fichier de log dédié ?

## Notes

- Ce plugin suit le pattern exact du BashPlugin (ProcessManager) pour la gestion de processus
- S'inspirer du MCPPlugin pour la gestion de connexions avec health check
- La configuration est similaire au pattern ConfigManager déjà utilisé dans slashbot
