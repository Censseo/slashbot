# Idea: Slashbot Home Assistant Integration

**Created**: 2026-02-12
**Status**: Exploration
**Short Name**: homeassistant

## Vision

Transformer slashbot en agent autonome au sein de l'ecosysteme Home Assistant, capable d'interagir avec les services HA (entites, Grocy, MQTT, Node-RED) pour automatiser la gestion du quotidien : inventaires, recettes, menus, listes de courses, lecture de capteurs, declenchement d'automations. Accessible via tous les canaux existants (Telegram, Discord, CLI) ainsi qu'un panel chat natif dans HA et l'Assist pipeline.

## Problem Statement

### The Problem
Les assistants IA dans Home Assistant (OpenAI Conversation, Google Generative AI) sont limites a la conversation et aux commandes vocales basiques. Ils ne peuvent pas executer des actions complexes, interroger des services tiers comme Grocy, ou orchestrer des workflows multi-services. Les utilisateurs doivent jongler entre plusieurs interfaces pour gerer leur quotidien (app Grocy, dashboard HA, Node-RED editor).

### Current Situation
- Les integrations IA de HA sont des "conversation agents" passifs sans capacites d'agent
- Grocy a une interface web separee, peu pratique au quotidien
- Les automations Node-RED necessitent de passer par l'editeur visuel
- Pas de moyen unifie de demander "qu'est-ce qu'il reste dans le frigo ?" ou "ajoute du lait a la liste de courses" a un agent intelligent qui execute l'action

### Why Now?
- Slashbot dispose deja d'une architecture de connecteurs et plugins extensible
- Le pattern Add-on + Integration HACS est bien etabli dans l'ecosysteme HA
- La demande pour des agents IA capables d'actions (pas juste de la conversation) explose
- L'ecosysteme HA (Grocy, Node-RED, MQTT) offre des APIs riches mais sous-exploitees par les assistants actuels

## Target Users

### Primary Users
- **Power User HA**: Administrateur Home Assistant, a l'aise avec Docker, YAML, les add-ons. Veut un assistant IA qui comprend son ecosysteme et peut agir dessus. Utilise deja Grocy, Node-RED, MQTT.
- **Household Member**: Membre du foyer, utilise Telegram/Discord ou l'interface HA. Veut pouvoir demander des infos (inventaire, capteurs) et declencher des actions en langage naturel sans toucher aux interfaces techniques.

### Secondary Stakeholders
- Communaute Home Assistant (HACS) - adoption et feedback
- Developpeurs de plugins slashbot - nouveau terrain d'extension

## Goals & Success Metrics

### Primary Goals
1. Permettre a slashbot de lire et controler les entites Home Assistant (sensors, switches, scripts, automations)
2. Offrir une gestion complete de Grocy via langage naturel (inventaire, recettes, menus, listes de courses)
3. Interagir avec les capteurs MQTT et declencher des actions via Node-RED
4. Etre accessible depuis tous les canaux (HA panel, Telegram, Discord, CLI, Assist)

### Success Indicators
- Installation fonctionnelle en moins de 10 minutes via le store d'add-ons HA
- Capacite a repondre a "qu'est-ce qu'il reste dans le frigo ?" en interrogeant Grocy
- Capacite a lire un capteur MQTT et declencher un flow Node-RED via commande naturelle
- Fonctionnel sur les 3+ canaux simultanement avec le meme contexte HA

### MVP Definition
Add-on Docker fonctionnel + Integration HACS + plugin HA Core (entites/services) + plugin Grocy (inventaire et listes de courses). Accessible via les connecteurs existants (Telegram, Discord) et un panel chat basique dans HA.

## Scope

### In Scope (MVP)
- Add-on HA (container Docker manage)
- Integration HACS (bridge Python ↔ slashbot)
- Plugin HA Core (entites, services, scripts, automations)
- Plugin Grocy (inventaire, recettes, menus, listes de courses)
- Panel chat dans le sidebar HA

