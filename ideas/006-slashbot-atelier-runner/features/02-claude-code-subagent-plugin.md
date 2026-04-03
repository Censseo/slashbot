# Feature: Claude Code Subagent Plugin

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Plugin slashbot qui spawne `claude cli` comme sous-agent via PTY. Le plugin reçoit un prompt, spawne le processus, parse le NDJSON stream-json en temps réel, et émet des `RunnerEvent` vers le caller (slashbot). Claude Code devient un outil enregistré dans le plugin registry — activé uniquement si déclaré dans la config slashbot.

## User Value

**Who benefits**: Atelier workflow author
**What they gain**: Les nœuds agentiques du workflow peuvent invoquer Claude Code comme avant, mais via slashbot — ouvrant la voie à d'autres outils dans le même système.
**Success metric**: Un step agentique qui s'exécutait via `orchestratorExecutor.ts` s'exécute identiquement via ce plugin.

## Scope

### This Feature Includes

- Plugin `claude-code` enregistrable dans slashbot plugin registry
- Spawn `claude` via node-pty avec les arguments corrects (`--output-format stream-json`, `--model`, etc.)
- Parser NDJSON ligne par ligne (réutilise la logique de `orchestratorOutputParser.ts` et `claudeEventParser.ts`)
- Émission d'events typés : `output_chunk`, `ask_user`, `tool_use`, `step_complete`
- Injection des credentials depuis les env vars (pattern existant agent-service)
- Gestion du cycle de vie du subprocess (cancel, timeout, cleanup)

### This Feature Does NOT Include

- La réponse aux `ask_user` — feature 04
- Le streaming vers Redis — feature 03
- La configuration du workspace Docker — gérée par agent-service en amont

## Key Use Cases

### Use Case 1: Exécution d'un step agentique

**Actor**: Slashbot (plugin registry)
**Goal**: Exécuter un prompt via Claude Code CLI
**Flow**:
1. Slashbot reçoit un step de type `claude-code` (ou type agentique par défaut)
2. Plugin registry route vers `ClaudeCodePlugin`
3. Plugin spawne `claude --output-format stream-json --model sonnet [args]` via node-pty
4. Output NDJSON parsé ligne par ligne
5. Events émis vers slashbot : `output_chunk` (texte), `ask_user` (question), `tool_use` (appel outil), `step_complete` (fin)

### Use Case 2: Cancel d'un sous-agent en cours

**Actor**: agent-service (sur demande Spring Boot)
**Goal**: Arrêter proprement le subprocess Claude Code
**Flow**:
1. agent-service appelle `plugin.cancel(sessionId)`
2. Plugin envoie SIGTERM au subprocess PTY
3. Cleanup des ressources (fermeture PTY, flush buffer)
4. Event `cancelled` émis

## Dependencies

### Requires

- Feature 01 (slashbot runner module — plugin registry)

### Enables

- Feature 04 (callback handler — reçoit les `ask_user` émis par ce plugin)

## Technical Hints

### Required Tools & Versions

- **node-pty**: spawn PTY — déjà disponible dans agent-service, réutiliser
- **claudeEventParser.ts** et **orchestratorOutputParser.ts** : logique de parsing à portager/réutiliser

### Implementation Notes

- Réutiliser au maximum le code de `agent-service/src/orchestrator/orchestratorExecutor.ts` — ne pas réécrire le parsing NDJSON
- Arguments CLI cibles :
  ```
  claude
    --output-format stream-json
    --model <model>
    --system-prompt <system>
    --dangerously-skip-permissions
    --verbose
    --include-partial-messages
  ```
- Les credentials (`ANTHROPIC_API_KEY` ou OAuth token) sont dans les env vars du process — le plugin les lit directement
- Le plugin doit exposer une interface `IAgentPlugin` : `{ name, canHandle(stepType), execute(payload): AsyncIterator<RunnerEvent>, cancel(sessionId) }`

## Open Questions

- Le plugin est-il enregistré statiquement (config slashbot au boot) ou dynamiquement (hot-reload) ?
- Faut-il supporter plusieurs instances simultanées du plugin (sessions parallèles) ou une à la fois ?
