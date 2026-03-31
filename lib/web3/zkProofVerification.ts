/**
 * Lightweight signature verifier used by OTC escrow funding endpoint.
 *
 * Note:
 * - This is a structural validation layer for development/testing flows.
 * - Chain-specific cryptographic verification should be added for production hardening.
 */
export async function verifySignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  if (!walletAddress || !message || !signature) {
    return false;
  }

  const normalizedWallet = walletAddress.trim();
  const normalizedMessage = message.trim();
  const normalizedSignature = String(signature).trim();

  if (!normalizedWallet || !normalizedMessage || !normalizedSignature) {
    return false;
  }

  // Support Starknet-like addresses and plain BTC wallet identifiers.
  const looksLikeStarknetWallet = /^0x[0-9a-fA-F]{10,}$/.test(normalizedWallet);
  const looksLikeBtcWallet = /^[13bc][a-zA-Z0-9]{20,}$/.test(normalizedWallet);
  if (!looksLikeStarknetWallet && !looksLikeBtcWallet) {
    return false;
  }

  // Accept common signature formats used by connected wallets.
  const looksLikeHexSig = /^0x[0-9a-fA-F]{20,}$/.test(normalizedSignature);
  const looksLikeBase64Sig = /^[A-Za-z0-9+/=]{24,}$/.test(normalizedSignature);
  const looksLikeJsonSig =
    normalizedSignature.startsWith("{") || normalizedSignature.startsWith("[");

  return looksLikeHexSig || looksLikeBase64Sig || looksLikeJsonSig;
}
