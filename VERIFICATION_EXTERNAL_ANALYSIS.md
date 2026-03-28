# Verification and Aggregation Analysis (External Sources)

Date: 2026-03-27

## Sources Reviewed

- https://garaga.gitbook.io/garaga/
- https://github.com/keep-starknet-strange/garaga
- https://docs.starknet.io/
- https://docs.starknet.io/build/quickstart/environment-setup
- https://foundry-rs.github.io/starknet-foundry/

## Key Findings

1. Garaga provides production-focused on-chain verifier generation and verification flows (`garaga gen`, `garaga declare`, `garaga deploy`, `garaga verify-onchain`).
2. Garaga stresses version matching across SDK/toolchain components for calldata compatibility.
3. Starknet docs and Starknet Foundry docs indicate current best-practice deployment/testing flow should use Scarb + Starknet Foundry.
4. In the current project, `GaragaVerifier` was an allowlist verifier. This is not cryptographic verification.

## Implemented Interim in This Repository

1. Enabled real execution mode and local API base (`NEXT_PUBLIC_EXECUTION_API_URL=http://localhost:3000/api`).
2. Added server execution routes:
   - `POST /api/commitment/store`
   - `POST /api/proof/register-valid`
   - `POST /api/proof/verify-and-store`
   - `GET /api/nullifier/spent`
   - `GET /api/chain/state`
3. Added backend-managed proof registry in `proofs/valid-proof-registry.json`.
4. Updated client execution path to register proof + public inputs before verify/store.
5. Hardened contract source model so verifier is keyed by `(proof_hash, public_inputs_hash)` and controlled by admin (requires redeploy).
6. Added recursive aggregation backend hook (`NEXT_PUBLIC_RECURSIVE_AGGREGATOR_API_URL`) and `aggregateRecursively()` path.

## What Is Still Needed for Full Cryptographic Production

1. Replace interim allowlist-style registration with generated Garaga verifier contract for your proving system and VK.
2. Redeploy verifier and ShadowFlow wiring to new verifier address.
3. Use backend validation pipeline that checks proof artifacts before on-chain registration.
4. For recursive aggregation on-chain, run a dedicated recursive prover service and publish an on-chain verifier for that recursive proof system.
5. Add integration tests on Sepolia for:
   - register-valid -> verify-and-store success path
   - replay/nullifier rejection path
   - malformed public-input mismatch rejection

## Practical Migration Path

1. Keep current interim route for development and controlled testnet execution.
2. Generate and deploy a Garaga verifier from your real VK.
3. Change `/api/proof/register-valid` from "set allowlist" to "run backend proof validation and only then invoke on-chain verifier-compatible flow".
4. Gate production deployment on end-to-end tests and signer key isolation.
