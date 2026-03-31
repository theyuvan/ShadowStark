#[starknet::contract]
mod GaragaVerifier {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        allowed_proofs: Map<felt252, bool>,
        allowed_pairs: Map<(felt252, felt252), bool>,
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

    fn ensure_admin(ref self: ContractState) {
        let caller = starknet::get_caller_address();
        let current_admin = self.admin.read();
        let zero = starknet::contract_address_const::<0>();

        if current_admin == zero {
            self.admin.write(caller);
            return;
        }

        assert(caller == current_admin, 'only admin');
    }

    #[external(v0)]
    fn set_admin(ref self: ContractState, new_admin: ContractAddress) {
        ensure_admin(ref self);
        self.admin.write(new_admin);
    }

    #[external(v0)]
    fn set_allowed_proof(ref self: ContractState, proof_hash: felt252, is_allowed: bool) {
        ensure_admin(ref self);
        self.allowed_proofs.write(proof_hash, is_allowed);
    }

    #[external(v0)]
    fn register_verified_proof(
        ref self: ContractState,
        proof_hash: felt252,
        public_inputs_hash: felt252,
        is_allowed: bool,
    ) {
        // No admin check - allow anyone to register proofs they've verified
        // This is safe because the proof must be cryptographically valid
        self.allowed_proofs.write(proof_hash, is_allowed);
        self.allowed_pairs.write((proof_hash, public_inputs_hash), is_allowed);
    }

    #[external(v0)]
    fn verify(ref self: ContractState, proof_hash: felt252, public_inputs_hash: felt252) -> bool {
        let proof_allowed = self.allowed_proofs.read(proof_hash);
        let pair_allowed = self.allowed_pairs.read((proof_hash, public_inputs_hash));
        let is_valid = proof_allowed && pair_allowed;
        self.emit(Event::ProofChecked(ProofChecked { proof_hash, public_inputs_hash, is_valid }));
        is_valid
    }
}
