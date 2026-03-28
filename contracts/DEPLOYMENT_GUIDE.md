# ShadowFlow Starknet Deployment Summary

**Date:** March 24, 2026  
**Status:** ✅ Contracts Compiled Successfully

## Completed Actions

### 1. **Toolchain Installation**
   - ✅ Upgraded Rust toolchain to 1.94.0
   - ✅ Installed `scarb` 2.16.1 (Cairo package manager)
   - ✅ Installed `sncast` 0.58.0 (Starknet Foundry)

### 2. **Cairo Contracts Modernized**
   - ✅ Updated `GaragaVerifier.cairo` to modern Starknet storage APIs
   - ✅ Updated `ShadowFlow.cairo` to modern Starknet storage APIs
   - ✅ Initialized Scarb project with proper module structure
   - ✅ Fixed deprecated `LegacyMap` → replaced with `Map`
   - ✅ Fixed deprecated `#[view]` → replaced with `#[external(v0)]`

### 3. **Build Artifacts**
   - ✅ `garaga_verifier.cairo` compiled (1048 bytes)
   - ✅ `shadowflow.cairo` compiled (3337 bytes)
   - ✅ Build artifacts in `contracts/target/dev/`

## Contract Implementations

### GaragaVerifier.cairo
- **Purpose:** Proof verification contract for Garaga ZK proofs
- **Storage:** `admin`, `allowed_proofs` map (proof_hash → bool), `allowed_pairs` map ((proof_hash, public_inputs_hash) → bool)
- **Functions:**
   - `set_admin(new_admin)` - Rotate trusted backend/admin signer
   - `set_allowed_proof(proof_hash, is_allowed)` - Backward-compatible proof registration
   - `register_verified_proof(proof_hash, public_inputs_hash, is_allowed)` - Register approved proof/public-input pair
  - `verify(proof_hash, public_inputs_hash)` - Verify proof validity
- **Events:** `ProofChecked` - Emitted on verification

### ShadowFlow.cairo
- **Purpose:** Privacy-preserving strategy execution contract
- **Storage:**
  - `commitments` map (user → commitment hash)
  - `final_states` map (user → final state)
  - `spent_nullifiers` map (nullifier → spent flag)
  - `merkle_root` (current tree root)
  - `verifier` (GaragaVerifier address)
- **Functions:**
  - `store_commitment(commitment, next_merkle_root)` - Commit strategy
  - `verify_and_store(proof_hash, public_inputs, final_state, nullifier)` - Execute with proof
  - `get_commitment(user)` - Query user commitment (read-only)
  - `is_nullifier_spent(nullifier)` - Check nullifier (read-only)
  - `get_merkle_root()` - Get current root (read-only)
- **Events:** `StrategyCommitted`, `MerkleRootUpdated`, `ExecutionVerified`

## Deployment Status

✅ **ALL CONTRACTS DEPLOYED SUCCESSFULLY**

### Account
```
Account Name:     shadowflow-testnet
Network:          Sepolia
Address:          0x0731ce505c05b6ebb89e07553c6d2d38ec1d6672dd217e7af4e2f8261fe0274e
Status:           ✅ ACTIVE
```

### Deployed Contracts

#### GaragaVerifier
```
Class Hash:       0x377e33971db10c166204c67589812e36abb6a0204c4851a9a490f1bd43888a3
Contract Address: 0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540
Status:           ✅ LIVE ON-CHAIN
View: https://sepolia.voyager.online/contract/0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540
```

#### ShadowFlow
```
Class Hash:       0x7accce1342592dc570398f5ed0de9e16e763c7d0b0985bbc7b61ac851edde61
Contract Address: 0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a
Verifier Address: 0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540
Initial Root:     0x0
Status:           ✅ LIVE ON-CHAIN
View: https://sepolia.voyager.online/contract/0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a
```

## Next Steps for Production Deployment

### ✅ Completed: Contract Declarations & Deployments

