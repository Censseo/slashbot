# Feature: HA Core Plugin

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Plugin slashbot (TypeScript) qui donne a l'agent IA l'acces aux entites et services Home Assistant via l'API REST/WebSocket HA. C'est le socle sur lequel les autres plugins HA s'appuient. Permet de lire les sensors, controler les appareils, declencher des scripts et automations, et lister les entites disponibles.

## User Value

**Who benefits**: Tous les utilisateurs (Power User et Household Members)
**What they gain**: Controler Home Assistant en langage naturel - "allume la lumiere du salon", "quelle temperature fait-il dehors ?", "lance le script mode nuit"
**Success metric**: Capacite a lire n'importe quelle entite HA et appeler n'importe quel service HA via slashbot

## Scope

### This Feature Includes
- Plugin slashbot standard (`src/plugins/homeassistant/`)
- Outils AI (tools) exposes au LLM :
  - `ha_get_states` - Lister/filtrer les entites et leurs etats
  - `ha_get_state` - Lire l'etat detaille d'une entite
  - `ha_call_service` - Appeler un service HA (turn_on, set_temperature, etc.)
  - `ha_list_services` - Lister les services disponibles par domaine
  - `ha_fire_event` - Declencher un evenement HA
  - `ha_get_history` - Historique d'une entite
- Client HTTP pour l'API REST HA (avec long-lived access token)
- Prompt contribution decrivant les capacites HA au LLM
- Gestion des erreurs (entite inexistante, service indisponible)

### This Feature Does NOT Include
- Acces a Grocy (feature 05)
- Acces a MQTT direct (feature 06)
- Acces a Node-RED (feature 07)
- Les entites/services specifiques a l'integration slashbot (feature 02)

## Key Use Cases

### Use Case 1: Lire un capteur
**Actor**: Household Member
**Goal**: Connaitre la temperature interieure
**Flow**:
1. "Quelle temperature fait-il dans le salon ?"
2. Slashbot appelle `ha_get_state("sensor.salon_temperature")`
3. Repond "Il fait 22.3C dans le salon"

### Use Case 2: Controler un appareil
**Actor**: Household Member
**Goal**: Allumer/eteindre une lumiere
**Flow**:
1. "Eteins toutes les lumieres du rez-de-chaussee"
2. Slashbot appelle `ha_get_states` avec filtre `light.*` et area `rez-de-chaussee`
3. Pour chaque lumiere, appelle `ha_call_service("light", "turn_off", entity_id)`
4. Confirme "J'ai eteint 5 lumieres au rez-de-chaussee"

### Use Case 3: Declencher un script
**Actor**: Power User
**Goal**: Lancer un scenario predefined
**Flow**:
1. "Lance le script mode cinema"
2. Slashbot appelle `ha_call_service("script", "turn_on", { entity_id: "script.mode_cinema" })`
3. Confirme l'execution

## Dependencies

### Requires
- [Feature 02](02-ha-integration.md): Fournit le token d'acces HA et la configuration de connexion

### Enables
- [Feature 05](05-grocy-plugin.md): Peut utiliser les entites Grocy exposees dans HA
- [Feature 06](06-mqtt-plugin.md): Partage le pattern de connexion HA
- [Feature 07](07-nodered-plugin.md): Peut declencher des automations HA liees a Node-RED

## Technical Hints

### Required Tools & Versions

- **Home Assistant REST API**: `/api/states`, `/api/services`, `/api/events`, `/api/history`
- **Long-Lived Access Token**: Genere dans le profil utilisateur HA

### Implementation Notes

- Le plugin suit le pattern standard slashbot (`BasePlugin` avec `tools`, `prompts`, `init`)
- Le token HA est transmis par l'integration HACS via la config de l'add-on ou une variable d'environnement
- Les outils `ha_get_states` supportent le filtrage par domaine, area, et attributs
- Le prompt systeme inclut la liste des domaines et areas disponibles pour guider le LLM
- Les reponses volumineuses (liste de toutes les entites) sont compressees/resumees
- Rate limiting sur les appels API HA pour eviter de surcharger le serveur

## Open Questions

- Faut-il utiliser l'API REST ou WebSocket HA ? (REST est plus simple, WebSocket permet les souscriptions temps reel)
- Comment gerer les entites avec des noms similaires ? (ex: `light.salon` vs `light.salon_2`)
- Faut-il un mecanisme de cache pour les etats des entites ?

## Notes

Ce plugin est le socle de toute l'integration HA. Il doit etre robuste, bien documente, et servir de modele pour les plugins suivants (Grocy, MQTT, Node-RED).
