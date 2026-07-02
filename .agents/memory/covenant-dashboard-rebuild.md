---
name: Covenant dashboard rebuild
description: Key quirks and fixes discovered during the July 2 2026 full dashboard rebuild and test run.
---

## @creit.tech/stellar-wallets-kit v2.5.0 — sub-path imports required

In v2.5.0, wallet modules are NOT re-exported from the main package entry point. Each must be imported from its own sub-path:

```ts
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule }    from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule }     from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { RabetModule }     from "@creit.tech/stellar-wallets-kit/modules/rabet";
// ... etc for lobstr, hana, hotwallet, klever, bitget, cactuslink, onekey, ledger
```

**Why:** The main `esm/mod.js` only re-exports `sdk/mod.js` → `kit.js + utils.js`, not the individual module classes.

## Node.js polyfills required for wallet kit

The wallet kit chain (`@trezor/connect` etc.) uses Node.js globals (`global`, `Buffer`, `process`, `events`, `stream`) that don't exist in browsers. Fix: `vite-plugin-node-polyfills` with `protocolImports: true`.

```ts
import { nodePolyfills } from "vite-plugin-node-polyfills";
// add as first plugin: nodePolyfills({ protocolImports: true })
```

## api-server workspace dependencies removed

`artifacts/api-server` used to depend on `@workspace/api-zod` and `@workspace/db` (pnpm workspace). After restructuring to root-level package:
- `health.ts`: inline `HealthCheckResponse` with `zod` directly
- `package.json`: remove `@workspace/api-zod`, `@workspace/db`, `drizzle-orm: "catalog:"`
- `tsconfig.json`: remove `extends`, `references` — use standalone compilerOptions
- Add `zod` as direct dependency

## api-server correct API contract

- `POST /api/prove/credential`: needs `kycProvider` (string), `riskScore` (0-100), `credentialSecret` (32-byte hex), optional `sourceOfFunds`, `country`
- `POST /api/prove/settlement`: needs `fromAsset`, `amount`, `complianceNullifier`, optional `toAsset`, `credentialSecret`, `recipientCommitmentSeed`
- `POST /api/verify`: field name is `proof` (not `proofHex`), also needs `publicInputs` array (min length 4), `proof` string must be exactly 512 hex chars (256 bytes)

## Vite watcher ENOSPC fix

Replit inotify limit is hit when Vite watches the pnpm store. Add to vite.config.ts:

```ts
server: {
  watch: {
    ignored: ["**/node_modules/**", "**/.git/**", "**/.local/share/pnpm/**", "**/pnpm-store/**"],
    usePolling: false,
  }
}
```

## Routes as of July 2 2026

9 routes: `/`, `/treasury`, `/credentials`, `/settlements`, `/bridge`, `/audit`, `/explorer` (ZK Explorer), `/settings`, `/support`
Sidebar paths match exactly — `/explorer` not `/zk-explorer`.
