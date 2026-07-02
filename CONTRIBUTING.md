# Contributing to Covenant

1. Fork and clone
2. Branch: `git checkout -b feature/name`
3. Commit: `git commit -m "feat: description"`
4. Push and open PR

## Code Style

- TypeScript: Strict mode
- Rust: `cargo fmt` + `cargo clippy`
- Noir: `nargo fmt`

## Prerequisites

- Node.js 20+ and npm (or pnpm)
- Rust + `wasm32-unknown-unknown` target
- [Stellar CLI](https://github.com/stellar/stellar-cli) for contract deployment
- [Nargo](https://noir-lang.org/docs/getting_started/installation/) for Noir circuits

## Development

```bash
# Install frontend dependencies
npm install

# Run frontend dev server
PORT=5000 BASE_PATH=/ npm run dev

# Build Soroban contracts
cargo build --release --target wasm32-unknown-unknown

# Compile Noir circuits
cd circuits/compliance_credential && nargo compile
cd circuits/private_settlement && nargo compile

# Deploy contracts to testnet
./scripts/deploy.sh
```