**GaragaVerifier:**
- Declared: Class Hash `0x377e33971db10c166204c67589812e36abb6a0204c4851a9a490f1bd43888a3`
- Deployed: Address `0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540`
- Transaction: `0x013c0ab9271e7dc2234fb8d804ac7ad777d49db26cda86bd4e3b41ee4922c8f6`

**ShadowFlow:**
- Declared: Class Hash `0x7accce1342592dc570398f5ed0de9e16e763c7d0b0985bbc7b61ac851edde61`
- Deployed: Address `0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a`
- Verifier Address: `0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540` (passed in constructor)
- Initial Merkle Root: `0x0`
- Transaction: `0x07822bbf60314c0c5ff588b8a084870f4aae175947990c4f69ddc33d05bb5e63`

### Next: Frontend Integration
See **Integration: Update Frontend** section above.

## Files & Resources

**Local Files:**
- `contracts/Scarb.toml` - Project manifest with starknet-contract target
- `contracts/src/` - Cairo source modules
- `contracts/target/dev/` - Compiled Sierra artifacts
- `snfoundry.toml` - sncast configuration
- `scripts/compile-only-starknet.ps1` - Build script

**On-Chain Resources:**
- GaragaVerifier: https://sepolia.voyager.online/contract/0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540
- ShadowFlow: https://sepolia.voyager.online/contract/0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a

## Verification
To verify contracts are sound before deployment:

1. **Review compiled Sierra code:**
   ```powershell
   cat contracts/target/dev/shadowflow.sierra
   ```

2. **Check Starknet compatibility:**
   - Contracts use Starknet Cairo 2.16.1
   - Compatible with Starknet mainnet and testnet

3. **Validate on-chain execution:**
   - Use Starkscan to inspect after deployment
   - Monitor events from contract interactions

## Production Considerations

- **Current Network:** Starknet Sepolia testnet (for development/testing)
- **Verifier Integration:** GaragaVerifier address embedded in ShadowFlow constructor ✅
- **Merkle Root:** Initialized to 0x0; update via contract function calls
- **Security:** Private key stored locally in sncast account config — keep secure
- **Mainnet Migration:** To deploy to mainnet, create new account and re-run with `--network mainnet`
- **Gas Costs:** Sepolia deployments used minimal test STRK (~0.02); mainnet uses real ETH (~0.002 ETH)

## Support Resources

- [Starknet Docs](https://docs.starknet.io)
- [Cairo Book](https://book.cairo-lang.org)
- [Scarb Reference](https://docs.swmansion.com/scarb)
- [Starkscan Explorer](https://starkscan.co)

---

## Current Progress Checklist

- ✅ Install Rust toolchain (1.94.0)
- ✅ Install `scarb` 2.16.1 and `sncast` 0.58.0
- ✅ Compile Cairo contracts
- ✅ Create Starknet account: `shadowflow-testnet`
- ✅ Fund account from faucet
- ✅ Deploy account contract
- ✅ Declare GaragaVerifier → Class Hash: `0x377e33e...`
- ✅ Deploy GaragaVerifier → Address: `0x024e93e...`
- ✅ Declare ShadowFlow → Class Hash: `0x7accce1...`
- ✅ Deploy ShadowFlow → Address: `0x025fd71c...`
- **NEXT:** Update frontend with contract addresses

---

## Integration: Update Frontend

**1. Create `.env.local` at project root:**
```env
NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS=0x024e93e27078a286b18da6061c201359aaf0412f0c4a0c0b47857630b124c540
NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS=0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a
STARKNET_NETWORK=sepolia
STARKNET_RPC=https://api.cartridge.gg/x/starknet/sepolia
```

**2. Update `lib/starknetClient.ts`:**
- Replace mock addresses with `process.env.NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS`
- Replace mock verifier with `process.env.NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS`

**3. Test wallet connection:**
- Connect Starknet wallet to Sepolia testnet
- Execute a test transaction to verify contract interaction