### In Scope (Future)
- Plugin MQTT (lecture capteurs, publish/subscribe)
- Plugin Node-RED (declenchement de flows, creation d'automations)
- Enregistrement comme Assist pipeline conversation agent
- Support vocal via Assist

### Explicitly Out of Scope
- Remplacement de l'Assist natif HA (on s'y integre, on ne le remplace pas)
- Interface de configuration Node-RED (on declenche des flows, on n'edite pas le canvas)
- Gestion du systeme HA lui-meme (backups, updates, add-on management)
- Support de Z-Wave/Zigbee direct (on passe par les entites HA)

## Key Use Cases (Sketches)

### Use Case 1: Consulter l'inventaire Grocy
**Actor**: Household Member (via Telegram)
**Goal**: Savoir ce qu'il reste dans le frigo/placard
**Flow**:
1. Envoie "qu'est-ce qu'il reste dans le frigo ?" sur Telegram
2. Slashbot interroge l'API Grocy via le plugin
3. Repond avec la liste des produits, quantites et dates de peremption
4. Propose d'ajouter les produits manquants a la liste de courses

### Use Case 2: Generer un menu de la semaine
**Actor**: Household Member (via HA Panel)
**Goal**: Planifier les repas de la semaine
**Flow**:
1. Demande "propose-moi un menu pour la semaine avec ce qu'on a en stock"
2. Slashbot consulte l'inventaire Grocy et les recettes disponibles
3. Propose un menu equilibre en fonction du stock
4. Genere automatiquement la liste de courses pour les ingredients manquants

### Use Case 3: Lire un capteur et agir
**Actor**: Power User (via Discord)
**Goal**: Verifier la temperature et ajuster le chauffage
**Flow**:
1. Demande "quelle est la temperature du salon ?"
2. Slashbot lit l'entite HA `sensor.salon_temperature` (ou via MQTT)
3. Repond "22.3C"
4. L'utilisateur dit "monte le chauffage a 23"
5. Slashbot appelle le service HA `climate.set_temperature`

### Use Case 4: Declencher un flow Node-RED
**Actor**: Power User (via CLI)
**Goal**: Lancer une sequence d'automations complexe
**Flow**:
1. Demande "lance le mode cinema"
2. Slashbot declenche un flow Node-RED via l'API HTTP
3. Le flow eteint les lumieres, ferme les volets, allume la TV
4. Slashbot confirme l'execution

## Constraints & Assumptions

### Known Constraints
- **Technical**: Slashbot est en TypeScript/Bun, l'integration HACS doit etre en Python - necessite un bridge (WebSocket/REST API interne)
- **Technical**: L'add-on tourne dans un container Docker isole, doit acceder au reseau interne HA (Supervisor API)
- **Technical**: Grocy n'expose pas toutes ses fonctionnalites via l'integration HA native - acces direct a l'API REST Grocy necessaire
- **Business**: Le projet est open-source, doit respecter les guidelines HACS et HA Add-on
- **User**: Les utilisateurs HA ont des niveaux techniques tres varies

### Assumptions
- L'utilisateur a deja Home Assistant OS ou Supervised (requis pour les add-ons)
- Grocy tourne comme add-on HA ou est accessible sur le reseau local
- Node-RED tourne comme add-on HA ou est accessible sur le reseau local
- Mosquitto est configure comme broker MQTT dans HA
- L'utilisateur dispose d'une cle API xAI ou de tokens $SLASHBOT

## Features Overview

**Complexity Score**: 32/10 - Very Complex

- User types: 2 x 1 = 2
- Capabilities: 8 x 1.5 = 12
- Phases: 4 x 1 = 4
- Domains: 3 x 2 = 6
- Integrations: 5 x 1 = 5
- Entities: 6 x 0.5 = 3

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | ha-addon | Add-on Docker HA : container slashbot manage par le Supervisor | P1/MVP | None | :black_square_button: Not specified |
| 02 | ha-integration | Integration HACS : composant Python, bridge WebSocket vers slashbot | P1/MVP | 01 | :black_square_button: Not specified |
| 03 | ha-core-plugin | Plugin slashbot pour l'API HA : entites, services, scripts, automations | P1/MVP | 02 | :black_square_button: Not specified |
| 04 | ha-chat-panel | Panel chat dans le sidebar HA avec interface conversationnelle | P1/MVP | 02 | :black_square_button: Not specified |
| 05 | grocy-plugin | Plugin slashbot pour Grocy : inventaire, recettes, menus, listes de courses | P1/MVP | 03 | :black_square_button: Not specified |
| 06 | mqtt-plugin | Plugin slashbot pour MQTT : lecture capteurs, publish/subscribe topics | P2 | 03 | :black_square_button: Not specified |
| 07 | nodered-plugin | Plugin slashbot pour Node-RED : declenchement de flows, inspection | P2 | 03 | :black_square_button: Not specified |
| 08 | assist-pipeline | Enregistrement comme conversation agent dans l'Assist pipeline HA | P3 | 02, 04 | :black_square_button: Not specified |

**Status Legend**: :black_square_button: Not specified -> :pencil: Specified -> :white_check_mark: Implemented

### Feature Dependencies Graph

```text
[01-ha-addon]
    └── [02-ha-integration]
            ├── [03-ha-core-plugin]
            │       ├── [05-grocy-plugin]
            │       ├── [06-mqtt-plugin]
            │       └── [07-nodered-plugin]
            ├── [04-ha-chat-panel]
            └── [08-assist-pipeline] (also depends on 04)
```

### Implementation Order

1. **Phase 1 (MVP)**: 01-ha-addon, 02-ha-integration, 03-ha-core-plugin, 04-ha-chat-panel, 05-grocy-plugin
2. **Phase 2 (IoT & Automation)**: 06-mqtt-plugin, 07-nodered-plugin
3. **Phase 3 (Native HA)**: 08-assist-pipeline

## Open Questions & Risks

### Questions to Resolve
- Quel protocole pour le bridge Python ↔ slashbot ? (WebSocket recommande pour le streaming)
- Comment gerer l'authentification HA (long-lived access tokens vs. OAuth) ?
- Faut-il un repo GitHub separe pour l'add-on et l'integration HACS, ou un monorepo ?
- Comment exposer la configuration slashbot (cle API, mode de paiement) dans l'UI HA ?
- Le panel chat utilise-t-il un framework frontend HA (LitElement) ou un iframe ?

### Identified Risks
- **Complexite du bridge TS↔Python** : Le bridge entre l'integration HACS (Python) et slashbot (TypeScript) est un point critique. Mitigation : API REST/WebSocket interne simple et bien definie.
- **Maintenance multi-ecosysteme** : Suivre les breaking changes de HA, HACS, Grocy, Node-RED. Mitigation : versionning strict, CI/CD avec tests d'integration.
- **Securite** : Slashbot avec acces aux services HA peut faire des degats. Mitigation : systeme de permissions granulaire par service/entite.
- **Performance** : L'agent IA avec acces a de nombreuses APIs peut etre lent. Mitigation : caching, outils bien scopes.

## Discovery Notes

### Session 2026-02-12
- Q: Qu'est-ce que slashbot apporterait de plus vs les assistants IA HA existants ? -> A: Les capacites d'agent avec acces direct aux services (Grocy, Node-RED, MQTT) pour gerer inventaires, recettes, menus, listes de courses, capteurs, automations.
- Q: Mode d'integration ? -> A: Add-on HA (container Docker) + Integration HACS (bridge Python), le pattern standard HA.
- Q: Interfaces utilisateur ? -> A: Toutes : Panel HA, connecteurs existants (Telegram/Discord), Assist pipeline.
- Q: Communication avec les services ? -> A: Hybride : API HA pour entites/services natifs + API directe pour services riches (Grocy, Node-RED).
- Q: Priorite des services MVP ? -> A: HA Core -> Grocy -> MQTT -> Node-RED -> Assist pipeline.

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun build --compile` | Compiler slashbot en binaire pour le container Docker |
| 2 | `docker build` | Construire l'image Docker de l'add-on |
| 3 | `hacs validate` | Valider l'integration HACS |

### Required Tools & Versions

- **Home Assistant**: 2024.1+ (Supervisor API, Add-on store)
- **HACS**: 2.0+ (custom integration distribution)
- **Python**: 3.12+ (integration HACS)
- **Grocy**: 4.0+ (API REST v2)
- **Node-RED**: 3.0+ (Admin API)
- **Mosquitto**: 2.0+ (MQTT 5.0)

### Integration Sequences

```text
User (Telegram/HA Panel/Discord)
    |
    v
Slashbot (container add-on)
    |
    ├── API HA (via Supervisor API / REST)
    │       ├── Entities (sensors, switches, climate)
    │       ├── Services (turn_on, set_temperature)
    │       └── Scripts & Automations
    |
    ├── Grocy API (direct REST, reseau interne)
    │       ├── Stock/Inventaire
    │       ├── Recettes
    │       ├── Meal Plans
    │       └── Shopping Lists
    |
    ├── MQTT (direct, via Mosquitto broker)
    │       ├── Subscribe (capteurs)
    │       └── Publish (commandes)
    |
    └── Node-RED (direct REST, Admin API)
            ├── Trigger flows (HTTP inject)
            └── List/inspect flows
```

### Implementation Notes

- L'add-on HA utilise le Supervisor API pour acceder au reseau interne et aux autres add-ons
- L'integration HACS expose un service `slashbot.send_message` et des sensors (status, derniere reponse)
- Le bridge Python ↔ slashbot utilise WebSocket pour le streaming des reponses
- Chaque plugin HA (core, grocy, mqtt, nodered) est un plugin slashbot standard dans `src/plugins/`
- Le panel chat utilise LitElement (standard HA frontend) communiquant via WebSocket
- Permissions granulaires : l'admin definit quels services/entites slashbot peut acceder
