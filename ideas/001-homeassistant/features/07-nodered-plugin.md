# Feature: Node-RED Plugin

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 07
**Priority**: P2
**Status**: Not Specified

## Summary

Plugin slashbot (TypeScript) permettant a l'agent IA d'interagir avec Node-RED : lister les flows disponibles, declencher des flows via des noeuds HTTP inject, et inspecter l'etat des flows. Permet de piloter des automations complexes en langage naturel sans ouvrir l'editeur Node-RED.

## User Value

**Who benefits**: Power User HA
**What they gain**: Declenchement d'automations complexes Node-RED en langage naturel, inspection des flows sans ouvrir l'editeur
**Success metric**: Capacite a lister les flows et declencher un flow specifique via slashbot

## Scope

### This Feature Includes
- Plugin slashbot standard (`src/plugins/nodered/`)
- Outils AI (tools) exposes au LLM :
  - `nodered_list_flows` - Lister les flows actifs avec leur nom et description
  - `nodered_trigger_flow` - Declencher un flow via HTTP inject node
  - `nodered_get_flow_info` - Details d'un flow (noeuds, connexions)
  - `nodered_enable_disable_flow` - Activer/desactiver un flow
- Client HTTP pour l'Admin API Node-RED
- Prompt contribution decrivant les capacites Node-RED au LLM

### This Feature Does NOT Include
- Edition de flows (creation/modification de noeuds dans l'editeur)
- Deploiement de flows
- Debug en temps reel des flows

## Key Use Cases

### Use Case 1: Declencher un scenario
**Actor**: Power User (via Telegram)
**Goal**: Lancer un flow Node-RED
**Flow**:
1. "Lance le mode cinema"
2. Slashbot appelle `nodered_list_flows` pour trouver le flow "Mode Cinema"
3. Declenche via `nodered_trigger_flow` (HTTP inject)
4. Le flow Node-RED execute : eteint les lumieres, ferme les volets, allume la TV
5. Confirme l'execution

### Use Case 2: Inspecter les automations
**Actor**: Power User (via CLI)
**Goal**: Voir quels flows sont actifs
**Flow**:
1. "Quels flows Node-RED sont actifs ?"
2. Slashbot appelle `nodered_list_flows`
3. Affiche la liste avec noms, statuts, et descriptions

## Dependencies

### Requires
- [Feature 03](03-ha-core-plugin.md): Partage l'infrastructure et le pattern plugin
- Node-RED accessible sur le reseau interne HA

### Enables
- Enrichit les capacites d'automatisation de slashbot dans HA

## Technical Hints

### Required Tools & Versions

- **Node-RED**: 3.0+ (Admin API)
- **Node-RED Admin API**: `/flows`, `/flow/{id}`, HTTP inject nodes

### Implementation Notes

- Connexion a Node-RED via `http://addon_nodered:1880` (ou config manuelle)
- L'Admin API Node-RED necessite une authentification (token ou credentials)
- Le declenchement de flows utilise les noeuds "HTTP In" comme points d'entree
- Les flows sans noeud HTTP In ne sont pas declenchables directement
- Le prompt systeme suggere au LLM d'utiliser les noms de flows plutot que les IDs
- Les flows sont caches localement (refresh periodique) pour eviter des appels API repetitifs

## Open Questions

- Comment gerer les flows qui n'ont pas de noeud HTTP In ? (trigger via MQTT ? via HA service ?)
- Faut-il supporter le passage de parametres aux flows declenches ?
- Comment recuperer le resultat d'un flow (reponse HTTP) ?

## Notes

L'API Admin Node-RED :
- `GET /flows` - Lister tous les flows et leur configuration
- `GET /flow/{id}` - Details d'un flow
- `PUT /flow/{id}` - Modifier un flow (enable/disable)
- `POST /inject/{id}` - Declencher un noeud inject
- Les flows avec noeud HTTP In sont accessibles via `POST /endpoint-name`
