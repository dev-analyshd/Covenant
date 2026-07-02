#!/usr/bin/env bash
# ============================================================================
# Covenant Proof Generation Script
# ============================================================================
# Generates UltraHonk proofs for Covenant circuits using Barretenberg.
#
# Prerequisites:
#   - nargo installed (https://noir-lang.org/docs/getting_started/installation)
#   - bb (barretenberg) installed (https://github.com/AztecProtocol/barretenberg)
#
# Usage:
#   bash scripts/generate_proof.sh compliance   # Compliance credential proof
#   bash scripts/generate_proof.sh settlement   # Private settlement proof
#   bash scripts/generate_proof.sh all          # Both proofs
# ============================================================================

set -euo pipefail

MODE="${1:-all}"

echo "═══════════════════════════════════════════════════════════"
echo "  Covenant — ZK Proof Generation"
echo "  Mode: ${MODE}"
echo "═══════════════════════════════════════════════════════════"

# ── Compliance Credential Proof ───────────────────────────────────
prove_compliance() {
    echo ""
    echo "→ [compliance_credential] Compiling circuit..."
    cd circuits/compliance_credential
    nargo compile

    echo "→ [compliance_credential] Writing verification key..."
    bb write_vk \
        -b target/compliance_credential.json \
        -o vk.bin

    echo "→ [compliance_credential] Executing witness..."
    # Prolog.toml must contain the private inputs (see circuits/compliance_credential/)
    nargo execute witness

    echo "→ [compliance_credential] Generating UltraHonk proof..."
    bb prove \
        -b target/compliance_credential.json \
        -w target/witness.gz \
        -o proof.bin

    echo "→ [compliance_credential] Verifying proof..."
    bb verify \
        -k vk.bin \
        -p proof.bin

    echo ""
    echo "  Proof:  circuits/compliance_credential/proof.bin"
    echo "  VK:     circuits/compliance_credential/vk.bin"
    echo "  Size:   $(wc -c < proof.bin) bytes"

    # Extract hex for Soroban submission
    echo ""
    echo "→ [compliance_credential] Proof hex (for Soroban):"
    xxd -p proof.bin | tr -d '\n'
    echo ""

    cd ../..
    echo "✓ Compliance credential proof complete"
}

# ── Private Settlement Proof ──────────────────────────────────────
prove_settlement() {
    echo ""
    echo "→ [private_settlement] Compiling circuit..."
    cd circuits/private_settlement
    nargo compile

    echo "→ [private_settlement] Writing verification key..."
    bb write_vk \
        -b target/private_settlement.json \
        -o vk.bin

    echo "→ [private_settlement] Executing witness..."
    nargo execute witness

    echo "→ [private_settlement] Generating UltraHonk proof..."
    bb prove \
        -b target/private_settlement.json \
        -w target/witness.gz \
        -o proof.bin

    echo "→ [private_settlement] Verifying proof..."
    bb verify \
        -k vk.bin \
        -p proof.bin

    echo ""
    echo "  Proof:  circuits/private_settlement/proof.bin"
    echo "  VK:     circuits/private_settlement/vk.bin"
    echo "  Size:   $(wc -c < proof.bin) bytes"

    echo ""
    echo "→ [private_settlement] Proof hex (for Soroban):"
    xxd -p proof.bin | tr -d '\n'
    echo ""

    cd ../..
    echo "✓ Private settlement proof complete"
}

case "$MODE" in
    compliance)
        prove_compliance
        ;;
    settlement)
        prove_settlement
        ;;
    all)
        prove_compliance
        prove_settlement
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        echo "  ✓ All proofs generated successfully"
        echo "═══════════════════════════════════════════════════════════"
        ;;
    *)
        echo "Usage: $0 [compliance|settlement|all]"
        exit 1
        ;;
esac
