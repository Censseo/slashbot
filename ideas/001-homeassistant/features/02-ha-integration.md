# Feature: HA Integration HACS

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Creer une integration Home Assistant custom distribuee via HACS. Ce composant Python fait le pont entre l'ecosysteme HA (entites, services, UI) et slashbot (tournant dans l'add-on Docker). Il expose des services HA (`slashbot.send_message`, `slashbot.ask`), des sensors (statut, derniere reponse), et gere l'authentification/configuration via le flow standard HA.

## User Value

**Who benefits**: Power User HA
**What they gain**: Slashbot integre nativement dans HA : services appelables dans les automations, sensors dans les dashboards, configuration via l'UI
**Success metric**: L'integration se configure en 3 clics via le flow HA et expose au moins 2 services + 2 sensors

## Scope

### This Feature Includes
- Custom component Python (`custom_components/slashbot/`)
- Config flow HA (decouverte automatique de l'add-on ou configuration manuelle)
- Bridge WebSocket vers l'API interne de l'add-on slashbot
- Services HA : `slashbot.send_message`, `slashbot.ask` (avec reponse)
- Sensors HA : `sensor.slashbot_status` (online/offline), `sensor.slashbot_last_response`
- Distribution via HACS (manifest HACS, `hacs.json`)
- Gestion de la reconnexion automatique si l'add-on redemarre

### This Feature Does NOT Include
- Les plugins slashbot (features 03, 05-07)
- Le panel chat (feature 04, mais le panel utilise cette integration)
- L'Assist pipeline (feature 08)

## Key Use Cases

### Use Case 1: Configuration de l'integration
**Actor**: Power User HA
**Goal**: Connecter l'integration HACS a l'add-on slashbot
**Flow**:
1. Installe l'integration via HACS
2. Va dans Settings > Integrations > Add Integration > Slashbot
3. L'add-on est detecte automatiquement (ou saisie manuelle de l'URL)
4. Clique "Submit" -> integration configuree
5. Les sensors et services apparaissent dans HA

### Use Case 2: Utiliser slashbot dans une automation HA
**Actor**: Power User HA
**Goal**: Declencher slashbot depuis une automation
**Flow**:
1. Cree une automation HA
2. Ajoute une action `slashbot.send_message` avec le texte "Fais le bilan du stock Grocy"
3. Le trigger se declenche (ex: chaque lundi a 8h)
4. Slashbot execute la requete et le resultat est disponible dans `sensor.slashbot_last_response`

## Dependencies

### Requires
- [Feature 01](01-ha-addon.md): L'add-on doit tourner pour que l'integration s'y connecte

### Enables
- [Feature 03](03-ha-core-plugin.md): Le plugin core utilise le token HA fourni par l'integration
- [Feature 04](04-ha-chat-panel.md): Le panel utilise les services de l'integration
- [Feature 08](08-assist-pipeline.md): L'Assist pipeline s'enregistre via l'integration

## Technical Hints

### Required Tools & Versions

- **Python**: 3.12+ (standard HA)
- **Home Assistant**: 2024.1+ (config flow, WebSocket API)
- **HACS**: 2.0+ (distribution)
- **aiohttp**: Pour le client WebSocket async

### Implementation Notes

- Le composant suit la structure standard HA : `__init__.py`, `config_flow.py`, `sensor.py`, `services.yaml`, `manifest.json`
- Communication via WebSocket async (aiohttp) vers `ws://addon_slashbot:9876/ws`
- Le config flow tente la decouverte via le Supervisor API (`/addons/slashbot/info`)
- Les services HA sont definis dans `services.yaml` avec des schemas de validation
- La reconnexion utilise un backoff exponentiel
- Le `manifest.json` HACS doit respecter les guidelines (version, documentation_url, etc.)

## Open Questions

- Faut-il exposer un `binary_sensor` pour la connectivite en plus du `sensor.status` ?
- Comment transmettre le long-lived access token HA a slashbot pour le plugin core ?
- Faut-il un `device` HA pour regrouper les entites slashbot ?

## Notes

Structure du composant :
```
custom_components/slashbot/
├── __init__.py          # Setup, WebSocket client
├── config_flow.py       # Config flow UI
├── const.py             # Constants
├── sensor.py            # Sensor platform
├── services.yaml        # Service definitions
├── strings.json         # UI strings
├── manifest.json        # HA manifest
└── translations/
    ├── en.json
    └── fr.json
```
