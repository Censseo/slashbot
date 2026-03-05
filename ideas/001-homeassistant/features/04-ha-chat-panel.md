# Feature: HA Chat Panel

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 04
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Un panel custom dans le sidebar Home Assistant offrant une interface de chat avec slashbot. L'utilisateur peut converser avec l'agent directement depuis le dashboard HA, voir les reponses en streaming, et beneficier de toutes les capacites HA de slashbot sans quitter l'interface Home Assistant.

## User Value

**Who benefits**: Tous les utilisateurs
**What they gain**: Acces direct a slashbot depuis l'interface HA, sans passer par Telegram/Discord/CLI
**Success metric**: Interface de chat fonctionnelle avec streaming des reponses, accessible en un clic depuis le sidebar HA

## Scope

### This Feature Includes
- Panel HA custom enregistre dans le sidebar (icone + label "Slashbot")
- Interface de chat (historique des messages, input, envoi)
- Streaming des reponses via WebSocket
- Rendu Markdown des reponses
- Indicateur de "typing" pendant le traitement
- Theme coherent avec le design system HA (LitElement, Material Design)
- Responsive (desktop + mobile)

### This Feature Does NOT Include
- Editeur de configuration slashbot (la config se fait dans l'onglet add-on)
- Support vocal (feature 08 - Assist pipeline)
- Historique persistant des conversations (MVP : session only)

## Key Use Cases

### Use Case 1: Chat depuis le dashboard
**Actor**: Household Member
**Goal**: Poser une question a slashbot depuis HA
**Flow**:
1. Clique sur "Slashbot" dans le sidebar HA
2. Le panel chat s'ouvre
3. Tape "qu'est-ce qu'on mange ce soir ?"
4. Voit la reponse en streaming avec le menu propose
5. Continue la conversation

### Use Case 2: Actions rapides
**Actor**: Power User
**Goal**: Controler des appareils via le chat
**Flow**:
1. Ouvre le panel slashbot
2. Tape "eteins tout et active l'alarme"
3. Voit slashbot executer les actions en temps reel
4. Confirmation affichee dans le chat

## Dependencies

### Requires
- [Feature 02](02-ha-integration.md): Le panel communique via les services de l'integration

### Enables
- [Feature 08](08-assist-pipeline.md): Le panel peut evoluer pour inclure le support vocal Assist

## Technical Hints

### Required Tools & Versions

- **LitElement**: Standard HA frontend (Web Components)
- **Home Assistant Frontend API**: Panel registration, WebSocket API
- **Material Design Web Components**: Coherence visuelle avec HA

### Implementation Notes

- Le panel est enregistre via `async_register_panel()` dans l'integration Python
- Le frontend est un bundle JS (LitElement) servi par l'integration
- Communication via WebSocket HA (`hass.connection.subscribeMessage`) vers l'integration, qui relay vers l'add-on
- Le streaming utilise des messages WebSocket incrementaux
- Le composant LitElement herite du theme HA (CSS custom properties)
- Le build frontend utilise Rollup ou Vite pour generer un bundle unique

## Open Questions

- Faut-il un historique persistant des conversations ou juste la session courante ?
- Le panel doit-il afficher les actions en cours (tool calls) ou juste le resultat final ?
- Faut-il une version "widget" embedable dans un dashboard Lovelace en plus du panel sidebar ?

## Notes

Le panel est distribue avec l'integration HACS. Le build JS est inclus dans le composant Python :
```
custom_components/slashbot/
├── frontend/
│   ├── src/
│   │   ├── slashbot-panel.ts    # Main LitElement component
│   │   ├── chat-message.ts      # Message bubble component
│   │   └── chat-input.ts        # Input component
│   └── dist/
│       └── slashbot-panel.js    # Built bundle
└── panel.py                     # Panel registration
```
