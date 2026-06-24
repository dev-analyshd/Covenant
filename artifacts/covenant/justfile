#!/usr/bin/env just --justfile
# Covenant — ZK Compliance Credentials on Stellar
# Stellar Hacks: Real-World ZK · June 2026

set dotenv-load := true

TESTNET_RPC     := "https://soroban-testnet.stellar.org"
TESTNET_HORIZON := "https://horizon-testnet.stellar.org"
NETWORK_PHRASE  := "Test SDF Network ; September 2015"
STELLAR_SECRET  := env_var_or_default("STELLAR_SECRET", "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ")
STELLAR_PUBLIC  := "GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V"

# Default: show help
default:
    @just --list

# ──────────────────────────────────────────────────────────────────
# Circuit operations (requires nargo + barretenberg)
# ──────────────────────────────────────────────────────────────────

# Compile all Noir circuits
compile-circuits:
    @echo "→ Compiling compliance_credential circuit..."
    cd circuits/compliance_credential && nargo compile
    @echo "→ Compiling private_settlement circuit..."
    cd circuits/private_settlement && nargo compile
    @echo "✓ Circuits compiled"

# Run Noir tests
test-circuits:
    @echo "→ Testing compliance_credential..."
    cd circuits/compliance_credential && nargo test
    @echo "→ Testing private_settlement..."
    cd circuits/private_settlement && nargo test
    @echo "✓ Circuit tests passed"

# Generate a compliance credential proof (requires compiled circuit)
prove-compliance:
    #!/usr/bin/env bash
    echo "→ Generating compliance credential proof..."
    cd circuits/compliance_credential
    nargo execute witness
    bb prove -b target/compliance_credential.json -w target/witness.gz -o proof.bin
    echo "→ Verifying proof locally..."
    bb verify -k vk.bin -p proof.bin
    echo "✓ Compliance credential proof generated and verified"

# Generate a settlement proof
prove-settlement:
    #!/usr/bin/env bash
    echo "→ Generating private settlement proof..."
    cd circuits/private_settlement
    nargo execute witness
    bb prove -b target/private_settlement.json -w target/witness.gz -o proof.bin
    echo "→ Verifying proof locally..."
    bb verify -k vk.bin -p proof.bin
    echo "✓ Settlement proof generated and verified"

# Export verification keys for Soroban contracts
export-vkeys:
    cd circuits/compliance_credential && bb write_vk -b target/compliance_credential.json -o vk.bin
    cd circuits/private_settlement && bb write_vk -b target/private_settlement.json -o vk.bin
    @echo "✓ Verification keys exported"

# ──────────────────────────────────────────────────────────────────
# Contract operations (requires Rust + cargo-soroban + stellar CLI)
# ──────────────────────────────────────────────────────────────────

# Build all Soroban contracts
build-contracts:
    @echo "→ Building Soroban contracts..."
    cargo build --release --target wasm32-unknown-unknown
    stellar contract optimize --wasm target/wasm32-unknown-unknown/release/covenant_registry.wasm
    stellar contract optimize --wasm target/wasm32-unknown-unknown/release/covenant_settlement.wasm
    stellar contract optimize --wasm target/wasm32-unknown-unknown/release/covenant_compliance_bridge.wasm
    stellar contract optimize --wasm target/wasm32-unknown-unknown/release/ultrahonk_verifier.wasm
    @echo "✓ Contracts built and optimized"

# Test all Soroban contracts
test-contracts:
    @echo "→ Running Soroban contract tests..."
    cargo test
    @echo "✓ Contract tests passed"

# ──────────────────────────────────────────────────────────────────
# Deployment (Stellar testnet)
# ──────────────────────────────────────────────────────────────────

# Deploy all contracts to testnet
deploy: build-contracts
    @bash scripts/deploy.sh

# Deploy UltraHonk verifier
deploy-verifier:
    stellar contract deploy \
        --wasm target/wasm32-unknown-unknown/release/ultrahonk_verifier_optimized.wasm \
        --source {{STELLAR_SECRET}} \
        --network testnet

# ──────────────────────────────────────────────────────────────────
# Frontend
# ──────────────────────────────────────────────────────────────────

# Start frontend dev server
frontend:
    pnpm run dev

# Build frontend for production
build-frontend:
    pnpm run build

# ──────────────────────────────────────────────────────────────────
# Full pipeline
# ──────────────────────────────────────────────────────────────────

# Run everything: compile circuits, build + test contracts, build frontend
all: compile-circuits test-circuits build-contracts test-contracts build-frontend
    @echo ""
    @echo "✓ Covenant build complete"
    @echo "  Circuits: Noir + UltraHonk"
    @echo "  Contracts: Soroban Protocol 26"
    @echo "  Frontend: React + Stellar SDK"

# Full proof generation flow
prove: prove-compliance prove-settlement
    @echo "✓ All proofs generated"

# Check testnet account
account-info:
    curl -s "{{TESTNET_HORIZON}}/accounts/{{STELLAR_PUBLIC}}" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'{b[\"asset_type\"]}: {b[\"balance\"]}') for b in d['balances']]"

# Fund testnet account via friendbot
fund:
    curl -s "https://friendbot.stellar.org?addr={{STELLAR_PUBLIC}}" | python3 -c "import sys,json;d=json.load(sys.stdin);print('Funded!' if 'hash' in d else d.get('detail','?'))"

# Clean build artifacts
clean:
    cargo clean
    rm -f circuits/compliance_credential/proof.bin
    rm -f circuits/compliance_credential/vk.bin
    rm -f circuits/private_settlement/proof.bin
    rm -f circuits/private_settlement/vk.bin
    @echo "✓ Clean complete"
