# Feature: Auto-Responder

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 05
**Priority**: P2
**Status**: Not Specified

## Summary

Génération de réponses contextuelles aux callbacks `ask_user` sans intervention utilisateur. Slashbot utilise les artefacts disponibles du workflow (spec, plan, tasks) et le contexte du step pour générer une réponse pertinente via LLM. Miroir de `AutoResponderService.java` d'Atelier, mais intégré dans slashbot.

## User Value

**Who benefits**: Atelier user (workflows longue durée)
**What they gain**: Les workflows n'ont plus besoin d'attendre l'utilisateur pour des questions auxquelles le contexte suffit à répondre.
**Success metric**: 80%+ des callbacks dans les workflows existants répondus automatiquement sans régression de qualité.

## Scope

### This Feature Includes

- Génération de réponse via LLM (Vercel AI SDK — déjà dans slashbot)
- Contexte injecté : question posée, artefacts disponibles (spec/plan/tasks depuis API Atelier), historique du step
- Prompt système : rôle "assistant de workflow qui répond au nom de l'user"
- Retour de la réponse au callback handler (feature 04)
- Log de la source de réponse (`[auto]` indicator dans le stream)

### This Feature Does NOT Include

- La décision de router vers auto-réponse vs UI — feature 04
- L'injection de la réponse dans le PTY — feature 04
- L'accès aux artefacts workflow (assume API Atelier existante disponible)

## Key Use Cases

### Use Case 1: Génération réponse contextuelle

**Actor**: Callback handler (feature 04)
**Goal**: Répondre à une question de sous-agent sans user
**Flow**:
1. Callback handler appelle `autoResponder.generate({ question, stepContext, artifacts })`
2. Auto-répondeur fetch les artefacts depuis API Atelier (spec, plan courant)
3. Construit un prompt : système + question + artefacts pertinents
4. Appel LLM via Vercel AI SDK (model configurable, défaut: claude-haiku pour économie de tokens)
5. Retourne la réponse générée comme string
6. Callback handler injecte dans PTY

## Dependencies

### Requires

- Feature 04 (callback handler — déclenche la génération)

### Enables

- Rien — feature terminale dans cette branche

## Technical Hints

### Implementation Notes

- Réutiliser `AutoResponderService.java` comme référence de prompt engineering
- Vercel AI SDK `generateText()` (pas streaming — on veut la réponse complète)
- Artefacts Atelier : `GET /api/projects/{projectId}/artifacts/{type}` — format existant
- Modèle suggéré : `claude-haiku-4-5` pour rapidité et coût (les questions sont courtes)
- Le prompt système doit inclure : rôle, contexte workflow, artefacts disponibles, instruction de concision

## Open Questions

- Slashbot a-t-il déjà accès à l'API Atelier (credentials, URL) ou faut-il un mécanisme de config dédié ?
- Faut-il un mécanisme de confidence score (si l'auto-répondeur n'est pas sûr → fallback UI) ?
