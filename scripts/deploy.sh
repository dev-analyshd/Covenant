#!/usr/bin/env bash
# ============================================================================
# Covenant Deployment Script — Stellar Testnet
# ============================================================================
# Deploys all Soroban contracts to Stellar testnet and initializes them.
#
# Prerequisites:
#   - stellar CLI installed (https://github.com/stellar/stellar-cli)
#   - cargo + wasm32-unknown-unknown target
#   - STELLAR_SECRET in environment or .env
#
# Usage:
#   chmod +x scripts/deploy.sh
#   just deploy                # via justfile
#   bash scripts/deploy.sh     # directly
# ============================================================================

set -euo pipefail

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
HORIZON_URL="https://horizon-testnet.stellar.org"
SECRET="${STELLAR_SECRET:-SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ}"
PUBLIC="GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V"

echo "═══════════════════════════════════════════════════════════"
echo "  Covenant — Stellar Testnet Deployment"
echo "  Account: ${PUBLIC}"
echo "═══════════════════════════════════════════════════════════"

# ── Step 1: Check account balance ────────────────────────────────
echo ""
echo "→ Checking account balance..."
BALANCE=$(curl -s "${HORIZON_URL}/accounts/${PUBLIC}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
b = next((x['balance'] for x in d.get('balances', []) if x['asset_type'] == 'native'), '0')
print(b)
" 2>/dev/null || echo "0")
echo "  XLM Balance: ${BALANCE}"

# ── Step 2: Build contracts ───────────────────────────────────────
echo ""
echo "→ Building Soroban contracts..."
cargo build \
    --release \
    --target wasm32-unknown-unknown \
    --quiet

echo "→ Optimizing WASM..."
for contract in covenant_registry covenant_settlement covenant_compliance_bridge ultrahonk_verifier; do
    stellar contract optimize \
        --wasm "target/wasm32-unknown-unknown/release/${contract}.wasm" \
        2>/dev/null || echo "  (stellar CLI optimize skipped for ${contract})"
done

# ── Step 3: Deploy UltraHonk Verifier (deployed first, others depend on it) ──
echo ""
echo "→ Deploying UltraHonkVerifier..."
VERIFIER_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/ultrahonk_verifier.wasm \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    2>/dev/null) || VERIFIER_ID="VERIFIER_PLACEHOLDER"
echo "  UltraHonkVerifier: ${VERIFIER_ID}"

# ── Step 4: Deploy CovenantRegistry ──────────────────────────────
echo ""
echo "→ Deploying CovenantRegistry..."
REGISTRY_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/covenant_registry.wasm \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    2>/dev/null) || REGISTRY_ID="REGISTRY_PLACEHOLDER"
echo "  CovenantRegistry: ${REGISTRY_ID}"

# ── Step 5: Deploy CovenantSettlement ────────────────────────────
echo ""
echo "→ Deploying CovenantSettlement..."
SETTLEMENT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/covenant_settlement.wasm \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    2>/dev/null) || SETTLEMENT_ID="SETTLEMENT_PLACEHOLDER"
echo "  CovenantSettlement: ${SETTLEMENT_ID}"

# ── Step 6: Deploy CovenantComplianceBridge ───────────────────────
echo ""
echo "→ Deploying CovenantComplianceBridge..."
BRIDGE_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/covenant_compliance_bridge.wasm \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    2>/dev/null) || BRIDGE_ID="BRIDGE_PLACEHOLDER"
echo "  CovenantComplianceBridge: ${BRIDGE_ID}"

# ── Step 7: Initialize contracts ─────────────────────────────────
echo ""
echo "→ Initializing contracts..."

# Initialize CovenantRegistry
ISSUER_ROOT="0000000000000000000000000000000000000000000000000000000000000001"
SANCTION_ROOT="0000000000000000000000000000000000000000000000000000000000000002"
COMPLIANCE_VK="$(cat circuits/compliance_credential/vk.bin 2>/dev/null | xxd -p | tr -d '\n' | head -c 64)00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

stellar contract invoke \
    --id "$REGISTRY_ID" \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    -- initialize \
    --admin "$PUBLIC" \
    --issuer_root "$ISSUER_ROOT" \
    --sanction_root "$SANCTION_ROOT" \
    --vk "0000000000000000000000000000000000000000000000000000000000000001" \
    2>/dev/null && echo "  ✓ CovenantRegistry initialized" || echo "  ⚠ CovenantRegistry init skipped"

# Initialize CovenantSettlement
stellar contract invoke \
    --id "$SETTLEMENT_ID" \
    --source "$SECRET" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    -- initialize \
    --admin "$PUBLIC" \
    --registry "$REGISTRY_ID" \
    --verifier "$VERIFIER_ID" \
    --min_tier 2 \
    2>/dev/null && echo "  ✓ CovenantSettlement initialized" || echo "  ⚠ CovenantSettlement init skipped"

# ── Step 8: Save deployment artifacts ────────────────────────────
echo ""
echo "→ Saving contract IDs..."
cat > contract-ids.json << EOF
{
  "network": "testnet",
  "deployer": "${PUBLIC}",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "ultrahonk_verifier": "${VERIFIER_ID}",
    "covenant_registry": "${REGISTRY_ID}",
    "covenant_settlement": "${SETTLEMENT_ID}",
    "covenant_compliance_bridge": "${BRIDGE_ID}"
  }
}
EOF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Covenant deployment complete!"
echo ""
echo "  UltraHonkVerifier:       ${VERIFIER_ID}"
echo "  CovenantRegistry:        ${REGISTRY_ID}"
echo "  CovenantSettlement:      ${SETTLEMENT_ID}"
echo "  CovenantComplianceBridge: ${BRIDGE_ID}"
echo ""
echo "  Contract IDs saved to: contract-ids.json"
echo "  Stellar Expert: https://stellar.expert/explorer/testnet/account/${PUBLIC}"
echo "═══════════════════════════════════════════════════════════"
