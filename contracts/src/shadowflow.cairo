#[starknet::contract]
mod ShadowFlow {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};

    #[starknet::interface]
    trait IGaragaVerifier<TContractState> {
        fn verify(self: @TContractState, proof_hash: felt252, public_inputs_hash: felt252) -> bool;
    }

    #[storage]
    struct Storage {
        commitments: Map<ContractAddress, felt252>,
        final_states: Map<ContractAddress, felt252>,
        merkle_root: felt252,
        spent_nullifiers: Map<felt252, bool>,
        verifier: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StrategyCommitted: StrategyCommitted,
        MerkleRootUpdated: MerkleRootUpdated,
        ExecutionVerified: ExecutionVerified,
    }

    #[derive(Drop, starknet::Event)]
    struct StrategyCommitted {
        user: ContractAddress,
        commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ExecutionVerified {
        user: ContractAddress,
        final_state_hash: felt252,
        nullifier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct MerkleRootUpdated {
        merkle_root: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, verifier: ContractAddress, initial_root: felt252) {
        self.verifier.write(verifier);
        self.merkle_root.write(initial_root);
    }

    #[external(v0)]
    fn store_commitment(ref self: ContractState, commitment: felt252, next_merkle_root: felt252) {
        let caller = starknet::get_caller_address();
        self.commitments.write(caller, commitment);
        self.merkle_root.write(next_merkle_root);
        self.emit(Event::StrategyCommitted(StrategyCommitted { user: caller, commitment }));
        self.emit(Event::MerkleRootUpdated(MerkleRootUpdated { merkle_root: next_merkle_root }));
    }

    #[external(v0)]
    fn verify_and_store(
        ref self: ContractState,
        proof_hash: felt252,
        public_inputs_hash: felt252,
        final_state_hash: felt252,
        nullifier: felt252,
    ) {
        assert(proof_hash != 0, 'proof_hash must not be zero');
        assert(!self.spent_nullifiers.read(nullifier), 'nullifier already spent');

        let verifier_address = self.verifier.read();
        let verified = IGaragaVerifierDispatcher { contract_address: verifier_address }
            .verify(proof_hash, public_inputs_hash);
        assert(verified, 'invalid proof');

        let caller = starknet::get_caller_address();
        self.final_states.write(caller, final_state_hash);
        self.spent_nullifiers.write(nullifier, true);
        self.emit(Event::ExecutionVerified(ExecutionVerified { user: caller, final_state_hash, nullifier }));
    }

    #[external(v0)]
    fn get_commitment(self: @ContractState, user: ContractAddress) -> felt252 {
        self.commitments.read(user)
    }

    #[external(v0)]
    fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
        self.spent_nullifiers.read(nullifier)
    }

    #[external(v0)]
    fn get_merkle_root(self: @ContractState) -> felt252 {
        self.merkle_root.read()
    }
}
