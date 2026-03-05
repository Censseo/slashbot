# Feature: Multi-Chain Wallet Abstraction

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 01
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Extract a blockchain-agnostic wallet interface from the existing Solana wallet code and restructure the command system to support sub-commands by chain (`/wallet solana ...`, `/wallet alph ...`). This is the foundation feature that enables adding any new blockchain without modifying the core wallet plugin.

## User Value

**Who benefits**: All slashbot users (existing Solana users get a cleaner command structure, future Alephium users get the foundation)
**What they gain**: Unified wallet UX across chains, backward-compatible commands
**Success metric**: Existing Solana wallet functionality works identically after refactor; new sub-command routing works

## Scope

### This Feature Includes
- `BlockchainAdapter` interface with operations: createWallet, unlockWallet, getBalance, transfer, getExplorerUrl, validateAddress
- `WalletManager` coordinator that routes operations to the correct adapter based on chain ID
- Refactoring of `src/plugins/wallet/services/solana.ts` and `wallet.ts` to implement the new interface
- Command restructuring: `/wallet solana balance`, `/wallet solana send`, etc.
- Backward compatibility: `/wallet balance` shows all chains, `/wallet create` prompts for chain selection
- Per-chain encrypted wallet storage (separate files: `wallet-solana.json`, `wallet-alph.json`)
- Per-chain session management (unlock sessions per chain)

### This Feature Does NOT Include
- Alephium adapter implementation (Feature 02)
- Exchange rate/pricing changes (Feature 03)
- Any changes to the proxy billing system
- New blockchain SDK dependencies

## Key Use Cases

### Use Case 1: Existing User Continues Using Solana
**Actor**: Existing slashbot user
**Goal**: Continue using Solana wallet without disruption
**Flow**:
1. User runs `/wallet solana balance` (or `/wallet balance` which shows all)
2. System routes to Solana adapter
3. Displays SOL and SLASHBOT balances as before

### Use Case 2: Command Routing
**Actor**: Any user
**Goal**: Execute wallet operations on a specific chain
**Flow**:
1. User types `/wallet <chain> <command> [args]`
2. Command parser identifies chain and routes to appropriate adapter
3. Adapter executes the operation
4. Result displayed with chain-appropriate formatting (explorer links, etc.)

## Dependencies

### Requires
- None (this is the foundation)

### Enables
- Feature 02 (alephium-adapter): Provides the `BlockchainAdapter` interface to implement
- Feature 03 (alephium-pricing): Provides the structure for per-chain pricing integration

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun test` | Verify Solana wallet still works after refactor |
| 2 | `bun run build` | Ensure build passes |

### Required Tools & Versions

- No new dependencies (refactor of existing code only)

### Implementation Notes

- The `BlockchainAdapter` interface should be minimal -- only what's needed for wallet operations
- `services/solana.ts` becomes `adapters/solana.ts` implementing `BlockchainAdapter`
- `services/wallet.ts` becomes chain-agnostic, delegating to adapters
- `services/crypto.ts` stays as-is (already chain-agnostic)
- `commands.ts` (49KB) needs restructuring for sub-command parsing -- consider splitting into separate command handlers per action
- Session management needs per-chain keypair caching
- Wallet file migration: existing `wallet.json` should be auto-migrated to `wallet-solana.json`
- `ProxyAuthProvider` continues to use Solana adapter directly for request signing

## Open Questions

- Should we migrate existing `wallet.json` automatically to `wallet-solana.json`, or keep backward compatibility with the old path?
- Should `/wallet balance` (no chain) aggregate all chains, or require a chain argument?
- How to handle the case where a user has a Solana wallet but no Alephium wallet (and vice versa)?

## Notes

This is the highest-risk feature because it touches the existing working Solana wallet code. Thorough testing is critical. The proxy billing path (`ProxyAuthProvider`) must remain completely functional.
