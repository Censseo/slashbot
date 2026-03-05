# Feature: Node-RED UI Access

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 05
**Priority**: P2
**Status**: Specified

## Summary

Permettre à l'administrateur humain d'accéder à l'éditeur visuel Node-RED pour créer, modifier et superviser les flows. L'éditeur natif Node-RED est servi sur un port configurable, avec une authentification basique pour sécuriser l'accès. Les flows créés dans l'éditeur sont automatiquement détectés par le MCP Bridge.

## User Value

**Who benefits**: Administrateur slashbot
**What they gain**: Interface visuelle drag & drop pour créer des flows complexes, superviser les flows créés par le bot, et débugger les problèmes
**Success metric**: L'éditeur Node-RED est accessible sur le port configuré, les flows créés dans l'UI sont détectés par le MCP Bridge en < 30 secondes

## Scope

### This Feature Includes
- Activation de l'éditeur web Node-RED (httpAdminRoot)
- Configuration de l'authentification (username/password basique)
- Commande slash `/nodered ui` pour afficher l'URL de l'éditeur
- Configuration du port et du bind address dans `~/.slashbot/config/nodered.json`
- Détection des changements de flows faits dans l'UI (polling ou événements)
- Notification au MCP Bridge quand des flows sont modifiés dans l'UI

### This Feature Does NOT Include
- Interface custom de gestion (on utilise l'éditeur Node-RED natif)
- Accès distant sécurisé (HTTPS, reverse proxy) - l'utilisateur configure ça lui-même
- Multi-utilisateurs avec permissions différenciées

## Key Use Cases

### Use Case 1: Accéder à l'éditeur
**Actor**: Administrateur
**Goal**: Ouvrir l'éditeur Node-RED dans un navigateur
**Flow**:
1. L'admin tape `/nodered ui` dans slashbot
2. Le bot affiche : "Node-RED Editor: http://localhost:1880"
3. L'admin ouvre l'URL dans son navigateur
4. L'admin se connecte avec les credentials configurés
5. L'éditeur Node-RED s'affiche avec tous les flows (y compris ceux créés par le bot)

### Use Case 2: Modifier un flow du bot dans l'UI
**Actor**: Administrateur
**Goal**: Ajuster visuellement un flow créé par le bot
**Flow**:
1. L'admin ouvre l'éditeur et voit le flow "mcp-check-sol-price" créé par le bot
2. L'admin modifie le seuil de prix dans le node Function
3. L'admin clique "Deploy" dans l'éditeur
4. Le FlowManager détecte le changement (polling des flows)
5. Le MCP Bridge met à jour le tool correspondant si nécessaire
6. Le bot utilise le flow mis à jour lors de sa prochaine invocation

### Use Case 3: Créer un flow complexe dans l'UI
**Actor**: Administrateur
**Goal**: Créer un flow avancé que le bot ne pourrait pas facilement générer
**Flow**:
1. L'admin design un flow complexe dans l'éditeur : multi-branches, error handling, sub-flows
2. L'admin nomme le flow "mcp-complex-pipeline" (convention MCP)
3. L'admin déploie dans l'éditeur
4. Le MCP Bridge détecte le nouveau flow et l'expose comme outil
5. Le bot peut maintenant utiliser ce flow comme outil MCP

## Dependencies

### Requires
- [Feature 01: nodered-lifecycle]: Instance Node-RED running avec le serveur web actif

### Enables
- Aucune feature technique directe, mais améliore l'expérience utilisateur et permet la supervision

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | Configuration `httpAdminRoot: '/'` dans settings.js | Activer l'éditeur |
| 2 | Configuration `adminAuth` dans settings.js | Authentification basique |

### Required Tools & Versions

- **Node-RED Editor**: inclus dans node-red >= 3.x - Éditeur visuel web

### Implementation Notes

- L'éditeur est activé par défaut dans Node-RED via `httpAdminRoot`
- L'authentification utilise `adminAuth` dans settings.js :
  ```js
  adminAuth: {
    type: "credentials",
    users: [{ username: "admin", password: bcryptHash, permissions: "*" }]
  }
  ```
- Le hash bcrypt du mot de passe doit être généré à la première configuration
- Pour détecter les changements faits dans l'UI, deux approches :
  1. **Polling** : Comparer périodiquement GET /flows avec le dernier état connu
  2. **Événements Node-RED** : Utiliser le runtime events de Node-RED (plus fiable mais nécessite une intégration plus profonde)
- Le polling est recommandé pour le MVP (plus simple, fonctionne avec l'API standard)
- Le bind address doit être `127.0.0.1` par défaut (sécurité locale uniquement)
- Ajouter dans le sidebar TUI un lien vers l'URL de l'éditeur quand Node-RED est running

## Open Questions

- Faut-il intégrer un reverse proxy ou tunnel (comme ngrok) pour l'accès distant ?
- Comment gérer le conflit si le bot et l'humain modifient le même flow simultanément ?
- Faut-il un mode "read-only" pour l'éditeur quand on veut juste superviser ?

## Notes

- L'éditeur Node-RED est mature et bien maintenu. Pas besoin de le customiser pour le MVP.
- La feature 05 est P2 car l'usage principal est le bot qui crée des flows (P1). L'accès UI est un bonus pour la supervision.
- À terme, on pourrait intégrer l'éditeur dans le TUI de slashbot (iframe ou webview), mais c'est hors scope.
