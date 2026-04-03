# Idea: Claude Max/Pro OAuth Authentication

**Created**: 2026-02-15
**Status**: Exploration
**Short Name**: claude-oauth

## Vision

Allow slashbot users with a Claude Max or Pro subscription to authenticate via Anthropic's OAuth PKCE flow and use their subscription for API calls, eliminating the need for a separate paid API key.

## Problem Statement

### The Problem
Slashbot currently only supports API key authentication. Users with Claude Max/Pro subscriptions ($20-$200/month) must pay *additionally* for API credits to use slashbot with Anthropic models, even though their subscription includes inference access.

### Current Situation
- Users must obtain API keys from console.anthropic.com and pay per-token
- Claude Code CLI already solves this via an OAuth PKCE flow that returns `sk-ant-oat01-*` tokens
- Other tools (anthropic-max-router, opencode, Roo-Code) are also implementing this flow
- Users who only have a Max/Pro subscription cannot use slashbot with Anthropic at all

### Why Now?
- Anthropic's OAuth infrastructure is mature (used by Claude Code CLI)
- The community has reverse-engineered and documented the flow
- Multiple open-source implementations exist as reference (Rust, TypeScript)
- Growing user demand for subscription-based access in third-party tools

## Target Users

### Primary Users
- **Slashbot users with Claude Max/Pro**: Have a subscription, want to use Anthropic models without paying for API credits. Moderate technical level.

### Secondary Stakeholders
- Slashbot maintainers: need to maintain token refresh logic and handle Anthropic OAuth changes

## Goals & Success Metrics

### Primary Goals
1. Users can run `/login anthropic` and authenticate via their browser using their Claude subscription
2. Token refresh happens automatically with no user intervention

### Success Indicators
- User can chat with Claude models using only their Max/Pro subscription
- Token refresh works transparently (no re-login needed for weeks/months)
- Login flow takes under 30 seconds

### MVP Definition
- OAuth PKCE flow with browser-based login
- Token storage in credentials.json
- Automatic token refresh before expiration
- Integration with existing `ProviderRegistry` (pass OAuth token as apiKey)

## Scope

### In Scope (MVP)
- OAuth PKCE flow implementation (authorize + token exchange)
- Local HTTP callback server for redirect
- Token persistence in `~/.slashbot/credentials.json`
- Automatic refresh when access token expires (8h lifetime)
- `/login anthropic --oauth` command (or auto-detect subscription)
- Seamless integration with existing Vercel AI SDK provider

### In Scope (Future)
- Auto-detect if user has Claude Code tokens and offer to import
- Console OAuth mode for programmatic API key creation
- Token health check / status command

### Explicitly Out of Scope
- Supporting other OAuth providers (Google, OpenAI) - separate features
- Proxy/router functionality (anthropic-max-router style)
- Claude Code SDK integration

## Key Use Cases (Sketches)

### Use Case 1: First-time OAuth Login
**Actor**: User with Claude Max subscription
**Goal**: Authenticate slashbot to use their subscription
**Flow**:
1. User types `/login anthropic` (or `/login anthropic --oauth`)
2. Slashbot starts local HTTP server, opens browser to Anthropic's OAuth authorize URL
3. User logs in on claude.ai and approves access
4. Browser redirects to localhost with auth code
5. Slashbot exchanges code for access+refresh tokens, stores them
6. User sees "Connected to Anthropic (Claude Max)" confirmation

### Use Case 2: Automatic Token Refresh
**Actor**: Returning user
**Goal**: Continue using slashbot without re-authenticating
**Flow**:
1. User starts slashbot, access token has expired (8h lifetime)
2. Slashbot detects expiration, uses refresh token to get new access token
3. User is seamlessly connected without any interaction

### Use Case 3: Token Expiration / Re-auth
**Actor**: User whose refresh token has expired
**Goal**: Re-authenticate
**Flow**:
1. Slashbot detects refresh token is also expired
2. Prompts user: "Session expired. Run /login anthropic to reconnect."
3. User re-runs OAuth flow

## Constraints & Assumptions

### Known Constraints
- **Technical**: Anthropic's OAuth endpoints are undocumented/unofficial - they could change
- **Technical**: Access tokens expire every 8 hours, requiring refresh logic
- **Technical**: Refresh tokens eventually expire too (exact lifetime unknown)
- **Technical**: Anthropic requires system prompt injection for OAuth-authenticated requests
- **Business**: This uses an unofficial API flow - Anthropic could block third-party OAuth clients

