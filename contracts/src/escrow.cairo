#[starknet::contract]
mod EscrowContract {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::get_caller_address;
    use core::traits::Into;

    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    }

    #[starknet::interface]
    trait IShadowFlowVerifier<TContractState> {
        fn verify_and_store(
            ref self: TContractState,
            proof_hash: felt252,
            public_inputs_hash: felt252,
            final_state_hash: felt252,
            nullifier: felt252,
        );
        fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;
    }

    #[starknet::interface]
    trait IEscrow<TContractState> {
        fn add_wallet_to_allowlist(ref self: TContractState, wallet: ContractAddress);
        fn is_wallet_allowed(self: @TContractState, wallet: ContractAddress) -> bool;
        fn add_token_to_allowlist(ref self: TContractState, token: ContractAddress);
        fn is_token_allowed(self: @TContractState, token: ContractAddress) -> bool;
        fn create_escrow_deposit(
            ref self: TContractState,
            chain: felt252,
            amount: u256,
            token: ContractAddress,
            proof_hash: felt252,
        );
        fn lock_escrow_with_proof(
            ref self: TContractState,
            chain: felt252,
            proof_hash: felt252,
            public_inputs_hash: felt252,
            final_state_hash: felt252,
            nullifier: felt252,
        );
        fn release_escrow(
            ref self: TContractState,
            chain: felt252,
            recipient: ContractAddress,
            amount: u256,
            token: ContractAddress,
        );
        fn refund_escrow(
            ref self: TContractState,
            chain: felt252,
            token: ContractAddress,
        );
        fn get_deposit_amount(self: @TContractState, wallet: ContractAddress, chain: felt252) -> u256;
        fn get_escrow_status(self: @TContractState, wallet: ContractAddress, chain: felt252) -> u8;
        fn get_proof_to_escrow(self: @TContractState, proof_hash: felt252) -> (ContractAddress, felt252, u256);
    }

    #[storage]
    struct Storage {
        // Escrow deposits mapping: wallet → chain → amount
        deposits: Map<(ContractAddress, felt252), u256>,
        
        // Escrow status: (wallet, chain) → status
        // 0: none, 1: pending, 2: locked, 3: released, 4: refunded
        escrow_status: Map<(ContractAddress, felt252), u8>,
        
        // ZK proof to escrow link: proof_hash → (wallet, chain, amount)
        proof_to_escrow: Map<felt252, (ContractAddress, felt252, u256)>,
        
        // Allowlist for verified wallets: wallet → is_allowed
        allowlist: Map<ContractAddress, bool>,
        
        // Allowlist for verified tokens: token → is_allowed
        token_allowlist: Map<ContractAddress, bool>,
        
        // Admin address
        admin: ContractAddress,
        
        // ShadowFlow verifier contract
        verifier: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        DepositCreated: DepositCreated,
        DepositLocked: DepositLocked,
        DepositReleased: DepositReleased,
        DepositRefunded: DepositRefunded,
        WalletAddedToAllowlist: WalletAddedToAllowlist,
        TokenAddedToAllowlist: TokenAddedToAllowlist,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositCreated {
        wallet: ContractAddress,
        chain: felt252,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositLocked {
        wallet: ContractAddress,
        chain: felt252,
        proof_hash: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositReleased {
        wallet: ContractAddress,
        chain: felt252,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositRefunded {
        wallet: ContractAddress,
        chain: felt252,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct WalletAddedToAllowlist {
        wallet: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenAddedToAllowlist {
        token: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        verifier: ContractAddress,
    ) {
        self.admin.write(admin);
        self.verifier.write(verifier);
    }

    // ============================================
    // TRAIT IMPLEMENTATION
    // ============================================
    
    #[abi(embed_v0)]
    impl EscrowImpl of IEscrow<ContractState> {
        fn add_wallet_to_allowlist(ref self: ContractState, wallet: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'only admin');
            
            self.allowlist.write(wallet, true);
            self.emit(Event::WalletAddedToAllowlist(WalletAddedToAllowlist { wallet }));
        }

        fn is_wallet_allowed(self: @ContractState, wallet: ContractAddress) -> bool {
            self.allowlist.read(wallet)
        }

        fn add_token_to_allowlist(ref self: ContractState, token: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'only admin');
            
            self.token_allowlist.write(token, true);
            self.emit(Event::TokenAddedToAllowlist(TokenAddedToAllowlist { token }));
        }

        fn is_token_allowed(self: @ContractState, token: ContractAddress) -> bool {
            self.token_allowlist.read(token)
        }

        fn create_escrow_deposit(
            ref self: ContractState,
            chain: felt252,
            amount: u256,
            token: ContractAddress,
            proof_hash: felt252,
        ) {
            let caller = get_caller_address();

            assert(self.is_wallet_allowed(caller), 'wallet not in allowlist');
            assert(self.is_token_allowed(token), 'token not allowed');
            assert(amount > 0, 'amount must be > 0');
            assert(proof_hash != 0, 'proof_hash required');

            let status_key = (caller, chain);
            let current_status = self.escrow_status.read(status_key);
            assert(current_status == 0 || current_status == 4, 'escrow exists/pending');

            let dispatcher = IERC20Dispatcher { contract_address: token };
            dispatcher.transfer_from(caller, starknet::get_contract_address(), amount);

            self.deposits.write(status_key, amount);
            self.escrow_status.write(status_key, 1);
            self.proof_to_escrow.write(proof_hash, (caller, chain, amount));

            let block_timestamp = starknet::get_block_timestamp();
            self.emit(Event::DepositCreated(DepositCreated {
                wallet: caller,
                chain,
                amount,
                timestamp: block_timestamp,
            }));
        }

        fn lock_escrow_with_proof(
            ref self: ContractState,
            chain: felt252,
            proof_hash: felt252,
            public_inputs_hash: felt252,
            final_state_hash: felt252,
            nullifier: felt252,
        ) {
            let caller = get_caller_address();
            let status_key = (caller, chain);

            assert(self.is_wallet_allowed(caller), 'wallet not in allowlist');

            let current_status = self.escrow_status.read(status_key);
            assert(current_status == 1, 'deposit not pending');

            let verifier = IShadowFlowVerifierDispatcher { contract_address: self.verifier.read() };
            verifier.verify_and_store(proof_hash, public_inputs_hash, final_state_hash, nullifier);

            self.escrow_status.write(status_key, 2);

            let block_timestamp = starknet::get_block_timestamp();
            self.emit(Event::DepositLocked(DepositLocked {
                wallet: caller,
                chain,
                proof_hash,
                timestamp: block_timestamp,
            }));
        }

        fn release_escrow(
            ref self: ContractState,
            chain: felt252,
            recipient: ContractAddress,
            amount: u256,
            token: ContractAddress,
        ) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'only admin can release');
            assert(self.is_wallet_allowed(recipient), 'recipient not in allowlist');

            let status_key = (recipient, chain);
            let current_status = self.escrow_status.read(status_key);
            assert(current_status == 2, 'escrow not locked');

            let deposited = self.deposits.read(status_key);
            assert(amount <= deposited, 'amount exceeds deposit');

            let dispatcher = IERC20Dispatcher { contract_address: token };
            dispatcher.transfer(recipient, amount);

            if amount == deposited {
                self.escrow_status.write(status_key, 3);
                self.deposits.write(status_key, 0);
            } else {
                self.deposits.write(status_key, deposited - amount);
            }

            let block_timestamp = starknet::get_block_timestamp();
            self.emit(Event::DepositReleased(DepositReleased {
                wallet: recipient,
                chain,
                amount,
                timestamp: block_timestamp,
            }));
        }

        fn refund_escrow(
            ref self: ContractState,
            chain: felt252,
            token: ContractAddress,
        ) {
            let caller = get_caller_address();
            let status_key = (caller, chain);

            let current_status = self.escrow_status.read(status_key);
            assert(current_status == 1 || current_status == 2, 'cannot refund this deposit');

            let amount = self.deposits.read(status_key);
            assert(amount > 0, 'no deposit to refund');

            let dispatcher = IERC20Dispatcher { contract_address: token };
            dispatcher.transfer(caller, amount);

            self.escrow_status.write(status_key, 4);
            self.deposits.write(status_key, 0);

            let block_timestamp = starknet::get_block_timestamp();
            self.emit(Event::DepositRefunded(DepositRefunded {
                wallet: caller,
                chain,
                amount,
                timestamp: block_timestamp,
            }));
        }

        fn get_deposit_amount(self: @ContractState, wallet: ContractAddress, chain: felt252) -> u256 {
            self.deposits.read((wallet, chain))
        }

        fn get_escrow_status(self: @ContractState, wallet: ContractAddress, chain: felt252) -> u8 {
            self.escrow_status.read((wallet, chain))
        }

        fn get_proof_to_escrow(self: @ContractState, proof_hash: felt252) -> (ContractAddress, felt252, u256) {
            self.proof_to_escrow.read(proof_hash)
        }
    }
}
