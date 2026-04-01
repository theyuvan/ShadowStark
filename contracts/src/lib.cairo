// ShadowFlow - Complete Contract Suite
pub mod garaga_verifier;      // ZK Proof Verification (on-chain)
pub mod shadowflow;           // Main OTC Settlement Contract
pub mod escrow;               // Escrow Management with ZK Verification
// pub mod liquidity_pool;       // Liquidity Pool for BTC ↔ STRK Bridging [TODO: Implement]
pub mod buy_strk;             // Buy STRK with BTC (BTC → STRK Bridge)
pub mod sell_strk;            // Sell STRK for BTC (STRK → BTC Bridge)
