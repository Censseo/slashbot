# Feature: AI Flow Authoring

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 04
**Priority**: P1/MVP
**Status**: Specified

## Summary

Capacité du bot à générer des flows Node-RED à partir de descriptions en langage naturel. Le bot comprend les patterns de flows standard (webhook, automatisation, ETL), génère le JSON de flow valide, et le déploie via le FlowManager. Inclut des prompt contributions pour guider l'IA et des templates de base pour les patterns courants.

## User Value

**Who benefits**: Bot (IA), Administrateur slashbot
**What they gain**: Créer des automatisations complexes en décrivant simplement ce qu'on veut en langage naturel, sans toucher à l'éditeur visuel
**Success metric**: Le bot génère un flow fonctionnel dans 80%+ des cas pour les patterns de base (webhook, cron, ETL)

## Scope

### This Feature Includes
- Prompt contribution décrivant les capacités Node-RED et la structure des flows
- Templates de flows pour les 3 patterns MVP : webhook, automatisation périodique, traitement de données
- Actions XML : `<nodered-create-flow>` avec description en langage naturel
- Validation du JSON généré avant déploiement
- Retry avec correction si le flow est invalide
- Documentation des nodes standard utilisables (HTTP in/out, function, inject, debug, change, switch, template)
- Exemples de flows dans le prompt pour guider la génération

### This Feature Does NOT Include
- Création de nodes custom Node-RED
- Sous-flows et patterns avancés (phase future)
- Éditeur visuel (feature 05)
- Exécution directe des flows (feature 03 via MCP bridge)

## Key Use Cases

### Use Case 1: Créer un webhook
**Actor**: Utilisateur → Bot
**Goal**: Créer un endpoint HTTP fonctionnel
**Flow**:
1. L'utilisateur demande : "Crée un webhook qui reçoit des données JSON et les log"
2. Le bot analyse la demande et identifie le pattern : webhook
3. Le bot génère un flow JSON : `http in` → `function` (process) → `http response`
4. Le bot appelle FlowManager.create() avec le flow + metadata
5. Le FlowManager déploie, le MCP Bridge expose l'outil
6. Le bot confirme avec l'URL du webhook et un exemple d'utilisation

### Use Case 2: Créer une automatisation
**Actor**: Utilisateur → Bot
**Goal**: Créer un flow qui s'exécute périodiquement
**Flow**:
1. L'utilisateur demande : "Vérifie le prix de BTC toutes les 10 minutes"
2. Le bot génère un flow : `inject` (repeat 10min) → `http request` (API prix) → `function` (parse) → `debug`
3. Le bot ajoute un node de notification conditionnel si un seuil est mentionné
4. Le bot déploie via FlowManager

### Use Case 3: Créer un pipeline de données
**Actor**: Utilisateur → Bot
**Goal**: Créer un flow ETL
**Flow**:
1. L'utilisateur demande : "Agrège les APIs X et Y et formate le résultat en JSON"
2. Le bot génère un flow : `http in` → parallèle(`http request` API X, `http request` API Y) → `join` → `function` (merge/format) → `http response`
3. Le bot déploie et expose comme outil MCP

## Dependencies

### Requires
- [Feature 02: flow-management]: Pour déployer les flows générés via FlowManager

### Enables
- Aucune feature directe, mais les flows créés sont automatiquement exposés via Feature 03 (MCP Bridge)

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | Prompt contribution avec exemples de flows JSON | Guider la génération par l'IA |
| 2 | FlowManager.create(flowJson, metadata) | Déployer le flow généré |
| 3 | Validation JSON schema du flow | Vérifier avant déploiement |

### Required Tools & Versions

- **zod**: déjà intégré - Pour la validation du schema de flow
- **FlowManager** (feature 02): Pour le CRUD

### Implementation Notes

- **Prompt contribution** (priorité ~150, même zone que MCP) :
  - Décrire la structure JSON d'un flow Node-RED
  - Lister les nodes standard disponibles avec leurs propriétés
  - Fournir 3-5 exemples de flows complets (un par pattern)
  - Expliquer la convention de wiring (`wires: [["node-id"]]`)
  - Documenter comment marquer un flow comme MCP-exposable
- **Templates de base** (embarqués dans le plugin) :
  ```
  templates/
    webhook.json       - HTTP In → Function → HTTP Response
    cron.json          - Inject (repeat) → Processing → Output
    etl.json           - HTTP In → Multiple HTTP Requests → Join → Format → HTTP Response
  ```
- **Validation** : Vérifier que :
  - Le JSON est un array d'objets avec `id`, `type`
  - Il y a au moins un node `tab` (flow container)
  - Les `wires` référencent des IDs existants
  - Les types de nodes utilisés sont des nodes standard installés
- **Génération d'IDs** : Les IDs Node-RED sont des strings hex de 16 caractères. Utiliser `crypto.randomBytes(8).toString('hex')`
- **Coordonnées** : Générer des x/y raisonnables pour que le flow soit lisible dans l'éditeur (x = 200 * position dans le flow, y = 100 * index parallèle)
- **Retry** : Si le déploiement échoue, parser l'erreur Node-RED et tenter une correction (max 2 retries)

## Open Questions

- Faut-il un mode "dry-run" où le bot montre le flow avant de le déployer, pour validation humaine ?
- Comment gérer les credentials dans les flows (ex: API keys pour les HTTP requests) ?
- Le bot doit-il pouvoir modifier un flow existant, ou seulement créer/supprimer ?

## Notes

- La qualité de la génération dépend fortement du prompting. Des exemples concrets dans le prompt sont essentiels.
- Les modèles modernes (Claude, GPT-4) sont très capables de générer du JSON structuré valide.
- À terme, on pourrait fine-tuner les prompts avec des flows qui ont fonctionné vs échoué.
