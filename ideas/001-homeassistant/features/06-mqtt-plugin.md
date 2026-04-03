# Feature: MQTT Plugin

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 06
**Priority**: P2
**Status**: Not Specified

## Summary

Plugin slashbot (TypeScript) permettant a l'agent IA de se connecter au broker MQTT (Mosquitto) de Home Assistant pour lire les donnees des capteurs, souscrire a des topics, et publier des messages. Offre un acces bas-niveau et temps reel aux peripheriques IoT, complementaire a l'API HA (qui abstrait les entites).

## User Value

**Who benefits**: Power User HA
**What they gain**: Acces direct aux donnees MQTT brutes, debug de capteurs, publication de commandes sur des topics specifiques sans passer par les entites HA
**Success metric**: Capacite a lire un topic MQTT et publier un message via slashbot en langage naturel

## Scope

### This Feature Includes
- Plugin slashbot standard (`src/plugins/mqtt/`)
- Outils AI (tools) exposes au LLM :
  - `mqtt_subscribe` - Souscrire a un topic et recevoir le dernier message
  - `mqtt_publish` - Publier un message sur un topic
  - `mqtt_list_topics` - Lister les topics actifs (via `$SYS` ou discovery)
  - `mqtt_get_retained` - Lire un message retained sur un topic
- Client MQTT (mqtt.js ou equivalent Bun-compatible)
- Configuration : URL broker, credentials, prefixe de topics
- Prompt contribution decrivant les capacites MQTT au LLM

### This Feature Does NOT Include
- Configuration du broker Mosquitto lui-meme
- Integration Zigbee2MQTT ou autres bridges (on lit les topics bruts)
- Souscriptions persistantes en arriere-plan (on lit a la demande)

## Key Use Cases

### Use Case 1: Lire un capteur MQTT
**Actor**: Power User
**Goal**: Verifier la valeur brute d'un capteur
**Flow**:
1. "Quelle est la valeur du topic zigbee2mqtt/salon/temperature ?"
2. Slashbot appelle `mqtt_get_retained("zigbee2mqtt/salon/temperature")`
3. Repond avec la valeur brute et le timestamp

### Use Case 2: Publier une commande
**Actor**: Power User
**Goal**: Envoyer une commande MQTT directe
**Flow**:
1. "Publie 'ON' sur le topic cmnd/tasmota_prise/POWER"
2. Slashbot appelle `mqtt_publish("cmnd/tasmota_prise/POWER", "ON")`
3. Confirme la publication

## Dependencies

### Requires
- [Feature 03](03-ha-core-plugin.md): Partage l'infrastructure et le pattern plugin
- Mosquitto accessible sur le reseau interne HA

### Enables
- Enrichit les capacites du plugin HA Core avec des donnees temps reel

## Technical Hints

### Required Tools & Versions

- **Mosquitto**: 2.0+ (MQTT 5.0)
- **mqtt.js**: 5.0+ ou equivalent Bun-compatible

### Implementation Notes

- Connexion au broker via `mqtt://addon_mosquitto:1883` (ou config manuelle)
- Credentials MQTT configures dans les options de l'add-on
- Les souscriptions sont temporaires (subscribe, attendre un message, unsubscribe)
- Le tool `mqtt_list_topics` utilise une souscription wildcard temporaire (`#`) avec timeout
- Les payloads JSON sont automatiquement parses et presentes de facon lisible
- Attention au volume de donnees : limiter les souscriptions wildcard

## Open Questions

- Faut-il un mecanisme de souscription persistante (pour du monitoring continu) ou uniquement a la demande ?
- Comment decouvrir les topics disponibles sans `$SYS` ? (certains brokers le desactivent)
- Faut-il supporter MQTT over WebSocket en plus de TCP ?

## Notes

Ce plugin est surtout utile pour les power users qui travaillent avec des peripheriques Zigbee2MQTT, Tasmota, ou des capteurs custom. Pour la plupart des utilisateurs, le plugin HA Core (feature 03) suffira pour lire les capteurs.
