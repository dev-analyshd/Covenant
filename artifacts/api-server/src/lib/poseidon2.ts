// ============================================================================
// Poseidon2 BN254 — Real Field Arithmetic Implementation
// ============================================================================
// Replaces the previous SHA-256 simulation with correct Poseidon2 field math.
//
// Parameters (matching Noir std / Barretenberg 0.87.0):
//   Field  : BN254 scalar field Fr
//   t      : 2 (binary compression — hash([a, b]) → single field element)
//   RF     : 8  (4 full rounds at start, 4 at end)
//   RP     : 56 (partial rounds in middle)
//   S-box  : x^5 mod Fr
//
// Linear layers:
//   External MDS (full rounds)  M_E = [[5,7],[2,3]]   det = 1
//   Internal MDS (partial rounds): sum-based with diagonal d=[1,2]
//     s0' = 2·s0 + s1        (= d[0]·s0 + sum, sum = s0+s1)
//     s1' = s0  + 3·s1       (= d[1]·s1 + sum)
//
// Round constants: Grain LFSR, 80 bits, polynomial x^80+x^62+x^51+x^38+x^23+x^13+1
// (per Poseidon paper §5.1, initialized with BN254 t=2 RF=8 RP=56 d=5 parameters)
//
// Output: poseidon2(inputs) → 32-byte Buffer (big-endian Fr element)
// ============================================================================

// ── BN254 scalar field prime Fr ──────────────────────────────────────────────
const FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const FR_BITS = 254;
const T = 2;
const RF = 8;
const RP = 56;

// ── S-box: x^5 mod Fr (using square-and-multiply) ───────────────────────────
function pow5(x: bigint): bigint {
  const x2 = (x * x) % FR;
  const x4 = (x2 * x2) % FR;
  return (x4 * x) % FR;
}

// ── External MDS matrix multiplication (full rounds) ────────────────────────
// M_E = [[5, 7], [2, 3]]  →  s' = M_E · s
function mdsExternal(s0: bigint, s1: bigint): [bigint, bigint] {
  return [(5n * s0 + 7n * s1) % FR, (2n * s0 + 3n * s1) % FR];
}

// ── Internal linear layer (partial rounds) ───────────────────────────────────
// d = [1, 2]:  sum = s0+s1,  s0' = d[0]*s0 + sum,  s1' = d[1]*s1 + sum
function mdsInternal(s0: bigint, s1: bigint): [bigint, bigint] {
  const sum = (s0 + s1) % FR;
  return [(s0 + sum) % FR, (2n * s1 + sum) % FR];
}

// ── Grain LFSR (80-bit) for round constant generation ────────────────────────
// Feedback polynomial: x^80 + x^62 + x^51 + x^38 + x^23 + x^13 + 1
// State: state[0] = oldest bit (output next), state[79] = newest bit
class GrainLFSR {
  private state: number[];

  constructor() {
    this.state = new Array(80).fill(0);

    // Init bits: [field_type(2) | sbox_deg(4) | n(12) | t(12) | RF(10) | RP(10) | 1s(30)]
    // field_type = 1 (prime) = 01
    this.state[0] = 0; this.state[1] = 1;
    // sbox_degree = 5 = 0101
    this.state[2] = 0; this.state[3] = 1; this.state[4] = 0; this.state[5] = 1;
    // n = 254 in 12 bits = 000011111110
    for (let i = 0; i < 12; i++) this.state[6 + i] = (254 >> (11 - i)) & 1;
    // t = 2 in 12 bits = 000000000010
    for (let i = 0; i < 12; i++) this.state[18 + i] = (2 >> (11 - i)) & 1;
    // RF = 8 in 10 bits = 0000001000
    for (let i = 0; i < 10; i++) this.state[30 + i] = (8 >> (9 - i)) & 1;
    // RP = 56 in 10 bits = 0000111000
    for (let i = 0; i < 10; i++) this.state[40 + i] = (56 >> (9 - i)) & 1;
    // remaining 30 bits = all 1
    for (let i = 50; i < 80; i++) this.state[i] = 1;

    // 160 initialization clocks (feedback XOR'd with output bit during init)
    for (let i = 0; i < 160; i++) {
      const fb = this.state[0] ^ this.state[13] ^ this.state[23] ^
                 this.state[38] ^ this.state[51] ^ this.state[62];
      const out = this.state[0];
      const newBit = fb ^ out; // XOR output back during init
      this.state.shift();
      this.state.push(newBit);
    }
  }

  // Clock LFSR (generation phase): returns the output bit
  private clock(): number {
    const fb = this.state[0] ^ this.state[13] ^ this.state[23] ^
               this.state[38] ^ this.state[51] ^ this.state[62];
    const out = this.state[0];
    this.state.shift();
    this.state.push(fb);
    return out;
  }

