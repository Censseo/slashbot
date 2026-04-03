# Feature: HA Add-on Docker

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Packager slashbot comme un add-on Home Assistant officiel : une image Docker geree par le Supervisor HA, installable en un clic depuis le store d'add-ons. Le container fait tourner le binaire slashbot compile avec Bun, expose une API interne (REST + WebSocket) pour communiquer avec l'integration HACS, et a acces au reseau interne HA pour atteindre les autres services (Grocy, Mosquitto, Node-RED).

## User Value

**Who benefits**: Power User HA
**What they gain**: Installation et mise a jour simplifiees de slashbot dans l'ecosysteme HA, sans configuration Docker manuelle
**Success metric**: Installation fonctionnelle en moins de 5 minutes via le store d'add-ons

## Scope

### This Feature Includes
- Dockerfile optimise pour slashbot (base Alpine/Debian slim, binaire Bun compile)
- Fichier `config.yaml` (metadata add-on HA : nom, version, ports, options)
- Configuration exposee dans l'UI HA (cle API xAI, mode de paiement, modele LLM)
- API interne REST + WebSocket pour le bridge avec l'integration HACS
- Acces au reseau interne HA (Supervisor API, autres add-ons)
- Healthcheck endpoint
- Logs accessibles via l'UI HA (stdout/stderr)
- Repository GitHub pour le store d'add-ons HA

### This Feature Does NOT Include
- L'integration HACS (feature 02)
- Les plugins slashbot specifiques HA (features 03-07)
- Le panel chat (feature 04)

## Key Use Cases

### Use Case 1: Installation de l'add-on
**Actor**: Power User HA
**Goal**: Installer slashbot dans Home Assistant
**Flow**:
1. Ajoute le repository slashbot dans le store d'add-ons HA
2. Trouve "Slashbot" dans la liste des add-ons
3. Clique "Install"
4. Configure la cle API xAI (ou le mode token) dans l'onglet Configuration
5. Clique "Start"
6. Slashbot demarre et expose son API interne

### Use Case 2: Mise a jour
**Actor**: Power User HA
**Goal**: Mettre a jour slashbot
**Flow**:
1. Notification HA "Mise a jour disponible pour Slashbot"
2. Clique "Update"
3. Le container est recree avec la nouvelle version
4. La configuration et les donnees persistent (volume monte)

## Dependencies

### Requires
- None (feature fondation)

### Enables
- [Feature 02](02-ha-integration.md): L'integration HACS se connecte a l'API interne de l'add-on
- Tous les autres features dependent de l'add-on comme runtime

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun build --compile --target=bun-linux-x64` | Compiler slashbot en binaire Linux |
| 2 | `docker build -t slashbot-ha-addon .` | Construire l'image de l'add-on |

### Required Tools & Versions

- **Home Assistant Supervisor**: API v2 (pour le reseau interne et la gestion du cycle de vie)
- **Docker**: Image base Alpine 3.19+ ou Debian slim
- **Bun**: 1.0+ (compile dans le binaire)

### Implementation Notes

- Le `config.yaml` HA definit les options exposees (api_key, payment_mode, model, etc.)
- L'API interne ecoute sur un port configurable (default: 9876)
- Le WebSocket supporte le streaming des reponses LLM
- Volume persistant pour `~/.slashbot/` (config, wallet, contexte)
- Le container doit avoir `hassio_api: true` et `homeassistant_api: true` dans config.yaml
- Labels Docker conformes au standard HA add-on (`io.hass.type: addon`)

## Open Questions

- Faut-il supporter ARM64 (Raspberry Pi) des le MVP ?
- Quelle taille cible pour l'image Docker ? (slashbot compile fait ~50MB)
- Comment gerer les secrets (cle API) : options HA vs. fichier credentials.json ?

## Notes

Le repository de l'add-on suit la structure standard HA :
```
slashbot-ha-addon/
├── Dockerfile
├── config.yaml
├── run.sh          # Entrypoint
├── CHANGELOG.md
└── translations/
    └── en.yaml
```
