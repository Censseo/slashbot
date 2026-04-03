# Feature: Callback Handler

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 04
**Priority**: P2
**Status**: Not Specified

## Summary

Interception des `ask_user` émis par Claude Code (sous-agent) et routing vers la bonne destination : soit l'UI Atelier (pour réponse manuelle), soit l'auto-répondeur (feature 05). Slashbot ne laisse plus les callbacks remonter aveuglément — il décide qui répond.

## User Value

**Who benefits**: Atelier user + Atelier workflow author
**What they gain**: Les questions du sous-agent peuvent être répondues automatiquement (workflow non-bloqué) ou routées vers l'user si nécessaire, selon la configuration du step.
**Success metric**: Un workflow avec `ask_user` se déroule sans blocage sur les callbacks auto-répondables.

## Scope

### This Feature Includes

- Interception des events `ask_user` dans le flux slashbot
- Décision de routing : auto-réponse (feature 05) vs remontée UI Atelier
- Pour remontée UI : publication de l'event `QUESTION_ASKED` vers Redis (repris par `OrchestratorQuestion` Spring Boot)
- Attente de la réponse (WebSocket `USER_RESPONSE` ou auto-répondeur)
- Injection de la réponse dans le subprocess PTY Claude Code
- Log de l'échange (question + réponse) dans le stream visible UI

### This Feature Does NOT Include

- La génération de la réponse auto — feature 05
- La gestion des questions dans l'UI Atelier (déjà implémenté côté Spring Boot + frontend)

## Key Use Cases

### Use Case 1: Callback routé vers UI

**Actor**: Claude Code subprocess (ask_user)
**Goal**: Obtenir une réponse utilisateur
**Flow**:
1. Plugin claude-code émet `ask_user { question, options? }`
2. Callback handler évalue : auto-réponse désactivée pour ce step
3. Publie `QUESTION_ASKED` → Redis → Spring Boot → UI Atelier
4. Attend `USER_RESPONSE` sur le channel WebSocket (avec timeout configurable)
5. Injecte la réponse dans le PTY du subprocess
6. Log `[Q] question → [A] réponse` dans le stream

### Use Case 2: Callback auto-répondu

**Actor**: Claude Code subprocess (ask_user)
**Goal**: Continuer sans bloquer l'user
**Flow**:
1. Plugin claude-code émet `ask_user { question }`
2. Callback handler : `auto_respond: true` configuré pour ce step
3. Délègue à auto-répondeur (feature 05) → reçoit réponse générée
4. Injecte réponse dans PTY
5. Log `[Q] question → [A auto] réponse` dans le stream

## Dependencies

### Requires

- Feature 02 (claude-code plugin — produit les `ask_user`)
- Feature 03 (streaming bridge — pour logger l'échange)

### Enables

- Feature 05 (auto-responder — consomme les callbacks à auto-répondre)

## Technical Hints

### Implementation Notes

- Le routing auto vs manuel se fait sur un flag du step payload (`auto_respond: boolean`) ou config globale
- L'injection PTY se fait via `ptyProcess.write(response + '\n')` — pattern déjà utilisé dans `callbacks/userInput.ts` d'agent-service
- Timeout sur attente réponse manuelle : configurable, défaut 5 min — après quoi le workflow est marqué PAUSED
- `OrchestratorQuestion` Spring Boot peut rester inchangé — le callback handler publie dans le même format Redis

## Open Questions

- Le flag `auto_respond` vient-il du YAML workflow (par step) ou de la config globale slashbot ?
- Si l'auto-répondeur échoue (erreur LLM), fallback vers UI ou erreur workflow ?
