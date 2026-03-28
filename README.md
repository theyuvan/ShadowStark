# ShadowFlowBTC++

Zero-knowledge private Bitcoin strategy execution on Starknet.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                USER INTERFACE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Builder: app/builder/page.tsx                                              │
│   ├─ ZKFlowBuilder                                                         │
│   │   ├─ NodeToolbar (ZK cost estimator)                                   │
│   │   ├─ ReactFlow canvas + custom nodes                                   │
│   │   ├─ NodeConfigPanel (PRIVATE fields redacted)                         │
│   │   └─ ZKConstraintPreview                                               │
│   └─ CompileButton                                                         │
│                                                                             │
│ Simulator: app/simulate/page.tsx                                           │
│   └─ ExecutionVisualizer pipeline                                            │
│                                                                             │
│ Dashboard: app/dashboard/page.tsx                                          │
│   └─ CommitmentCard / ProofStatusCard / StarknetStatus / ExecutionTimeline │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT ZK ORCHESTRATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ hooks/useStrategyCompiler.ts                                                │
│ hooks/useZKProver.ts                                                        │
│ hooks/useMerkleTree.ts                                                      │
│ hooks/useNullifier.ts                                                       │
│ hooks/useStarknet.ts                                                        │
│                                                                             │
│ Stores (Zustand):                                                           │
│   strategyStore / proofStore / executionStore / zkStore                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ZK CORE LIBRARIES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ lib/zk/merkleTree.ts      -> Poseidon Merkle tree (depth 20)               │
│ lib/zk/rangeProof.ts      -> Range witness generation + verify              │
│ lib/zk/nullifier.ts       -> Nullifier + replay protection                  │
│ lib/zk/zkProver.ts        -> End-to-end proof pipeline                      │
│ lib/zk/proofAggregator.ts -> Proof aggregation stubs                        │
│                                                                             │
│ Hashing: @scure/starknet (poseidonHash)                                     │
│ Verifier integration stub: @garaga/starknet                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STARKNET / CAIRO LAYER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ contracts/ShadowFlow.cairo                                                  │
│   ├─ store_commitment                                                       │
│   ├─ verify_and_store                                                       │
│   ├─ is_nullifier_spent                                                     │
│   └─ get_merkle_root                                                        │
│                                                                             │
│ contracts/GaragaVerifier.cairo                                              │
│   └─ verify(proof_hash, public_inputs_hash)                                 │
│                                                                             │
│ contracts/circuits/strategy_execution.cairo                                 │
│   └─ range / commitment / transition / merkle / nullifier constraints       │
└─────────────────────────────────────────────────────────────────────────────┘

## Privacy Rules

- Marked `// PRIVATE — never log or transmit`:
  - secret keys
  - private witnesses
  - trade amounts
  - price bounds
  - merkle paths
- Only public outputs are exposed:
  - commitment
  - nullifier
  - merkle root
  - final state hash

## Development

- Install: `npm install`
- Lint: `npm run lint`
- Build: `npm run build`
- Dev server: `npm run dev`
- Deploy contracts (requires Scarb + sncast configured): `npm run deploy:starknet`

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill at minimum:
  - `NEXT_PUBLIC_STARKNET_NETWORK=sepolia`
  - `NEXT_PUBLIC_STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_8`
  - `NEXT_PUBLIC_EXECUTION_API_URL`
    - `STARKNET_EXECUTOR_ADDRESS` and `STARKNET_EXECUTOR_PRIVATE_KEY`
  - `NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true` (for real mode)
  - `NEXT_PUBLIC_STARKSCAN_TX_BASE_URL=https://sepolia.starkscan.co/tx`

When real mode is enabled, the app no longer relies on mock trade data. Wallet
connection, BUY/SELL intent submission, commitment storage, proof verification,
and proof links are expected to come from your execution API + deployed contracts.

Expected execution API endpoints:

