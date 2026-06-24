---
name: Covenant workflow startup
description: Required env vars and command for running the Covenant dev server in Replit
---

The Covenant vite.config.ts validates `PORT` and `BASE_PATH` at startup and throws if missing.

**Rule:** The workflow command must inline both env vars.

**How to apply:** When configuring/restarting the workflow:
```
PORT=21115 BASE_PATH=/ pnpm --filter @workspace/covenant run dev
```
waitForPort: 21115, outputType: "webview"

**Why:** The vite config has a top-level guard:
```ts
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
if (!basePath) throw new Error("BASE_PATH environment variable is required but was not provided.");
```
Replit's workflow runner does not automatically inject these from artifact.toml's `[services.env]` section when running in dev mode — they must be in the command itself.