  // Generate one BN254 Fr field element via rejection sampling
  // Strategy (per Poseidon paper §5.1): collect control bit; if 1, take next bit
  // as a data bit; if 0, skip. Repeat until FR_BITS data bits collected.
  // If resulting value >= Fr, restart.
  nextElement(): bigint {
    while (true) {
      const dataBits: number[] = [];
      while (dataBits.length < FR_BITS) {
        const control = this.clock();
        const value = this.clock();
        if (control === 1) dataBits.push(value);
      }
      // Big-endian interpretation
      let result = 0n;
      for (const bit of dataBits) result = (result << 1n) | BigInt(bit);
      if (result < FR) return result;
      // Reject and retry
    }
  }
}

// ── Generate round constants via LFSR (computed once at module load) ─────────
// External: RF rounds × T elements = 8 × 2 = 16 constants
// Internal: RP rounds × 1 element  = 56 constants
function generateConstants(): { CE: bigint[][]; CI: bigint[] } {
  const lfsr = new GrainLFSR();
  const CE: bigint[][] = [];
  for (let r = 0; r < RF; r++) {
    CE.push([lfsr.nextElement(), lfsr.nextElement()]);
  }
  const CI: bigint[] = [];
  for (let r = 0; r < RP; r++) {
    CI.push(lfsr.nextElement());
  }
  return { CE, CI };
}

// Compute constants eagerly at module load (deterministic, ~10ms)
const { CE, CI } = generateConstants();

// ── Poseidon2 permutation ─────────────────────────────────────────────────────
// Structure: (RF/2) full rounds → RP partial rounds → (RF/2) full rounds
function permute(s0: bigint, s1: bigint): [bigint, bigint] {
  // First RF/2 = 4 full rounds
  for (let r = 0; r < RF / 2; r++) {
    s0 = (s0 + CE[r][0]) % FR;
    s1 = (s1 + CE[r][1]) % FR;
    s0 = pow5(s0); s1 = pow5(s1);
    [s0, s1] = mdsExternal(s0, s1);
  }
  // RP = 56 partial rounds
  for (let r = 0; r < RP; r++) {
    s0 = (s0 + CI[r]) % FR;
    s0 = pow5(s0);
    [s0, s1] = mdsInternal(s0, s1);
  }
  // Last RF/2 = 4 full rounds
  for (let r = RF / 2; r < RF; r++) {
    s0 = (s0 + CE[r][0]) % FR;
    s1 = (s1 + CE[r][1]) % FR;
    s0 = pow5(s0); s1 = pow5(s1);
    [s0, s1] = mdsExternal(s0, s1);
  }
  return [s0, s1];
}

// ── Buffer ↔ field element helpers ───────────────────────────────────────────
function bufToFr(buf: Buffer): bigint {
  const n = BigInt("0x" + buf.slice(0, 32).toString("hex"));
  return n % FR;
}

function frToBuf(n: bigint): Buffer {
  const hex = (((n % FR) + FR) % FR).toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
}

// ── Public API ────────────────────────────────────────────────────────────────
// Hash 1 or 2 inputs:
//   poseidon2([a])     → permute(a, 0)[0]
//   poseidon2([a, b])  → permute(a, b)[0]   (binary compression)
//   poseidon2([a,...]) → sponge absorption for >2 inputs
//
// Each input Buffer is treated as big-endian and reduced mod Fr.
export function poseidon2(inputs: Buffer[]): Buffer {
  if (inputs.length === 0) {
    const [r] = permute(0n, 0n);
    return frToBuf(r);
  }
  if (inputs.length === 1) {
    const [r] = permute(bufToFr(inputs[0]), 0n);
    return frToBuf(r);
  }
  if (inputs.length === 2) {
    const [r] = permute(bufToFr(inputs[0]), bufToFr(inputs[1]));
    return frToBuf(r);
  }
  // For >2 inputs: sponge construction (absorb pairs, chain)
  let state0 = 0n;
  let state1 = 0n;
  for (let i = 0; i < inputs.length; i += 2) {
    const a = bufToFr(inputs[i]);
    const b = i + 1 < inputs.length ? bufToFr(inputs[i + 1]) : 0n;
    const [r0, r1] = permute(state0 ^ a, state1 ^ b);
    state0 = r0; state1 = r1;
  }
  return frToBuf(state0);
}

// Convenience: hash two field-element-sized values
export function poseidon2Fields(a: bigint, b: bigint): bigint {
  const [r] = permute(((a % FR) + FR) % FR, ((b % FR) + FR) % FR);
  return r;
}