- `POST /otc/intents`
- `GET /otc/strategies?walletAddress=...`
- `GET /otc/trades?walletAddress=...`
- `GET /otc/execution-logs?walletAddress=...`
- `GET /otc/proofs/latest?walletAddress=...`
- `GET /tee/attestations/latest?walletAddress=...`
- `GET /wallet/balances?walletAddress=...`
- `POST /commitment/store`
- `POST /proof/verify-and-store`
- `POST /proof/register-valid`
- `GET /nullifier/spent?nullifier=...`
- `GET /chain/state`

When `NEXT_PUBLIC_EXECUTION_API_URL=http://localhost:3000/api`, these are served by Next API routes in this repository.

## External ZK Circuit Compilation (`C:\zk-affordability-loan`)

Detected scripts in that project:

- ZK build script: `scripts/build_zk.sh`
- Deploy script: `scripts/deploy_all.sh`

Typical flow:

1. Install dependencies
  - `npm run install:all`
2. Build circuits
  - Windows (verified): `powershell -ExecutionPolicy Bypass -File .\\scripts\\build_zk_circuit.ps1`
  - Bash: `npm run build:circuits`
3. Configure backend env (`backend/.env`)
4. Deploy contracts
  - `npm run deploy:starknet`

After build, expected artifacts:

- `contracts/zk/build/activityVerifier.wasm`
- `contracts/zk/build/activityVerifier_final.zkey`
- `contracts/zk/build/verification_key.json`
- `backend/src/zk/activityVerifier.wasm`
- `backend/src/zk/activityVerifier_final.zkey`
- `backend/src/zk/verification_key.json`

This repository can integrate with that pipeline through `NEXT_PUBLIC_EXECUTION_API_URL`.

## Notes

This implementation is architecturally correct for a ZK pipeline with clear separation
between public inputs and private witness data. Circuit proof generation and verification
are represented with safe stubs where full prover/verifier backend integration is pending.

## Step 15: Cairo Contract Review

Contracts reviewed:

- `contracts/ShadowFlow.cairo`
- `contracts/GaragaVerifier.cairo`
- `contracts/circuits/strategy_execution.cairo`

Findings:

- `ShadowFlow.cairo` correctly stores commitments, tracks nullifier spend state, and gates state writes on verifier response.
- `GaragaVerifier.cairo` is currently a stub verifier using allow-list logic (`allowed_proofs`) rather than cryptographic proof verification.
- `strategy_execution.cairo` is a placeholder constraint model using arithmetic assertions to represent commitment, range, transition, Merkle, and nullifier checks.

Implication:

- The contract layer is structurally aligned with the app flow, but production security requires replacing both verifier and circuit placeholders with real proving-system integration.

## Contract Compile + Address Export

Deployment workflow script:

- `scripts/compile-and-deploy-starknet.ps1`

What it does:

1. Builds Cairo contracts with `scarb build`
2. Declares + deploys `GaragaVerifier`
3. Declares + deploys `ShadowFlow` with constructor calldata
4. Saves deployed addresses to `contracts/deployment/deployed-addresses.json`

Then copy addresses into `.env.local`:

- `NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS`

## Online Documentation Verification (Starknet + Bitcoin)

The current app assumptions were cross-checked against online docs:

- Starknet docs (`docs.starknet.io`) quickstart explicitly includes deployment/interactions on Starknet Sepolia.
- Starknet docs confirm modern toolchain expectations (Scarb, Starknet Foundry, Devnet), including Windows guidance via WSL.
- Bitcoin developer docs (`developer.bitcoin.org`) confirm UTXO-based transaction model, txid/vout input references, and standard script validation flow.
- Bitcoin docs reinforce that transaction outputs become UTXOs until spent and that signatures authorize spending conditions, matching the app’s commitment/execution mental model.

Scope note:

- This project does not execute native Bitcoin transactions directly; BTC strategy semantics are represented in the private strategy/ZK pipeline and verified on Starknet.
