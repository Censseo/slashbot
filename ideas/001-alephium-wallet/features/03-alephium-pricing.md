# Feature: Alephium Pricing Integration

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Integrate ALPH/USD and custom-token/ALPH exchange rate feeds into the existing pricing system, so Alephium balances display USD equivalences alongside Solana balances. Extends the existing `exchangeRates.ts` and `pricingService.ts` to support multi-chain pricing.

## User Value

**Who benefits**: Users with Alephium wallets
**What they gain**: See the USD value of their ALPH and token holdings, consistent with how SOL/SLASHBOT values are displayed
**Success metric**: Balance commands show accurate USD equivalences for ALPH and custom token

## Scope

### This Feature Includes
- ALPH/USD price feed integration (CoinGecko or similar API)
- Custom token/ALPH price feed (DEX API or configured rate)
- Extension of `exchangeRates.ts` to fetch and cache ALPH prices
- Extension of `pricingService.ts` to calculate ALPH-denominated costs in USD
- Balance display formatting with USD equivalences for Alephium assets
- Sidebar integration showing ALPH balance with USD value
- Graceful degradation when ALPH price feed is unavailable

### This Feature Does NOT Include
- Cross-chain price comparison or arbitrage features
- Historical price charts or tracking
- Price alerts or notifications
- Cost estimation for Alephium transactions (gas fees in ALPH)

## Key Use Cases

### Use Case 1: View Balance with USD Value
**Actor**: User with Alephium wallet
**Goal**: Understand the USD value of their Alephium holdings
**Flow**:
1. User runs `/wallet alph balance`
2. System fetches current ALPH/USD rate
3. Displays: `ALPH: 150.00 (~$225.00 USD)` and `TOKEN: 1000 (~$50.00 USD)`

### Use Case 2: Aggregated Multi-Chain Balance
**Actor**: User with both wallets
**Goal**: See total portfolio value across chains
**Flow**:
1. User runs `/wallet balance`
2. System shows Solana balances with USD values
3. System shows Alephium balances with USD values
4. Optionally shows total USD across all chains

### Use Case 3: Price Unavailable
**Actor**: User when price API is down
**Goal**: Still see balances even without USD conversion
**Flow**:
1. User runs `/wallet alph balance`
2. Price feed returns error/timeout
3. Displays: `ALPH: 150.00 (USD price unavailable)` -- no crash, no blocking

## Dependencies

### Requires
- Feature 01 (multi-chain-abstraction): Multi-chain balance display structure
- Feature 02 (alephium-adapter): ALPH and token balance queries

### Enables
- Nothing (terminal feature in the dependency chain)

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun test` | Run tests |
| 2 | `bun run build` | Verify build |

### Required Tools & Versions

- No new dependencies expected (HTTP fetch for price API is built-in)

### Implementation Notes

- CoinGecko API provides ALPH/USD: `https://api.coingecko.com/api/v3/simple/price?ids=alephium&vs_currencies=usd`
- Cache ALPH/USD rate with same TTL as SOL/USD (likely 60s or similar)
- Custom token pricing may need a different source (Alephium DEX API or hardcoded rate initially)
- Existing `exchangeRates.ts` fetches SOL/USD and SLASHBOT/SOL -- extend pattern for ALPH
- Existing `pricingService.ts` uses rates for cost calculation -- add ALPH conversion methods
- Sidebar items from wallet plugin should show ALPH balance when Alephium wallet exists
- Consider rate limiting: CoinGecko free tier has limits (10-30 calls/minute)

## Open Questions

- Which price feed API to use for ALPH/USD? CoinGecko free tier may be sufficient
- How to get the custom token price? Is there a DEX on Alephium with an API? Or use a configured static rate?
- Should we show a total portfolio value in USD across all chains?

## Notes

This is the least risky feature since it builds on top of the existing pricing pattern. The main challenge is finding a reliable price feed for the custom Alephium token -- ALPH/USD is well-supported by major APIs, but a custom token may need a specialized source.
