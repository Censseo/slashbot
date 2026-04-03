# Idea: Node-RED Plugin Integration

**Created**: 2026-02-12
**Status**: Exploration
**Short Name**: nodered-plugin

## Vision

Intégrer Node-RED comme plugin slashbot pour permettre au bot de créer, gérer et exécuter ses propres flows visuels. Les flows sont exposés comme outils MCP que le bot découvre dynamiquement. L'humain peut aussi utiliser l'éditeur visuel Node-RED pour designer des flows. Le bot devient ainsi capable de se "programmer" lui-même en créant des automatisations persistantes.

## Problem Statement

### The Problem
Aujourd'hui, slashbot peut exécuter des commandes bash, planifier des tâches cron, et utiliser des outils MCP externes. Mais il n'a pas de moyen de créer des **automatisations visuelles persistantes** qui combinent plusieurs services, APIs et logiques conditionnelles de manière réutilisable. Chaque interaction est éphémère ou nécessite du code custom.

### Current Situation
- Le bot utilise le scheduling plugin pour des tâches cron simples (commande bash ou prompt LLM)
- Les intégrations complexes nécessitent du code plugin custom en TypeScript
- L'utilisateur doit manuellement configurer des serveurs MCP externes pour étendre les capacités
- Pas de moyen visuel de composer des workflows multi-étapes
- Le bot ne peut pas "apprendre" de nouvelles capacités sans modification de code

### Why Now?
- L'architecture plugin de slashbot est mature avec un système MCP robuste
- Node-RED offre un runtime de flows éprouvé avec 5000+ nodes communautaires
- L'IA est maintenant capable de générer du JSON structuré fiable (flow definitions Node-RED)
- Le besoin d'automatisations personnalisées augmente avec l'usage du bot

## Target Users

### Primary Users
- **Bot (IA autonome)**: Le bot lui-même comme créateur de flows. Crée des automatisations pour répondre à des besoins récurrents, expose de nouvelles capacités via MCP. Niveau technique maximal.
- **Administrateur slashbot**: L'utilisateur qui gère le bot. Peut designer des flows dans l'UI Node-RED, superviser les flows créés par le bot, et gérer le cycle de vie. Niveau technique intermédiaire à avancé.

### Secondary Stakeholders
- Utilisateurs finaux du bot (Telegram/Discord) qui bénéficient des nouvelles capacités créées via les flows

## Goals & Success Metrics

### Primary Goals
1. Le bot peut créer et déployer un flow Node-RED fonctionnel via commande ou décision autonome
2. Les flows déployés sont automatiquement découverts et utilisables comme outils MCP par le bot
3. L'administrateur peut accéder à l'éditeur visuel Node-RED pour créer/modifier des flows

### Success Indicators
- Le bot crée un webhook fonctionnel en < 30 secondes via un prompt
- Les flows MCP apparaissent dans la liste des outils disponibles sans redémarrage
- L'éditeur Node-RED est accessible sur un port configurable
- Les flows persistent entre les redémarrages de slashbot

### MVP Definition
Le bot peut :
1. Lancer/arrêter une instance Node-RED comme processus enfant
2. Créer des flows simples (webhook, automatisation périodique, traitement de données)
3. Exposer les flows comme outils MCP découvrables dynamiquement
4. L'humain peut accéder à l'éditeur visuel Node-RED

## Scope

### In Scope (MVP)
- Gestion du cycle de vie Node-RED (start/stop/restart) comme processus enfant
- CRUD de flows via l'API Admin Node-RED
- Bridge MCP : exposition automatique des flows comme outils MCP
- Génération de flows simples par le bot (webhook, cron, ETL)
- Accès à l'UI Node-RED pour l'administrateur
- Persistance des flows entre redémarrages
- Configuration (port, credentials, nodes autorisés)

### In Scope (Future)
- Création de nodes custom Node-RED par le bot
- Sous-flows et patterns de composition avancés
- Marketplace de flows partagés entre instances slashbot
- Monitoring et métriques des flows (exécutions, erreurs, latence)
- Templates de flows prédéfinis pour cas courants
- Intégration bidirectionnelle (Node-RED déclenche des actions slashbot)

