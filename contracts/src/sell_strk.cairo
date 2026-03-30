#[starknet::contract]
mod SellStrkContract {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use openzeppelin::token::erc20::interface::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        strk_to_btc_rate: u256,  // How much BTC per 1 STRK (in smallest units)
        btc_reserves: u256,       // Total BTC held in reserve (tracked off-chain)
        escrow_contract: ContractAddress,  // Escrow for settlements
        allowed_token: ContractAddress,    // STRK token address
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        SellInitiated: SellInitiated,
        SellCompleted: SellCompleted,
        SellFailed: SellFailed,
    }

    #[derive(Drop, starknet::Event)]
    struct SellInitiated {
        seller: ContractAddress,
        strk_amount: u256,
        btc_amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct SellCompleted {
        seller: ContractAddress,
        strk_amount: u256,
        btc_amount: u256,
        btc_recipient: felt252,  // BTC address (stored as felt252)
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct SellFailed {
        seller: ContractAddress,
        reason: felt252,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        btc_rate: u256,  // e.g., 1 STRK = 0.00002 BTC (satoshi units)
        initial_btc_reserves: u256,
        strk_token_address: ContractAddress,
        escrow_address: ContractAddress,
    ) {
        self.admin.write(admin);
        self.strk_to_btc_rate.write(btc_rate);
        self.btc_reserves.write(initial_btc_reserves);
        self.allowed_token.write(strk_token_address);
        self.escrow_contract.write(escrow_address);
    }

    // ============================================
    // Core Sell STRK Function - STRK → BTC Bridge
    // ============================================
    #[external(v0)]
    fn sell_strk_for_btc(
        ref self: ContractState,
        seller_address: ContractAddress,
        strk_amount: u256,     // STRK amount to sell
        btc_recipient: felt252,  // Recipient BTC address
        proof_hash: felt252,    // ZK proof of STRK ownership
        escrow_id: felt252,     // Escrow ID for settlement
    ) -> bool {
        assert!(strk_amount > 0, "STRK amount must be positive");
        
        let strk_token = ERC20ABIDispatcher { contract_address: self.allowed_token.read() };
        let btc_rate = self.strk_to_btc_rate.read();
        
        // Calculate BTC output: strk_amount * rate (rate is in satoshis per STRK)
        let btc_to_send = strk_amount * btc_rate / 1_000_000;
        
        // Check BTC reserves (tracked on-chain for limit checking)
        let current_btc_reserves = self.btc_reserves.read();
        assert!(btc_to_send <= current_btc_reserves, "Insufficient BTC reserves");

        // Transfer STRK from seller to contract
        let success = strk_token.transferFrom(seller_address, get_contract_address(), strk_amount);
        assert!(success, "STRK transfer in failed");

        // Deduct BTC from reserves (actual transfer happens off-chain via escrow)
        self.btc_reserves.write(current_btc_reserves - btc_to_send);

        self.emit(SellInitiated {
            seller: seller_address,
            strk_amount,
            btc_amount: btc_to_send,
            timestamp: starknet::get_block_timestamp(),
        });

        true
    }

    // ============================================
    // Admin Functions
    // ============================================
    #[external(v0)]
    fn set_strk_to_btc_rate(ref self: ContractState, new_rate: u256) {
        let admin = self.admin.read();
        assert!(get_caller_address() == admin, "Only admin can set rate");
        self.strk_to_btc_rate.write(new_rate);
    }

    #[external(v0)]
    fn add_btc_reserve(ref self: ContractState, amount: u256) {
        let admin = self.admin.read();
        assert!(get_caller_address() == admin, "Only admin can add reserves");
        
        let current = self.btc_reserves.read();
        self.btc_reserves.write(current + amount);
    }

    #[external(v0)]
    fn remove_btc_reserve(ref self: ContractState, amount: u256) {
        let admin = self.admin.read();
        assert!(get_caller_address() == admin, "Only admin can remove reserves");
        
        let current = self.btc_reserves.read();
        assert!(amount <= current, "Amount exceeds reserves");
        self.btc_reserves.write(current - amount);
    }

    #[external(v0)]
    fn withdraw_strk(ref self: ContractState, amount: u256) {
        let admin = self.admin.read();
        assert!(get_caller_address() == admin, "Only admin can withdraw");
        
        let strk_token = ERC20ABIDispatcher { contract_address: self.allowed_token.read() };
        let success = strk_token.transfer(admin, amount);
        assert!(success, "STRK withdrawal failed");
    }

    // ============================================
    // Query Functions
    // ============================================
    #[external(v0)]
    fn get_btc_output(self: @ContractState, strk_amount: u256) -> u256 {
        let rate = self.strk_to_btc_rate.read();
        strk_amount * rate / 1_000_000
    }

    #[external(v0)]
    fn get_strk_to_btc_rate(self: @ContractState) -> u256 {
        self.strk_to_btc_rate.read()
    }

    #[external(v0)]
    fn get_btc_reserves(self: @ContractState) -> u256 {
        self.btc_reserves.read()
    }

    #[external(v0)]
    fn get_escrow_contract(self: @ContractState) -> ContractAddress {
        self.escrow_contract.read()
    }
}
