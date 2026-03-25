#[starknet::contract]
mod GaragaVerifier {
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        allowed_proofs: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ProofChecked: ProofChecked,
    }

    #[derive(Drop, starknet::Event)]
    struct ProofChecked {
        proof_hash: felt252,
        public_inputs_hash: felt252,
        is_valid: bool,
    }

    #[external(v0)]
    fn set_allowed_proof(ref self: ContractState, proof_hash: felt252, is_allowed: bool) {
        self.allowed_proofs.write(proof_hash, is_allowed);
    }

    #[external(v0)]
    fn verify(ref self: ContractState, proof_hash: felt252, public_inputs_hash: felt252) -> bool {
        let is_valid = self.allowed_proofs.read(proof_hash);
        self.emit(Event::ProofChecked(ProofChecked { proof_hash, public_inputs_hash, is_valid }));
        is_valid
    }
}