### Explicitly Out of Scope
- Remplacement du système de scheduling existant
- Migration des plugins existants vers Node-RED
- Support de Node-RED en mode cluster/distribué
- Interface de gestion Node-RED custom (on utilise l'UI native)

## Key Use Cases (Sketches)

### Use Case 1: Bot crée un webhook
**Actor**: Bot (IA)
**Goal**: Créer un endpoint HTTP qui reçoit des webhooks GitHub et notifie sur Telegram
**Flow**:
1. L'utilisateur demande : "Crée un webhook pour les push GitHub qui me notifie sur Telegram"
2. Le bot génère un flow Node-RED : HTTP In → Function (parse payload) → Telegram Out
3. Le bot déploie le flow via l'API Admin
4. Le flow est automatiquement exposé comme outil MCP
5. Le bot fournit l'URL du webhook à configurer dans GitHub

### Use Case 2: Bot crée une automatisation
**Actor**: Bot (IA)
**Goal**: Monitorer le prix d'un token Solana toutes les 5 minutes
**Flow**:
1. L'utilisateur demande : "Surveille le prix de SOL et préviens-moi s'il dépasse $200"
2. Le bot crée un flow : Inject (5min) → HTTP Request (API prix) → Function (check seuil) → Notification
3. Le flow tourne en arrière-plan, indépendamment du bot
4. Quand le seuil est atteint, notification via le connector approprié

### Use Case 3: Humain design un flow dans l'éditeur
**Actor**: Administrateur
**Goal**: Créer un flow complexe d'agrégation de données via l'UI visuelle
**Flow**:
1. L'admin accède à l'éditeur Node-RED sur http://localhost:1880
2. Il design un flow avec drag & drop : multiple API calls → merge → transform → output
3. Il déploie le flow et le marque comme "exposé MCP"
4. Le bot découvre automatiquement le nouveau flow comme outil MCP
5. Le bot peut maintenant utiliser ce flow comme n'importe quel autre outil

### Use Case 4: Bot crée un traitement de données
**Actor**: Bot (IA)
**Goal**: Créer un pipeline ETL léger pour agréger des données de plusieurs APIs
**Flow**:
1. L'utilisateur demande : "Crée un flow qui récupère les dernières news crypto et me fait un résumé"
2. Le bot crée : HTTP Request (API 1) + HTTP Request (API 2) → Join → Function (format) → Output
3. Le flow est exposé comme outil MCP "get-crypto-news-summary"
4. Le bot peut ensuite appeler cet outil quand on lui demande les news

## Constraints & Assumptions

### Known Constraints
- **Technical**: Node-RED nécessite Node.js (compatible avec Bun via processus enfant). Le flow JSON doit être généré correctement par l'IA. L'API Admin Node-RED a des limites de taille de payload.
- **Business**: Node-RED est open source (Apache 2.0), pas de contrainte de licence.
- **User**: L'UI Node-RED est accessible uniquement localement par défaut (sécurité).

### Assumptions
- Node.js est disponible sur la machine hôte (ou installable)
- L'instance Node-RED tourne sur la même machine que slashbot
- Les flows créés par le bot utilisent principalement des nodes standard Node-RED
- Le modèle LLM est capable de générer du JSON de flow Node-RED valide avec le bon prompting
- Le port 1880 (ou configurable) est disponible pour Node-RED

## Features Overview

**Complexity Score**: 20.5/10 - Very Complex

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | nodered-lifecycle | Gestion du cycle de vie Node-RED comme processus enfant de slashbot | P1/MVP | None | :pencil: Specified |
| 02 | flow-management | CRUD de flows via l'API Admin Node-RED | P1/MVP | 01 | :pencil: Specified |
| 03 | mcp-bridge | Exposition automatique des flows comme outils MCP | P1/MVP | 02 | :pencil: Specified |
| 04 | ai-flow-authoring | Capacité du bot à générer et déployer des flows | P1/MVP | 02 | :pencil: Specified |
| 05 | nodered-ui-access | Accès humain à l'éditeur visuel Node-RED | P2 | 01 | :pencil: Specified |

**Status Legend**: :white_large_square: Not specified → :pencil: Specified → :white_check_mark: Implemented

### Feature Dependencies Graph

```text
[01-nodered-lifecycle]
    ├── [02-flow-management]
    │       ├── [03-mcp-bridge]
    │       └── [04-ai-flow-authoring]
    └── [05-nodered-ui-access]
```

### Implementation Order

1. **Phase 1 (MVP)**: 01, 02, 03, 04 - Le bot peut créer et utiliser des flows
2. **Phase 2**: 05 - L'humain peut designer des flows dans l'UI

## Open Questions & Risks

### Questions to Resolve
- Comment le bot identifie-t-il quels flows exposer comme MCP ? Convention de nommage ? Metadata dans le flow ?
- Faut-il un mécanisme de "rollback" si un flow déployé par le bot est défaillant ?
- Comment gérer la persistence des credentials Node-RED (API keys utilisées dans les flows) ?
- Quelle stratégie de nommage pour les outils MCP générés à partir des flows ?

### Identified Risks
- **Qualité des flows générés par l'IA**: Le JSON de flow Node-RED est complexe. Mitigation : prompts bien structurés + validation avant déploiement + templates de base
- **Stabilité du processus Node-RED**: Un crash de Node-RED pourrait affecter les flows en cours. Mitigation : health check + auto-restart
- **Consommation de ressources**: Node-RED + ses flows consomment de la mémoire. Mitigation : limites configurables, monitoring
- **Sécurité des flows**: Un flow malformé pourrait exposer des données ou saturer le réseau. Mitigation : validation basique, trust model cohérent avec le bot

## Discovery Notes

### Session 2026-02-12
- Q: Usage principal ? → A: Hybride - bot autonome ET humain peuvent créer/gérer des flows
- Q: Intégration avec slashbot ? → A: MCP dynamique - les flows sont exposés comme outils MCP
- Q: Gestion du cycle de vie Node-RED ? → A: Géré par slashbot comme processus enfant
- Q: Complexité des flows ? → A: Progressif - MVP simple, itération vers l'avancé
- Q: Sécurité ? → A: Confiance - mêmes privilèges que slashbot (cohérent avec bash/filesystem)
- Q: Premier use case MVP ? → A: Tous les trois patterns (webhook, automatisation, traitement de données)

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `npm install -g node-red` ou `npx node-red` | Installation/lancement de Node-RED |
| 2 | Node-RED Admin API (`/flows`, `/flow/:id`) | CRUD des flows |
| 3 | MCP SDK (`@modelcontextprotocol/sdk`) | Déjà disponible dans slashbot |

### Required Tools & Versions

- **Node-RED**: >= 3.x - Runtime de flows visuel
- **Node.js**: >= 18.x - Requis par Node-RED (lancé comme processus enfant séparé de Bun)
- **@modelcontextprotocol/sdk**: déjà intégré - Bridge MCP

### Integration Sequences

1. **Startup**: slashbot init → NodeRedPlugin.init() → spawn node-red process → wait for ready → connect API
2. **Flow creation by bot**: AI generates flow JSON → POST /flows via Admin API → poll for deployment → register as MCP tool
3. **MCP discovery**: Flow deployed → extract HTTP endpoints/triggers → register MCP tool definition → emit prompt:redraw
4. **Shutdown**: slashbot destroy → NodeRedPlugin.destroy() → graceful stop Node-RED process

### Implementation Notes

- Node-RED tourne comme processus enfant Node.js, pas dans le runtime Bun (incompatibilité potentielle)
- L'API Admin Node-RED est REST sur le même port que l'éditeur (1880 par défaut)
- Les flows sont stockés par Node-RED dans `~/.slashbot/nodered/flows.json`
- Le bridge MCP nécessite un mapping flow → tool definition (nom, description, paramètres Zod)
- Utiliser `node-red -s settings.js` pour passer une config custom (port, userDir, etc.)
