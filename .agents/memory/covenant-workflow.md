---
name: Covenant workflow startup
description: Required env vars for running the Covenant dev server in Replit's multi-artifact setup
---

The Covenant vite.config.ts validates `PORT` and `BASE_PATH` at startup and throws if missing, and proxies `/api` to `http://localhost:${API_PORT ?? 21116}`.

**Rule:** This project runs on Replit's artifact system (`artifacts/*/​.replit-artifact/artifact.toml`), not classic `.replit` `[workflows]`. Each artifact (covenant web, api-server, mockup-sandbox) is auto-run by the platform from its own `artifact.toml` `[services.development].run` command — do not add duplicate legacy `.replit` workflows that `pnpm --filter` the same package, since two concurrent builds in the same directory race on `dist/` and cause `MODULE_NOT_FOUND`.

**How to apply:** `PORT`/`BASE_PATH` for the covenant service and `PORT` for api-server come from each artifact.toml's `[services.env]`. But `API_PORT` (used by covenant's vite proxy to reach api-server) is NOT set by any artifact.toml — it must be set as a shared env var matching api-server's actual `localPort` (8080), not the old legacy value of 3000. Set via `setEnvVars({values: {API_PORT: "8080"}})` and restart the covenant workflow.

**Why:** api-server's `artifact.toml` declares `localPort = 8080`. The shared env var `API_PORT` was left over at `3000` from a pre-artifacts legacy `.replit` workflow, which silently broke the `/api` proxy (500s) even though both services individually looked healthy.