### Assumptions
- Anthropic's OAuth client ID `9d1c250a-e61b-44d9-88ed-5944d1962f5e` works for third-party apps (same as Claude Code CLI)
- The token format `sk-ant-oat01-*` is accepted by the standard `/v1/messages` endpoint
- `@ai-sdk/anthropic` works with OAuth tokens (same Bearer auth header)
- Local callback server on localhost is acceptable (no remote/headless support in MVP)

## Features Overview

**Complexity Score**: 3/10 - Simple

Single feature, one user type, one integration point, one domain. The OAuth PKCE flow is well-documented and the integration surface is small (ProviderRegistry + ConfigManager).

### Feature Breakdown

No decomposition needed - this is a focused, single-feature idea.

## Open Questions & Risks

### Questions to Resolve
- Does `@ai-sdk/anthropic` SDK work with OAuth tokens (`sk-ant-oat01-*`) or does it require standard API keys (`sk-ant-api03-*`)?
- Does Anthropic enforce system prompt injection for OAuth requests? If so, what content?
- What is the actual lifetime of refresh tokens?
- Can we use the same client ID as Claude Code, or should we register our own?

### Identified Risks
- **Anthropic blocks third-party OAuth**: Mitigation - fall back to API key auth, keep it as optional
- **OAuth endpoints change**: Mitigation - abstract the OAuth flow, easy to update endpoints
- **Rate limiting differs for OAuth vs API keys**: Mitigation - document limitations, user accepts subscription rate limits

## Discovery Notes

### Session 2026-02-15
- Q: Reuse Claude Code token or independent OAuth? -> A: Independent OAuth flow
- Q: Subscription type? -> A: Claude Max/Pro (consumer)
- Q: How to access token? -> A: Generate own token via same OAuth PKCE procedure as Claude Code
- Q: Integration method? -> A: Auto-detect + manual command

## Technical Hints

### OAuth PKCE Flow

| Step | Endpoint | Details |
|------|----------|---------|
| 1 | `https://claude.ai/oauth/authorize` | Authorization URL with PKCE challenge |
| 2 | `http://localhost:<port>/callback` | Local redirect URI |
| 3 | `https://console.anthropic.com/api/oauth/token` | Token exchange |
| 4 | Same token endpoint | Refresh with `grant_type=refresh_token` |

### Authorization URL Parameters

| Parameter | Value |
|-----------|-------|
| `client_id` | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| `response_type` | `code` |
| `redirect_uri` | `http://localhost:<port>/callback` |
| `scope` | `user:inference user:profile` |
| `code_challenge` | SHA-256 hash of code_verifier |
| `code_challenge_method` | `S256` |
| `state` | Random CSRF token |

### Token Response Structure

```json
{
  "access_token": "sk-ant-oat01-...",
  "refresh_token": "sk-ant-ort01-...",
  "expires_in": 28800,
  "token_type": "Bearer",
  "scope": "user:inference user:profile"
}
```

### Required Tools & Versions

- **Bun built-in crypto**: For PKCE SHA-256 challenge generation
- **Bun HTTP server**: For local OAuth callback listener
- **`open` package** (or `xdg-open`/`start`): To open browser for authorization

### Integration Points

- **ProviderCredentials**: Extend to support `authType: 'oauth' | 'apikey'` and store tokens
- **ProviderRegistry**: Pass OAuth token as `apiKey` to `@ai-sdk/anthropic` (should work with Bearer auth)
- **ConfigManager**: Store OAuth tokens (accessToken, refreshToken, expiresAt) in credentials.json
- **Login command**: Add OAuth flow option for Anthropic provider

### Implementation Notes

- PKCE code_verifier: 43-128 char random string (RFC 7636)
- PKCE code_challenge: Base64url(SHA256(code_verifier))
- Token refresh should happen proactively (e.g., 5 min before expiry)
- The `anthropic` provider in ProviderRegistry already accepts `apiKey` + `headers` - OAuth token goes as apiKey

### Reference Implementations

- **Rust**: https://github.com/querymt/anthropic-auth
- **TypeScript**: https://github.com/nsxdavid/anthropic-max-router (src/oauth.ts)
- **Claude Code CLI**: ~/.claude/.credentials.json structure
